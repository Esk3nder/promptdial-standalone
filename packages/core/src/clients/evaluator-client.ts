import { ServiceClient, ServiceClientOptions } from './base-client'
import { 
  EvaluationRequest,
  EvaluationResponse,
  EvaluationMethod,
  CalibrationMetrics,
  PromptVariant
} from '@promptdial/shared'
import { toEvaluationMethod } from '../adapters/type-adapters'

export class EvaluatorClient extends ServiceClient {
  constructor(baseUrl: string, options?: ServiceClientOptions) {
    super('Evaluator', baseUrl, options)
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    return this.request<EvaluationResponse>('POST', '/evaluate', request)
  }

  async evaluateSingle(prompt: string, method: string = 'g-eval'): Promise<{
    score: number
    confidence: { low: number; high: number }
    explanation?: string
  }> {
    const variant: PromptVariant = {
      id: 'single',
      technique: 'direct',
      prompt,
      temperature: 0.7,
      est_tokens: 100,
      cost_usd: 0.001
    }
    
    const response = await this.evaluate({
      prompt_id: 'single-eval',
      variants: [variant],
      evaluation_methods: [toEvaluationMethod(method)]
    })
    
    if (response.success && response.data) {
      return {
        score: response.data.final_score || 0,
        confidence: {
          low: response.data.confidence_interval?.[0] || 0,
          high: response.data.confidence_interval?.[1] || 1
        },
        explanation: `Evaluation score: ${response.data.final_score}`
      }
    }
    
    return {
      score: 0,
      confidence: { low: 0, high: 1 },
      explanation: 'Evaluation failed'
    }
  }

  async getCalibrationMetrics(): Promise<CalibrationMetrics> {
    return this.request<CalibrationMetrics>('GET', '/calibration/metrics')
  }

  async checkCalibration(threshold: number = 0.8): Promise<boolean> {
    const metrics = await this.getCalibrationMetrics()
    return (metrics.accuracy || 0) >= threshold
  }

  async recalibrate(goldData: Array<{ prompt: string; expectedScore: number }>): Promise<void> {
    await this.request('POST', '/calibration/recalibrate', { goldData })
  }
}