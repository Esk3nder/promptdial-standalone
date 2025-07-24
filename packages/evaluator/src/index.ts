/**
 * PromptDial 2.0 - Calibrated Evaluator Ensemble Service
 *
 * Manages multiple evaluation methods with calibration
 */

import {
  PromptVariant,
  EvaluationResult,
  TaskClassification,
  ServiceRequest,
  ServiceResponse,
  createServiceResponse,
  createServiceError,
  createLogger,
  ERROR_CODES,
  EVALUATORS,
  getTelemetryService,
  mean,
  confidenceInterval,
} from '@promptdial/shared'

import { BaseEvaluator, createEvaluatorRegistry } from './evaluators'

import { CalibrationMonitor, CalibrationDataPoint, getCalibrationMonitor } from './calibration'

// LLM Runner will be accessed via service calls, not direct import

const logger = createLogger('evaluator')

// ============= Evaluator Ensemble =============

export class CalibratedEvaluatorEnsemble {
  private evaluators: Map<string, BaseEvaluator>
  private calibrationMonitor: CalibrationMonitor
  private llmRunner: any

  constructor() {
    this.evaluators = createEvaluatorRegistry()
    this.calibrationMonitor = getCalibrationMonitor()

    // LLM runner will be accessed via HTTP calls to the service
    // Set to true to enable LLM-based evaluators
    this.llmRunner = true
    logger.info('LLM-based evaluators enabled via HTTP calls')
  }

  /**
   * Evaluate a variant with all applicable evaluators
   */
  async evaluate(
    variant: PromptVariant,
    response: string,
    taskMeta: TaskClassification,
    references?: string[],
    traceId?: string,
  ): Promise<EvaluationResult> {
    const startTime = Date.now()

    // Select applicable evaluators
    const applicableEvaluators = this.selectEvaluators(taskMeta, variant)

    logger.info(`Evaluating with ${applicableEvaluators.length} evaluators`, {
      traceId,
      evaluators: applicableEvaluators.map((e) => e.getName()),
    })

    // Run evaluations in parallel
    const evaluationPromises = applicableEvaluators.map((evaluator) =>
      this.runEvaluator(evaluator, variant, response, taskMeta, references).catch((error) => {
        logger.error(`Evaluator ${evaluator.getName()} failed`, error)
        return null
      }),
    )

    const evaluationResults = await Promise.all(evaluationPromises)

    // Combine results
    const combinedResult = this.combineResults(
      evaluationResults.filter((r) => r !== null) as Partial<EvaluationResult>[],
      variant.id,
    )

    // Apply calibration
    const calibratedResult = this.applyCalibration(combinedResult)

    // Record for future calibration
    this.recordForCalibration(variant.id, calibratedResult)

    // Log telemetry
    const duration = Date.now() - startTime
    await this.logTelemetry(traceId, variant.id, calibratedResult, duration)

    return calibratedResult
  }

  /**
   * Compare multiple variants
   */
  async compareVariants(
    variants: Array<{
      variant: PromptVariant
      response: string
    }>,
    taskMeta: TaskClassification,
    references?: string[],
  ): Promise<Array<{ variant: PromptVariant; evaluation: EvaluationResult }>> {
    const results = await Promise.all(
      variants.map(async ({ variant, response }) => ({
        variant,
        evaluation: await this.evaluate(variant, response, taskMeta, references),
      })),
    )

    // Sort by final score
    return results.sort((a, b) => (b.evaluation.final_score || 0) - (a.evaluation.final_score || 0))
  }

  /**
   * Add human feedback for calibration
   */
  addHumanFeedback(variantId: string, humanScore: number): void {
    this.calibrationMonitor.addHumanFeedback(variantId, humanScore)
  }

  /**
   * Get calibration statistics
   */
  getCalibrationStats() {
    return this.calibrationMonitor.getCalibrationStats()
  }

  private selectEvaluators(taskMeta: TaskClassification, variant: PromptVariant): BaseEvaluator[] {
    const selected: BaseEvaluator[] = []

    for (const evaluator of this.evaluators.values()) {
      // Skip LLM-based evaluators if no runner available
      if (evaluator.requiresLLM() && !this.llmRunner) {
        continue
      }

      // Always include self-consistency for SC variants
      if (
        variant.technique.includes('consistency') &&
        evaluator.getName() === EVALUATORS.SELF_CONSISTENCY
      ) {
        selected.push(evaluator)
        continue
      }

      // Include based on task type and complexity
      if (this.shouldIncludeEvaluator(evaluator, taskMeta)) {
        selected.push(evaluator)
      }
    }

    return selected
  }

  private shouldIncludeEvaluator(evaluator: BaseEvaluator, taskMeta: TaskClassification): boolean {
    // Always include G-EVAL and self-consistency
    if ([EVALUATORS.G_EVAL, EVALUATORS.SELF_CONSISTENCY].includes(evaluator.getName())) {
      return true
    }

    // Include chat-eval for interactive tasks
    if (
      evaluator.getName() === EVALUATORS.CHAT_EVAL &&
      ['general_qa', 'creative_writing'].includes(taskMeta.task_type)
    ) {
      return true
    }

    // Include role-debate for high complexity
    if (evaluator.getName() === EVALUATORS.ROLE_DEBATE && taskMeta.complexity > 0.7) {
      return true
    }

    return false
  }

  private async runEvaluator(
    evaluator: BaseEvaluator,
    variant: PromptVariant,
    response: string,
    taskMeta: TaskClassification,
    references?: string[],
  ): Promise<Partial<EvaluationResult>> {
    try {
      return await evaluator.evaluate(variant, response, taskMeta, references)
    } catch (error) {
      logger.error(`Evaluator ${evaluator.getName()} failed`, error as Error)
      throw error
    }
  }

