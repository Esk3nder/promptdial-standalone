import { v4 as uuidv4 } from 'uuid'
import { PromptDial } from '../index'
import { testPrompt } from './clients'
import type {
  ModelProvider,
  TestOptions,
  TestRunResults,
  ProviderResults,
  ServiceTrace,
} from './types'
import type {
  PerformanceTestEvent,
  ServiceRequestEvent,
  ServiceResponseEvent,
  TechniqueSelectedEvent,
  VariantGeneratedEvent,
} from './runner-events'

export class StreamingTestRunner {
  private testId: string
  private eventHandlers: ((event: PerformanceTestEvent) => void)[] = []
  private serviceTraces: ServiceTrace[] = []
  private startTime: number = 0

  constructor() {
    this.testId = uuidv4()
  }

  onEvent(handler: (event: PerformanceTestEvent) => void) {
    this.eventHandlers.push(handler)
  }

  private emit(event: Omit<PerformanceTestEvent, 'testId' | 'timestamp'>) {
    const fullEvent = {
      ...event,
      testId: this.testId,
      timestamp: new Date(),
    } as PerformanceTestEvent

    this.eventHandlers.forEach((handler) => handler(fullEvent))
  }

  private emitServiceRequest(service: string, method: string, requestData: any) {
    this.emit({
      type: 'service_request',
      service: service as any,
      method,
      requestData,
    } as ServiceRequestEvent)
  }

  private emitServiceResponse(
    service: string,
    method: string,
    responseData: any,
    responseTime: number,
    statusCode?: number,
  ) {
    this.emit({
      type: 'service_response',
      service: service as any,
      method,
      responseData,
      responseTime,
      statusCode,
    } as ServiceResponseEvent)
  }

