export type ModelProvider = 'openai' | 'anthropic' | 'google'

export interface TestResult {
  success: boolean
  responseTime: number
  tokenCount: number
  error: string | null
  responseText?: string
}

export interface ProviderResults {
  openai: TestResult
  anthropic: TestResult
  google: TestResult
}

export interface OptimizedVariantResult {
  variant: string
  results: ProviderResults
  quality: number
}

export interface TestRunResults {
  original: ProviderResults
  optimized: OptimizedVariantResult[]
}

export interface TestOptions {
  targetModel?: string
  optimizationLevel?: 'basic' | 'advanced' | 'expert'
  providers?: ModelProvider[]
}

export interface ServiceTrace {
  service: string
  method: string
  requestTime: Date
  responseTime: Date
  duration: number
  request: any
  response: any
  error?: string
}