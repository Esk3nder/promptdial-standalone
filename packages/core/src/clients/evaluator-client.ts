import { ServiceClient, ServiceClientOptions } from './base-client'
import { 
  EvaluationRequest,
  EvaluationResponse,
  EvaluationMethod,
  CalibrationMetrics
} from '@promptdial/shared'

export class EvaluatorClient extends ServiceClient {
  constructor(baseUrl: string, options?: ServiceClientOptions) {
    super('Evaluator', baseUrl, options)
  }

  async evaluate(request: EvaluationRequest): Promise<EvaluationResponse> {
    return this.request<EvaluationResponse>('POST', '/evaluate', request)
  }

  async evaluateSingle(prompt: string, method: EvaluationMethod = 'g-eval'): Promise<{
    score: number
    confidence: { low: number; high: number }
    explanation?: string
  }> {
    const response = await this.evaluate({
      variants: [{ id: 'single', prompt, score: 0 }],
      method,
      includeConfidenceIntervals: true
    })
    
    return response.results[0]
  }

  async getCalibrationMetrics(): Promise<CalibrationMetrics> {
    return this.request<CalibrationMetrics>('GET', '/calibration/metrics')
  }

  async checkCalibration(threshold: number = 0.8): Promise<boolean> {
    const metrics = await this.getCalibrationMetrics()
    return metrics.spearmanRho >= threshold
  }

  async recalibrate(goldData: Array<{ prompt: string; expectedScore: number }>): Promise<void> {
    await this.request('POST', '/calibration/recalibrate', { goldData })
  }
}