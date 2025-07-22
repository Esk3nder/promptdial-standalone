import { PromptDial } from '../index'
import { testPrompt } from './clients'
import type { TestResult, ModelProvider } from './types'
import { TestEventEmitter, PerformanceTestEvent } from './runner-events'
const uuidv4 = () => Math.random().toString(36).substring(2) + Date.now().toString(36)

interface StreamingTestOptions {
  targetModel?: 'gpt-4' | 'claude-3-opus' | 'gemini-pro'
  optimizationLevel?: 'basic' | 'advanced' | 'expert'
  onEvent?: (event: PerformanceTestEvent) => void
}

export class StreamingTestRunner {
  private emitter: TestEventEmitter
  private testId: string

  constructor() {
    this.emitter = new TestEventEmitter()
    this.testId = uuidv4()
  }

  private emit<T extends PerformanceTestEvent['type']>(
    type: T,
    data: Omit<Extract<PerformanceTestEvent, { type: T }>, 'timestamp' | 'testId' | 'type'>
  ) {
    const fullEvent = {
      ...data,
      type,
      timestamp: new Date(),
      testId: this.testId
    } as PerformanceTestEvent
    
    this.emitter.emit(type, fullEvent)
  }

  onEvent(listener: (event: PerformanceTestEvent) => void) {
    const eventTypes: PerformanceTestEvent['type'][] = [
      'test_started', 'provider_test_started', 'provider_test_completed',
      'optimization_started', 'optimization_completed', 'test_completed', 'test_error'
    ]
    
    eventTypes.forEach(type => {
      this.emitter.on(type, listener)
    })
  }

  async runTest(prompt: string, options: StreamingTestOptions = {}) {
    const {
      targetModel = 'gpt-4',
      optimizationLevel = 'advanced',
      onEvent
    } = options

    if (onEvent) {
      this.onEvent(onEvent)
    }

    try {
      // Emit test started
      this.emit('test_started', {
        prompt,
        targetModel,
        optimizationLevel
      })

      // Test original prompt across all providers
      const providers: ModelProvider[] = ['openai', 'anthropic', 'google']
      const originalResults: Record<ModelProvider, TestResult> = {} as any

      for (const provider of providers) {
        this.emit('provider_test_started', {
          provider,
          variant: 'original'
        })

        const result = await testPrompt(provider, prompt)
        originalResults[provider] = result

        this.emit('provider_test_completed', {
          provider,
          variant: 'original',
          result
        })
      }

      // Optimize prompt
      this.emit('optimization_started', {})
      
      const promptDial = new PromptDial()
      const optimizationResult = await promptDial.optimize({
        prompt,
        targetModel,
        optimizationLevel
      })

      this.emit('optimization_completed', {
        variantCount: optimizationResult.variants.length
      })

      // Test optimized variants
      const optimizedResults: Array<{
        variant: string
        results: Record<ModelProvider, TestResult>
        quality: number
      }> = []
      
      for (let i = 0; i < optimizationResult.variants.length; i++) {
        const variant = optimizationResult.variants[i]
        const variantResults: Record<ModelProvider, TestResult> = {} as any

        for (const provider of providers) {
          this.emit('provider_test_started', {
            provider,
            variant: i
          })

          const result = await testPrompt(provider, variant.optimizedPrompt)
          variantResults[provider] = result

          this.emit('provider_test_completed', {
            provider,
            variant: i,
            result
          })
        }

        optimizedResults.push({
          variant: variant.optimizedPrompt,
          results: variantResults,
          quality: variant.quality?.score || 0
        })
      }

      // Calculate summary
      const improvements = this.calculateImprovements(originalResults, optimizedResults)
      const bestVariantIndex = optimizedResults.reduce((best, current, index) => 
        current.quality > optimizedResults[best].quality ? index : best, 0)

      this.emit('test_completed', {
        summary: {
          bestVariantIndex,
          averageImprovement: improvements
        }
      })

      return {
        original: originalResults,
        optimized: optimizedResults,
        variants: optimizationResult.variants,
        summary: {
          bestVariantIndex,
          averageImprovement: improvements
        }
      }

    } catch (error) {
      this.emit('test_error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      throw error
    }
  }

  private calculateImprovements(
    original: Record<ModelProvider, TestResult>,
    optimized: Array<{ results: Record<ModelProvider, TestResult> }>
  ) {
    const providers: ModelProvider[] = ['openai', 'anthropic', 'google']
    let totalTimeImprovement = 0
    let totalTokenImprovement = 0
    let validComparisons = 0

    optimized.forEach(opt => {
      providers.forEach(provider => {
        const originalResult = original[provider]
        const optimizedResult = opt.results[provider]
        
        if (!originalResult.error && !optimizedResult.error) {
          totalTimeImprovement += (originalResult.responseTime - optimizedResult.responseTime) / originalResult.responseTime * 100
          totalTokenImprovement += (originalResult.tokenCount - optimizedResult.tokenCount) / originalResult.tokenCount * 100
          validComparisons++
        }
      })
    })

    return {
      responseTime: validComparisons > 0 ? totalTimeImprovement / validComparisons : 0,
      tokenCount: validComparisons > 0 ? totalTokenImprovement / validComparisons : 0
    }
  }
}