  private combineResults(
    results: Partial<EvaluationResult>[],
    variantId: string,
  ): EvaluationResult {
    // Collect all scores
    const allScores: Record<string, number> = {}

    for (const result of results) {
      if (result.scores) {
        Object.assign(allScores, result.scores)
      }
    }

    // Calculate final score with confidence interval
    const scoreValues = Object.values(allScores)
    const finalScore = mean(scoreValues)
    const ci = confidenceInterval(scoreValues)

    // Detect significant disagreement
    const calibrationError = this.detectDisagreement(scoreValues)

    return {
      variant_id: variantId,
      scores: allScores,
      final_score: finalScore,
      confidence_interval: ci,
      calibration_error: calibrationError,
    }
  }

  private applyCalibration(result: EvaluationResult): EvaluationResult {
    const calibratedScores: Record<string, number> = {}

    for (const [evaluator, score] of Object.entries(result.scores)) {
      calibratedScores[evaluator] = this.calibrationMonitor.calibrateScore(evaluator, score)
    }

    // Recalculate final score with calibrated values
    const calibratedValues = Object.values(calibratedScores)
    const calibratedFinal = mean(calibratedValues)
    const calibratedCI = confidenceInterval(calibratedValues)

    return {
      ...result,
      scores: calibratedScores,
      final_score: calibratedFinal,
      confidence_interval: calibratedCI,
    }
  }

  private detectDisagreement(scores: number[]): number | undefined {
    if (scores.length < 2) return undefined

    // Calculate pairwise differences
    let maxDiff = 0
    for (let i = 0; i < scores.length; i++) {
      for (let j = i + 1; j < scores.length; j++) {
        maxDiff = Math.max(maxDiff, Math.abs(scores[i] - scores[j]))
      }
    }

    // High disagreement if max difference > 0.3
    return maxDiff > 0.3 ? maxDiff : undefined
  }

  private recordForCalibration(variantId: string, result: EvaluationResult): void {
    const dataPoint: CalibrationDataPoint = {
      variant_id: variantId,
      evaluator_scores: result.scores,
      timestamp: new Date(),
    }

    this.calibrationMonitor.addDataPoint(dataPoint)
  }

  private async logTelemetry(
    traceId: string | undefined,
    variantId: string,
    result: EvaluationResult,
    duration: number,
  ): Promise<void> {
    const telemetry = getTelemetryService()

    // Record evaluation metrics
    telemetry.recordLatency('evaluation', duration)
    telemetry.recordMetric('evaluation_final_score', result.final_score)

    if (result.calibration_error) {
      telemetry.recordMetric('evaluation_disagreement', result.calibration_error)
    }

    // Log individual evaluator scores
    for (const [evaluator, score] of Object.entries(result.scores)) {
      telemetry.recordMetric(`evaluation_${evaluator}_score`, score)
    }
  }
}

// ============= Service API =============

let ensembleInstance: CalibratedEvaluatorEnsemble | null = null

export function getEvaluatorEnsemble(): CalibratedEvaluatorEnsemble {
  if (!ensembleInstance) {
    ensembleInstance = new CalibratedEvaluatorEnsemble()
  }
  return ensembleInstance
}

export async function handleEvaluateRequest(
  request: ServiceRequest<{
    variant: PromptVariant
    response: string
    task_meta: TaskClassification
    references?: string[]
    trace_id?: string
  }>,
): Promise<ServiceResponse<EvaluationResult>> {
  try {
    const { variant, response, task_meta, references, trace_id } = request.payload

    const result = await getEvaluatorEnsemble().evaluate(
      variant,
      response,
      task_meta,
      references,
      trace_id,
    )

    return createServiceResponse(request, result)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.EVALUATION_FAILED,
      'Evaluation failed',
      true,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleCompareRequest(
  request: ServiceRequest<{
    variants: Array<{
      variant: PromptVariant
      response: string
    }>
    task_meta: TaskClassification
    references?: string[]
  }>,
): Promise<ServiceResponse<Array<{ variant: PromptVariant; evaluation: EvaluationResult }>>> {
  try {
    const { variants, task_meta, references } = request.payload

    const results = await getEvaluatorEnsemble().compareVariants(variants, task_meta, references)

    return createServiceResponse(request, results)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.EVALUATION_FAILED,
      'Comparison failed',
      true,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleFeedbackRequest(
  request: ServiceRequest<{
    variant_id: string
    human_score: number
  }>,
): Promise<ServiceResponse<void>> {
  try {
    const { variant_id, human_score } = request.payload

    getEvaluatorEnsemble().addHumanFeedback(variant_id, human_score)

    return createServiceResponse(request)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Failed to record feedback',
      false,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3005

  app.use(express.json({ limit: '10mb' }))

  // Evaluate single variant
  app.post('/evaluate', async (req: any, res: any) => {
    const response = await handleEvaluateRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Compare variants
  app.post('/compare', async (req: any, res: any) => {
    const response = await handleCompareRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Human feedback
  app.post('/feedback', async (req: any, res: any) => {
    const response = await handleFeedbackRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Get calibration stats
  app.get('/calibration', (_req: any, res: any) => {
    const stats = getEvaluatorEnsemble().getCalibrationStats()
    res.json({ stats })
  })

  app.get('/health', (_req: any, res: any) => {
    res.json({
      status: 'healthy',
      service: 'evaluator',
      evaluators: Array.from(createEvaluatorRegistry().keys()),
    })
  })

  app.listen(PORT, () => {
    logger.info(`Evaluator service running on port ${PORT}`)
  })
}
