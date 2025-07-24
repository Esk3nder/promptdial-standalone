/**
 * PromptDial 2.0 - Technique Engine Service
 *
 * Manages and executes prompt optimization techniques
 */

import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TechniqueStrategy,
  ServiceRequest,
  ServiceResponse,
  TelemetryEvent,
  createLogger,
  createTelemetryEvent,
  ERROR_CODES,
  TECHNIQUES,
  getTelemetryService,
} from '@promptdial/shared'

import { ALL_TECHNIQUES, TECHNIQUE_REGISTRY, BaseTechnique } from './techniques'

// Re-export constants that other packages need
export { SELF_CONSISTENCY_VOTE_PROMPT, IRCOT_RETRIEVAL_INSTRUCTION } from './techniques'

const logger = createLogger('technique-engine')

// ============= Technique Engine Implementation =============

export class TechniqueEngine {
  private techniques: Map<string, typeof BaseTechnique>
  private customTechniques: Map<string, TechniqueStrategy>

  constructor() {
    this.techniques = new Map(TECHNIQUE_REGISTRY)
    this.customTechniques = new Map()
  }

  /**
   * Register a custom technique
   */
  registerTechnique(strategy: TechniqueStrategy): void {
    if (this.techniques.has(strategy.name) || this.customTechniques.has(strategy.name)) {
      throw new Error(`Technique ${strategy.name} is already registered`)
    }

    this.customTechniques.set(strategy.name, strategy)
    logger.info(`Registered custom technique: ${strategy.name}`)
  }

  /**
   * Generate variants using all applicable techniques
   */
  async generateVariants(
    basePrompt: string,
    taskClassification: TaskClassification,
    budget: BudgetConstraints,
    traceId: string,
  ): Promise<PromptVariant[]> {
    const startTime = Date.now()
    const allVariants: PromptVariant[] = []

    // Get applicable techniques
    const applicableTechniques = this.getApplicableTechniques(taskClassification, budget)

    logger.info(`Found ${applicableTechniques.length} applicable techniques`, {
      traceId,
      techniques: applicableTechniques.map((t) => t.name),
    })

    // Track budget consumption
    const budgetTracker = { ...budget }

    // Generate variants from each technique
    for (const technique of applicableTechniques) {
      try {
        const techniqueStart = Date.now()

        // Check remaining budget
        if (budgetTracker.remaining_cost_usd <= 0) {
          logger.warn('Budget exhausted, skipping remaining techniques', { traceId })
          break
        }

        // Generate variants
        const variants = await this.generateWithTechnique(
          technique,
          basePrompt,
          taskClassification,
          budgetTracker,
        )

        // Update budget
        for (const variant of variants) {
          budgetTracker.remaining_cost_usd -= variant.cost_usd
          allVariants.push(variant)
        }

        // Log technique completion
        const techniqueLatency = Date.now() - techniqueStart
        await this.logTechniqueCompletion(
          traceId,
          technique.name,
          variants.length,
          techniqueLatency,
        )
      } catch (error) {
        logger.error(`Technique ${technique.name} failed`, error as Error, { traceId })
        // Continue with other techniques
      }
    }

    // Log overall completion
    const totalLatency = Date.now() - startTime
    await this.logEngineCompletion(traceId, allVariants.length, totalLatency)

    return allVariants
  }

  /**
   * Get all techniques applicable to a task
   */
  private getApplicableTechniques(
    classification: TaskClassification,
    budget: BudgetConstraints,
  ): TechniqueStrategy[] {
    const techniques: TechniqueStrategy[] = []

    // Check suggested techniques first
    for (const techniqueName of classification.suggested_techniques) {
      const technique = this.getTechnique(techniqueName)
      if (technique && this.isTechniqueApplicable(technique, classification, budget)) {
        techniques.push(technique)
      }
    }

    // Add other compatible techniques
    for (const [name, TechniqueClass] of this.techniques) {
      if (!classification.suggested_techniques.includes(name)) {
        const technique = new TechniqueClass()
        if (this.isTechniqueApplicable(technique, classification, budget)) {
          techniques.push(technique)
        }
      }
    }

    // Add applicable custom techniques
    for (const [name, technique] of this.customTechniques) {
      if (this.isTechniqueApplicable(technique, classification, budget)) {
        techniques.push(technique)
      }
    }

    // Sort by relevance (suggested first, then by best_for match)
    return techniques.sort((a, b) => {
      const aScore = this.scoreTechnique(a, classification)
      const bScore = this.scoreTechnique(b, classification)
      return bScore - aScore
    })
  }

  private getTechnique(name: string): TechniqueStrategy | null {
    const TechniqueClass = this.techniques.get(name)
    if (TechniqueClass) {
      return new TechniqueClass()
    }

    return this.customTechniques.get(name) || null
  }