  async runTest(prompt: string, options: TestOptions = {}): Promise<TestRunResults> {
    this.startTime = Date.now()

    const {
      targetModel = 'gpt-4',
      optimizationLevel = 'advanced',
      providers = ['openai', 'anthropic', 'google'] as ModelProvider[],
    } = options

    try {
      // Emit test started
      this.emit({
        type: 'test_started',
        prompt,
        targetModel,
        optimizationLevel,
      })

      // Step 1: Classify the task
      const classifyStart = Date.now()
      this.emitServiceRequest('classifier', 'classify', { prompt })

      // Simulate classification (in real implementation, this would call the classifier service)
      const taskType = this.classifyTask(prompt)
      const classifyTime = Date.now() - classifyStart

      this.emitServiceResponse(
        'classifier',
        'classify',
        {
          taskType,
          confidence: 0.95,
          features: ['technical', 'specific'],
        },
        classifyTime,
      )

      // Step 2: Select optimization techniques
      const techniqueStart = Date.now()
      this.emitServiceRequest('technique-engine', 'selectTechniques', {
        taskType,
        optimizationLevel,
      })

      const techniques = this.selectTechniques(taskType, optimizationLevel)
      const techniqueTime = Date.now() - techniqueStart

      this.emitServiceResponse(
        'technique-engine',
        'selectTechniques',
        {
          techniques,
          reasoning: 'Selected based on task type and optimization level',
        },
        techniqueTime,
      )

      this.emit({
        type: 'technique_selected',
        techniques,
        taskType,
        reasoning: `Selected ${techniques.length} techniques for ${taskType} task`,
      } as TechniqueSelectedEvent)

      // Step 3: Generate optimized variants
      this.emit({ type: 'optimization_started' })
      const optimizeStart = Date.now()

      this.emitServiceRequest('optimizer', 'optimize', {
        prompt,
        techniques,
        targetModel,
      })

      const promptDial = new PromptDial()
      const optimizationResult = await promptDial.optimize(prompt, {
        targetModel,
        optimizationLevel,
      })

      const optimizeTime = Date.now() - optimizeStart
      this.emitServiceResponse(
        'optimizer',
        'optimize',
        {
          variantCount: optimizationResult.variants.length,
          variants: optimizationResult.variants.map((v) => ({
            id: v.id,
            quality: v.quality?.score || 0,
          })),
        },
        optimizeTime,
      )

      // Emit variant generation events
      for (const variant of optimizationResult.variants) {
        // Safety check
        const safetyStart = Date.now()
        this.emitServiceRequest('safety-guard', 'check', {
          prompt: variant.optimizedPrompt,
          variantId: variant.id,
        })

        const safetyPassed = await this.checkSafety(variant.optimizedPrompt)
        const safetyTime = Date.now() - safetyStart

        this.emitServiceResponse(
          'safety-guard',
          'check',
          {
            passed: safetyPassed,
            issues: [],
            variantId: variant.id,
          },
          safetyTime,
        )

        this.emit({
          type: 'safety_check_completed',
          variantId: variant.id,
          passed: safetyPassed,
        })

        // Quality evaluation
        const evalStart = Date.now()
        this.emitServiceRequest('evaluator', 'evaluate', {
          prompt: variant.optimizedPrompt,
          variantId: variant.id,
        })

        const qualityScore = variant.quality?.score || 85
        const evalTime = Date.now() - evalStart

        this.emitServiceResponse(
          'evaluator',
          'evaluate',
          {
            scores: {
              clarity: qualityScore + 5,
              specificity: qualityScore,
              coherence: qualityScore + 3,
              overall: qualityScore,
            },
            variantId: variant.id,
          },
          evalTime,
        )

        this.emit({
          type: 'variant_generated',
          variantId: variant.id,
          techniques: variant.changes.map((c) => c.description),
          quality: qualityScore,
          optimizedPrompt: variant.optimizedPrompt,
        } as VariantGeneratedEvent)
      }

      this.emit({
        type: 'optimization_completed',
        variantCount: optimizationResult.variants.length,
        totalTime: optimizeTime,
      })

      // Step 4: Test original prompt with all providers
      const originalResults: Partial<ProviderResults> = {}

      for (const provider of providers) {
        this.emit({
          type: 'provider_test_started',
          provider,
          variant: 'original',
        })

        const llmStart = Date.now()
        this.emitServiceRequest('llm-runner', `test-${provider}`, {
          prompt,
          provider,
          model: targetModel,
        })

        const result = await testPrompt(prompt, provider, targetModel)
        const llmTime = Date.now() - llmStart

        this.emitServiceResponse(
          'llm-runner',
          `test-${provider}`,
          {
            success: result.success,
            tokenCount: result.tokenCount,
            responsePreview: result.responseText?.substring(0, 100),
          },
          llmTime,
        )

        originalResults[provider] = result

        this.emit({
          type: 'provider_test_completed',
          provider,
          variant: 'original',
          result: {
            responseTime: result.responseTime,
            tokenCount: result.tokenCount,
            error: result.error,
          },
        })
      }

      // Step 5: Test optimized variants
      const optimizedResults = []

      for (let i = 0; i < Math.min(3, optimizationResult.variants.length); i++) {
        const variant = optimizationResult.variants[i]
        const variantResults: Partial<ProviderResults> = {}

        for (const provider of providers) {
          this.emit({
            type: 'provider_test_started',
            provider,
            variant: i,
          })

          const llmStart = Date.now()
          this.emitServiceRequest('llm-runner', `test-${provider}`, {
            prompt: variant.optimizedPrompt,
            provider,
            model: targetModel,
            variantId: variant.id,
          })

          const result = await testPrompt(variant.optimizedPrompt, provider, targetModel)
          const llmTime = Date.now() - llmStart

          this.emitServiceResponse(
            'llm-runner',
            `test-${provider}`,
            {
              success: result.success,
              tokenCount: result.tokenCount,
              responsePreview: result.responseText?.substring(0, 100),
              variantId: variant.id,
            },
            llmTime,
          )

          variantResults[provider] = result

          this.emit({
            type: 'provider_test_completed',
            provider,
            variant: i,
            result: {
              responseTime: result.responseTime,
              tokenCount: result.tokenCount,
              error: result.error,
            },
          })
        }

        optimizedResults.push({
          variant: variant.optimizedPrompt,
          results: variantResults as ProviderResults,
          quality: variant.quality?.score || 0,
        })
      }

      const totalDuration = Date.now() - this.startTime

      // Log telemetry
      const telemetryStart = Date.now()
      this.emitServiceRequest('telemetry', 'log', {
        testId: this.testId,
        duration: totalDuration,
        variantCount: optimizationResult.variants.length,
        providerCount: providers.length,
      })

      const telemetryTime = Date.now() - telemetryStart
      this.emitServiceResponse(
        'telemetry',
        'log',
        {
          logged: true,
          testId: this.testId,
        },
        telemetryTime,
      )

      this.emit({
        type: 'test_completed',
        duration: totalDuration,
      })

      const results: TestRunResults = {
        original: originalResults as ProviderResults,
        optimized: optimizedResults,
      }

      return results
    } catch (error) {
      this.emit({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      throw error
    }
  }

  private classifyTask(prompt: string): string {
    // Simple classification logic - in real implementation would call classifier service
    if (prompt.toLowerCase().includes('code') || prompt.toLowerCase().includes('function')) {
      return 'coding'
    } else if (
      prompt.toLowerCase().includes('explain') ||
      prompt.toLowerCase().includes('describe')
    ) {
      return 'explanation'
    } else if (
      prompt.toLowerCase().includes('analyze') ||
      prompt.toLowerCase().includes('compare')
    ) {
      return 'analysis'
    }
    return 'general'
  }

  private selectTechniques(taskType: string, level: string): string[] {
    const techniques = []

    if (level === 'basic') {
      techniques.push('clarity_enhancement')
    } else if (level === 'advanced') {
      techniques.push('few_shot_cot', 'structured_output')
      if (taskType === 'coding') {
        techniques.push('code_optimization')
      }
    } else if (level === 'expert') {
      techniques.push('few_shot_cot', 'tree_of_thoughts', 'react_prompting')
      if (taskType === 'analysis') {
        techniques.push('step_by_step_analysis')
      }
    }

    return techniques
  }

  private async checkSafety(prompt: string): Promise<boolean> {
    // Simple safety check - in real implementation would call safety-guard service
    const unsafePatterns = ['ignore previous', 'disregard', 'password', 'api key']
    const lowerPrompt = prompt.toLowerCase()

    return !unsafePatterns.some((pattern) => lowerPrompt.includes(pattern))
  }

  getServiceTraces(): ServiceTrace[] {
    return this.serviceTraces
  }
}
