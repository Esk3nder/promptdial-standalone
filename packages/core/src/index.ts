/**
 * PromptDial - AI Prompt Optimization Engine
 *
 * Transform basic prompts into optimized, model-specific queries
 */

import { MetaPromptDesigner, OptimizationRequest, OptimizedVariant } from './meta-prompt-designer'
import { AIMetaPromptDesigner } from './ai-meta-prompt-designer'
import { QualityValidator, ValidationResult } from './quality-validator'
import { ConfigManager, PromptDialConfig } from './config'
import {
  TechniqueEngineClient,
  EvaluatorClient,
  RetrievalHubClient,
  OptimizerClient
} from './clients'
import { PromptVariant, TechniqueStrategy } from '@promptdial/shared'

export interface PromptDialOptions {
  autoValidate?: boolean
  sortByQuality?: boolean
  useAI?: boolean // New option to enable AI-powered optimization
  config?: PromptDialConfig // Configuration for hybrid mode
}

export interface OptimizedResult {
  variants: Array<OptimizedVariant & { quality?: ValidationResult }>
  request: OptimizationRequest
  summary: {
    totalVariants: number
    bestScore?: number
    averageScore?: number
  }
}

export class PromptDial {
  private designer: MetaPromptDesigner | AIMetaPromptDesigner
  private validator: QualityValidator
  private options: PromptDialOptions
  private config: PromptDialConfig
  private techniqueClient?: TechniqueEngineClient
  private evaluatorClient?: EvaluatorClient
  private retrievalClient?: RetrievalHubClient
  private optimizerClient?: OptimizerClient

  constructor(options: PromptDialOptions = {}) {
    this.options = {
      autoValidate: true,
      sortByQuality: true,
      useAI: true, // Default to AI-powered optimization
      ...options,
    }

    // Load configuration
    this.config = options.config || ConfigManager.getInstance().getConfig()

    // Initialize service clients if in microservices mode
    if (this.config.mode === 'microservices') {
      this.initializeServiceClients()
    }

    // Use AI designer if enabled and API keys are available
    if (this.options.useAI && this.hasAPIKeys()) {
      console.log('Using AIMetaPromptDesigner (AI-powered optimization)')
      this.designer = new AIMetaPromptDesigner()
    } else {
      console.log('Using MetaPromptDesigner (template-based optimization)')
      this.designer = new MetaPromptDesigner()
      if (this.options.useAI) {
        console.log('AI optimization requested but no API keys found. Falling back to basic optimization.')
      }
    }

    this.validator = new QualityValidator()
  }

  private initializeServiceClients(): void {
    const clientOptions = {
      timeout: this.config.serviceTimeout,
      maxRetries: this.config.maxRetries
    }
    
    if (this.config.features?.useTechniqueEngine && this.config.services?.techniqueEngine) {
      this.techniqueClient = new TechniqueEngineClient(this.config.services.techniqueEngine, clientOptions)
    }
    
    if (this.config.features?.useEvaluator && this.config.services?.evaluator) {
      this.evaluatorClient = new EvaluatorClient(this.config.services.evaluator, clientOptions)
    }
    
    if (this.config.features?.useRetrieval && this.config.services?.retrievalHub) {
      this.retrievalClient = new RetrievalHubClient(this.config.services.retrievalHub, clientOptions)
    }
    
    if (this.config.features?.useParetoFilter && this.config.services?.optimizer) {
      this.optimizerClient = new OptimizerClient(this.config.services.optimizer, clientOptions)
    }
  }

  /**
   * Optimize a prompt for a specific AI model
   */
  async optimize(request: OptimizationRequest): Promise<OptimizedResult> {
    console.log('PromptDial.optimize called with:', request)
    try {
      let variants: OptimizedVariant[]

      // Use microservices if available
      if (this.shouldUseMicroservices()) {
        variants = await this.optimizeWithServices(request)
      } else {
        // Fall back to monolithic mode
        variants = await this.designer.generateVariants(request)
      }
      
      console.log('Generated variants:', variants.length)

      // Optionally validate quality
      let enhancedVariants = variants
      if (this.options.autoValidate) {
        if (this.evaluatorClient && this.config.features?.useEvaluator) {
          enhancedVariants = await this.addQualityScoresWithService(variants)
        } else {
          enhancedVariants = await this.addQualityScores(variants)
        }
      }

      // Apply Pareto optimization if enabled
      if (this.optimizerClient && this.config.features?.useParetoFilter) {
        const promptVariants = enhancedVariants.map(v => ({
          ...v,
          id: v.description,
          prompt: v.optimizedPrompt
        } as PromptVariant))
        
        const optimized = await this.optimizerClient.paretoFilter(promptVariants)
        enhancedVariants = optimized.map(pv => {
          const original = enhancedVariants.find(v => v.description === pv.id)
          return original || { ...pv, optimizedPrompt: pv.prompt, description: pv.id || '' }
        })
      }

      // Sort by quality if enabled
      if (this.options.sortByQuality && this.options.autoValidate) {
        enhancedVariants.sort((a, b) => {
          const aScore = (a as any).quality?.score || 0
          const bScore = (b as any).quality?.score || 0
          return bScore - aScore
        })
      }

      // Calculate summary statistics
      const summary = this.calculateSummary(enhancedVariants)

      return {
        variants: enhancedVariants,
        request,
        summary,
      }
    } catch (error) {
      console.error('Error in optimize:', error)
      
      // Try fallback to monolithic if configured
      if (this.config.fallbackToMonolithic && this.config.mode === 'microservices') {
        console.log('Falling back to monolithic mode due to error')
        return this.optimizeMonolithic(request)
      }
      
      throw error
    }
  }

