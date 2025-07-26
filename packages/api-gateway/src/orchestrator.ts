/**
 * PromptDial 2.0 - Request Orchestrator
 *
 * Coordinates requests across microservices
 */

import axios, { AxiosError } from 'axios'
import {
  OptimizationRequest,
  OptimizationResponse,
  PromptVariant,
  TaskClassification,
  EvaluationResult,
  createLogger,
  getTelemetryService,
  ERROR_CODES,
} from '@promptdial/shared'
import { ServiceConfig } from './services'

const logger = createLogger('orchestrator')

export class RequestOrchestrator {
  private services: Record<string, ServiceConfig>

  constructor(services: Record<string, ServiceConfig>) {
    this.services = services
  }

  async optimize(request: OptimizationRequest, traceId: string): Promise<OptimizationResponse> {
    const telemetry = getTelemetryService()

    try {
      // Step 1: Check safety first
      logger.info('Step 1: Safety check', { traceId })
      const safetyResult = await this.callService('safety', '/check', {
        prompt: request.prompt,
        trace_id: traceId,
      })

      if (!safetyResult.data.safe) {
        throw new Error(safetyResult.data.blocked_reason || 'Prompt failed safety check')
      }

      const sanitizedPrompt = safetyResult.data.sanitized_prompt || request.prompt

      // Step 2: Classify the task
      logger.info('Step 2: Task classification', { traceId })
      const classificationResult = await this.callService('classifier', '/classify', {
        prompt: sanitizedPrompt,
        trace_id: traceId,
      })

      const taskMeta: TaskClassification = classificationResult.data
      telemetry.recordMetric('task_complexity', taskMeta.complexity)

      // Step 3: Strategy Planning (PromptDial 3.0)
      logger.info('Step 3: Strategy planning', { traceId })
      let suggestedTechniques: string[] = []
      let strategyConfidence = 0.5
      
      try {
        const strategyResult = await this.callService('strategyPlanner', '/plan', {
          prompt: sanitizedPrompt,
          context: {
            taskType: taskMeta.task_type,
            modelName: request.constraints?.model || 'default',
            optimizationLevel: this.getOptimizationLevel(request.constraints),
            metadata: {
              complexity: taskMeta.complexity,
              domain: taskMeta.domain
            }
          },
          trace_id: traceId,
        })
        
        suggestedTechniques = strategyResult.data.suggested_techniques || []
        strategyConfidence = strategyResult.data.confidence || 0.5
        
        logger.info('Strategy planning complete', { 
          traceId, 
          techniques: suggestedTechniques,
          confidence: strategyConfidence 
        })
      } catch (error) {
        logger.warn('Strategy planning failed, using default techniques', { error, traceId })
        // Fall back to default techniques based on task type
        suggestedTechniques = ['chain_of_thought']
      }

      // Step 4: Retrieve relevant examples (if retrieval is enabled)
      logger.info('Step 4: Retrieval (if applicable)', { traceId })
      let retrievedExamples: any[] = []

      if (request.context?.examples || taskMeta.complexity > 0.7) {
        try {
          const retrievalResult = await this.callService('retrieval', '/search', {
            query: sanitizedPrompt,
            task_type: taskMeta.task_type,
            top_k: 5,
            trace_id: traceId,
          })
          retrievedExamples = retrievalResult.data.documents || []
        } catch (error) {
          logger.warn('Retrieval failed, continuing without examples', { error })
        }
      }

      // Step 5: Generate variants using techniques
      logger.info('Step 5: Variant generation', { traceId })
      const techniqueResult = await this.callService('technique', '/generate', {
        prompt: sanitizedPrompt,
        task_meta: taskMeta,
        retrieved_examples: retrievedExamples,
        suggested_techniques: suggestedTechniques, // Pass strategy planner suggestions
        constraints: request.constraints,
        trace_id: traceId,
      })

      const variants: PromptVariant[] = techniqueResult.data.variants
      logger.info(`Generated ${variants.length} variants`, { traceId })

      // Step 6: Run variants through LLM (sample responses)
      logger.info('Step 6: LLM execution', { traceId })
      const variantResponses = await this.executeVariants(variants, traceId)

      // Step 7: Evaluate variants
      logger.info('Step 7: Evaluation', { traceId })
      const evaluations = await this.evaluateVariants(
        variantResponses,
        taskMeta,
        request.context?.reference_output,
        traceId,
      )

      // Step 8: Optimize selection
      logger.info('Step 8: Optimization', { traceId })
      const optimizationResult = await this.callService('optimizer', '/optimize', {
        variants: variantResponses.map((vr, i) => ({
          variant: vr.variant,
          evaluation: evaluations[i],
        })),
        preferences: request.preferences,
        constraints: request.constraints,
        selection_mode: 'balanced',
        trace_id: traceId,
      })

      const optimization = optimizationResult.data

      // Step 9: Final safety check on recommended variant
      logger.info('Step 9: Final safety check', { traceId })
      const finalSafetyResult = await this.callService('safety', '/check-variant', {
        variant: optimization.recommended.variant,
        task_meta: taskMeta,
        trace_id: traceId,
      })

      if (!finalSafetyResult.data.safe) {
        // Fall back to next best alternative
        if (optimization.alternatives.length > 0) {
          optimization.recommended = optimization.alternatives[0]
          optimization.alternatives = optimization.alternatives.slice(1)
        } else {
          throw new Error('No safe variants available')
        }
      }

      // Build response
      const response: OptimizationResponse = {
        trace_id: traceId,
        original_prompt: request.prompt,
        task_classification: taskMeta,
        variants: optimization.pareto_frontier.map((sol) => sol.variant!),
        recommended_variant: optimization.recommended.variant!,
        evaluation_results: evaluations,
        optimization_metadata: {
          total_variants_generated: variants.length,
          pareto_frontier_size: optimization.pareto_frontier.length,
          techniques_used: [...new Set(variants.map((v) => v.technique))],
          suggested_techniques: suggestedTechniques,
          strategy_confidence: strategyConfidence,
          safety_modifications: sanitizedPrompt !== request.prompt,
        },
      }

      // Record telemetry
      telemetry.recordCounter('optimization_complete', 1)
      telemetry.recordMetric('variants_generated', variants.length)
      telemetry.recordMetric('final_score', optimization.recommended.objectives.quality)

      return response
    } catch (error) {
      logger.error('Optimization failed', error as Error, { traceId })
      telemetry.recordCounter('optimization_failed', 1)
      throw error
    }
  }