  private isTechniqueApplicable(
    technique: TechniqueStrategy,
    classification: TaskClassification,
    budget: BudgetConstraints,
  ): boolean {
    // Check if technique needs retrieval but task doesn't have it
    if (technique.needs_retrieval && !classification.needs_retrieval) {
      return false
    }

    // Check if technique is suitable for task type
    if (technique.best_for.length > 0 && !technique.best_for.includes(classification.task_type)) {
      // Allow with lower priority
      return Math.random() < 0.3 // 30% chance to try anyway
    }

    // Check minimum budget (rough estimate)
    const minCost = 0.01 // Minimum cost for any technique
    if (budget.remaining_cost_usd < minCost) {
      return false
    }

    return true
  }

  private scoreTechnique(technique: TechniqueStrategy, classification: TaskClassification): number {
    let score = 0

    // Bonus for suggested techniques
    if (classification.suggested_techniques.includes(technique.name)) {
      score += 100
    }

    // Bonus for task type match
    if (technique.best_for.includes(classification.task_type)) {
      score += 50
    }

    // Penalty for retrieval mismatch
    if (technique.needs_retrieval && !classification.needs_retrieval) {
      score -= 30
    }

    // Bonus for complexity match
    if (
      classification.complexity > 0.7 &&
      [TECHNIQUES.TREE_OF_THOUGHT, TECHNIQUES.DSPY_APE].includes(technique.name)
    ) {
      score += 20
    }

    return score
  }

  private async generateWithTechnique(
    technique: TechniqueStrategy,
    basePrompt: string,
    classification: TaskClassification,
    budget: BudgetConstraints,
  ): Promise<PromptVariant[]> {
    try {
      const variants = await technique.generate(basePrompt, classification, budget)

      // Validate variants
      return variants.filter((v) => this.validateVariant(v))
    } catch (error) {
      logger.error(`Failed to generate variants with ${technique.name}`, error as Error)
      return []
    }
  }

  private validateVariant(variant: PromptVariant): boolean {
    // Check required fields
    if (!variant.id || !variant.prompt || !variant.technique) {
      return false
    }

    // Check limits (using hardcoded values since PERFORMANCE_LIMITS was removed)
    if (variant.est_tokens > 8192) {
      return false
    }

    if (variant.cost_usd > 5.0) {
      return false
    }

    if (variant.temperature < 0 || variant.temperature > 2) {
      return false
    }

    return true
  }

  private async logTechniqueCompletion(
    traceId: string,
    techniqueName: string,
    variantCount: number,
    latencyMs: number,
  ): Promise<void> {
    const event = createTelemetryEvent('variant_generated', traceId, '', {
      task_type: 'general_qa',
      provider: techniqueName,
      latency_ms: latencyMs,
      total_tokens: variantCount * 1000, // Rough estimate
    })

    try {
      await getTelemetryService().logEvent(event)
    } catch (error) {
      logger.error('Failed to log telemetry', error as Error)
    }
  }

  private async logEngineCompletion(
    traceId: string,
    totalVariants: number,
    latencyMs: number,
  ): Promise<void> {
    const event = createTelemetryEvent('optimization_end', traceId, '', {
      task_type: 'general_qa',
      latency_ms: latencyMs,
      total_tokens: totalVariants * 1000,
    })

    try {
      await getTelemetryService().logEvent(event)
    } catch (error) {
      logger.error('Failed to log telemetry', error as Error)
    }
  }
}

// ============= Service API =============

const engineInstance = new TechniqueEngine()

export async function handleGenerateVariantsRequest(
  request: ServiceRequest<{
    base_prompt: string
    classification: TaskClassification
    budget: BudgetConstraints
    trace_id: string
  }>,
): Promise<ServiceResponse<PromptVariant[]>> {
  try {
    const { base_prompt, classification, budget, trace_id } = request.payload

    const variants = await engineInstance.generateVariants(
      base_prompt,
      classification,
      budget,
      trace_id,
    )

    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: true,
      data: variants,
    }
  } catch (error) {
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to generate variants',
        retryable: true,
      },
    }
  }
}

export async function handleRegisterTechniqueRequest(
  request: ServiceRequest<TechniqueStrategy>,
): Promise<ServiceResponse<void>> {
  try {
    engineInstance.registerTechnique(request.payload)
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: true,
    }
  } catch (error) {
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: false,
      error: {
        code: ERROR_CODES.INVALID_PARAMETERS,
        message: (error as Error).message,
        retryable: false,
      },
    }
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3002

  app.use(express.json({ limit: '10mb' }))

  // Generate variants endpoint
  app.post('/generate', async (req: any, res: any) => {
    const response = await handleGenerateVariantsRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Register technique endpoint
  app.post('/register', async (req: any, res: any) => {
    const response = await handleRegisterTechniqueRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  app.get('/health', (_req: any, res: any) => {
    res.json({
      status: 'healthy',
      service: 'technique-engine',
      techniques: Array.from(TECHNIQUE_REGISTRY.keys()),
    })
  })

  app.listen(PORT, () => {
    logger.info(`Technique Engine service running on port ${PORT}`)
  })
}