  /**
   * Validate a single variant
   */
  async validateVariant(variant: OptimizedVariant): Promise<ValidationResult> {
    return this.validator.validateAndScore(variant)
  }

  /**
   * Compare multiple variants and rank by quality
   */
  async compareVariants(variants: OptimizedVariant[]) {
    return this.validator.compareVariants(variants)
  }

  private async addQualityScores(
    variants: OptimizedVariant[],
  ): Promise<Array<OptimizedVariant & { quality: ValidationResult }>> {
    return Promise.all(
      variants.map(async (variant) => ({
        ...variant,
        quality: await this.validator.validateAndScore(variant),
      })),
    )
  }

  private calculateSummary(variants: Array<OptimizedVariant & { quality?: ValidationResult }>) {
    const scores = variants
      .map((v) => v.quality?.score)
      .filter((score): score is number => score !== undefined)

    return {
      totalVariants: variants.length,
      bestScore: scores.length > 0 ? Math.max(...scores) : undefined,
      averageScore:
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined,
    }
  }

  private hasAPIKeys(): boolean {
    return !!(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GOOGLE_AI_API_KEY
    )
  }

  private shouldUseMicroservices(): boolean {
    return (
      this.config.mode === 'microservices' &&
      this.techniqueClient !== undefined &&
      this.config.features?.useTechniqueEngine === true
    )
  }

  private async optimizeWithServices(request: OptimizationRequest): Promise<OptimizedVariant[]> {
    if (!this.techniqueClient) {
      throw new Error('Technique engine client not initialized')
    }

    // Classify the task
    const taskClassification = await this.techniqueClient.classifyTask(request.prompt)
    
    // Check if retrieval is needed
    let enrichedPrompt = request.prompt
    if (this.retrievalClient && this.needsRetrieval(taskClassification.taskType)) {
      const context = await this.retrievalClient.retrieveForPrompt(request.prompt)
      enrichedPrompt = `${request.prompt}\n\nContext:\n${context}`
    }

    // Generate variants using technique engine
    const techniqueResponse = await this.techniqueClient.generateVariants({
      basePrompt: enrichedPrompt,
      taskClassification,
      targetModel: request.targetModel,
      techniques: taskClassification.suggestedTechniques,
      enableSelfConsistency: true
    })

    // Convert to OptimizedVariant format
    return techniqueResponse.variants.map(v => ({
      optimizedPrompt: v.prompt,
      description: v.technique || v.id,
      score: v.score
    }))
  }

  private needsRetrieval(taskType: string): boolean {
    const retrievalTaskTypes = ['factual_query', 'research', 'analysis', 'multi_hop_reasoning']
    return retrievalTaskTypes.includes(taskType.toLowerCase())
  }

  private async optimizeMonolithic(request: OptimizationRequest): Promise<OptimizedResult> {
    const variants = await this.designer.generateVariants(request)
    const enhancedVariants = this.options.autoValidate 
      ? await this.addQualityScores(variants)
      : variants

    if (this.options.sortByQuality && this.options.autoValidate) {
      enhancedVariants.sort((a, b) => {
        const aScore = (a as any).quality?.score || 0
        const bScore = (b as any).quality?.score || 0
        return bScore - aScore
      })
    }

    return {
      variants: enhancedVariants,
      request,
      summary: this.calculateSummary(enhancedVariants)
    }
  }

  private async addQualityScoresWithService(
    variants: OptimizedVariant[]
  ): Promise<Array<OptimizedVariant & { quality: ValidationResult }>> {
    if (!this.evaluatorClient) {
      return this.addQualityScores(variants)
    }

    const promptVariants = variants.map(v => ({
      id: v.description,
      prompt: v.optimizedPrompt,
      score: v.score || 0
    } as PromptVariant))

    const evaluation = await this.evaluatorClient.evaluate({
      variants: promptVariants,
      method: 'g-eval',
      includeConfidenceIntervals: true
    })

    return variants.map((v, i) => ({
      ...v,
      quality: {
        score: evaluation.results[i].score,
        factors: {
          clarity: evaluation.results[i].score,
          specificity: evaluation.results[i].score,
          actionability: evaluation.results[i].score,
          structuredOutput: evaluation.results[i].score,
          comprehensiveness: evaluation.results[i].score,
          efficiency: evaluation.results[i].score,
          adaptability: evaluation.results[i].score
        },
        suggestions: evaluation.results[i].explanation ? [evaluation.results[i].explanation!] : [],
        confidence: evaluation.results[i].confidence
      }
    }))
  }
}

// Export all types and classes
export { MetaPromptDesigner, OptimizationRequest, OptimizedVariant } from './meta-prompt-designer'
export { QualityValidator, ValidationResult, QualityFactors } from './quality-validator'

// Default export
export default PromptDial