  private async callService(serviceName: string, endpoint: string, data: any): Promise<any> {
    const config = this.services[serviceName]
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`)
    }

    const url = `${config.url}${endpoint}`
    const startTime = Date.now()

    try {
      const response = await axios.post(url, data, {
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'X-Trace-ID': data.trace_id,
        },
      })

      const latency = Date.now() - startTime
      logger.debug(`Called ${serviceName}${endpoint} in ${latency}ms`)

      return response
    } catch (error) {
      const latency = Date.now() - startTime
      const axiosError = error as AxiosError

      logger.error(`Service call failed: ${serviceName}${endpoint}`, undefined, {
        status: axiosError.response?.status,
        error: axiosError.message,
        latency,
      })

      // Retry logic
      if (config.retries > 0 && this.shouldRetry(axiosError)) {
        logger.info(`Retrying ${serviceName}${endpoint}`)
        config.retries--
        return this.callService(serviceName, endpoint, data)
      }

      throw new Error(`Service ${serviceName} failed: ${axiosError.message}`)
    }
  }

  private shouldRetry(error: AxiosError): boolean {
    // Retry on network errors or 5xx status codes
    return !error.response || error.response.status >= 500
  }

  private getOptimizationLevel(constraints?: OptimizationRequest['constraints']): 'cheap' | 'normal' | 'explore' {
    if (!constraints) return 'normal'
    
    // Determine based on constraints
    if (constraints.cost_cap_usd && constraints.cost_cap_usd < 0.01) {
      return 'cheap'
    }
    
    if (constraints.max_variants && constraints.max_variants > 5) {
      return 'explore'
    }
    
    if (constraints.latency_cap_ms && constraints.latency_cap_ms < 1000) {
      return 'cheap'
    }
    
    return 'normal'
  }

  private async executeVariants(
    variants: PromptVariant[],
    traceId: string,
  ): Promise<Array<{ variant: PromptVariant; response: string }>> {
    logger.info('Executing variants through LLM Runner', { traceId, count: variants.length })

    const results: Array<{ variant: PromptVariant; response: string }> = []

    // Determine which LLM Runner to use based on available API keys
    const llmRunnerUrl = this.getLLMRunnerUrl()
    if (!llmRunnerUrl) {
      logger.error('No LLM Runner available - check API keys', undefined, { traceId })
      throw new Error(
        'No LLM provider configured. Please set OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_AI_API_KEY in .env',
      )
    }

    // Execute variants in parallel (with concurrency limit)
    const concurrencyLimit = 3
    for (let i = 0; i < variants.length; i += concurrencyLimit) {
      const batch = variants.slice(i, i + concurrencyLimit)
      const batchPromises = batch.map(async (variant) => {
        try {
          const response = await this.callLLMRunner(llmRunnerUrl, variant, traceId)
          return { variant, response }
        } catch (error) {
          logger.error(`Failed to execute variant ${variant.id}`, error as Error)
          // Return error response instead of throwing
          return {
            variant,
            response: `Error executing variant: ${(error as Error).message}`,
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)
    }

    return results
  }

  private getLLMRunnerUrl(): string | null {
    // Check which API keys are available
    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_RUNNER_URL || 'http://localhost:4001'
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_RUNNER_URL || 'http://localhost:4002'
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      return process.env.GOOGLE_RUNNER_URL || 'http://localhost:4003'
    }
    return null
  }

  private async callLLMRunner(
    llmRunnerUrl: string,
    variant: PromptVariant,
    traceId: string,
  ): Promise<string> {
    const url = `${llmRunnerUrl}/run`
    const startTime = Date.now()

    try {
      const response = await axios.post(
        url,
        {
          variant,
          trace_id: traceId,
        },
        {
          timeout: 30000, // 30 second timeout for LLM calls
          headers: {
            'Content-Type': 'application/json',
            'X-Trace-ID': traceId,
          },
        },
      )

      const latency = Date.now() - startTime
      logger.debug(`LLM call completed for variant ${variant.id} in ${latency}ms`)

      if (response.data && response.data.response) {
        return response.data.response
      } else {
        throw new Error('Invalid response from LLM Runner')
      }
    } catch (error) {
      const latency = Date.now() - startTime
      const axiosError = error as AxiosError

      logger.error(`LLM Runner call failed for variant ${variant.id}`, undefined, {
        status: axiosError.response?.status,
        error: axiosError.message,
        latency,
        url,
      })

      throw new Error(`LLM call failed: ${axiosError.message}`)
    }
  }

  private async evaluateVariants(
    variantResponses: Array<{ variant: PromptVariant; response: string }>,
    taskMeta: TaskClassification,
    referenceOutput?: string,
    traceId?: string,
  ): Promise<EvaluationResult[]> {
    const evaluations: EvaluationResult[] = []

    for (const { variant, response } of variantResponses) {
      try {
        const evalResult = await this.callService('evaluator', '/evaluate', {
          variant,
          response,
          task_meta: taskMeta,
          references: referenceOutput ? [referenceOutput] : undefined,
          trace_id: traceId,
        })

        evaluations.push(evalResult.data)
      } catch (error) {
        logger.error(`Evaluation failed for variant ${variant.id}`, error as Error)
        // Provide a default evaluation
        evaluations.push({
          variant_id: variant.id,
          scores: {
            g_eval: 0.5,
            chat_eval: 0.5,
            self_consistency: 0.5,
          },
          final_score: 0.5,
          confidence_interval: [0.4, 0.6],
        })
      }
    }

    return evaluations
  }
}
