export interface TestResult {
  responseTime: number
  tokenCount: number
  responseText: string
  error?: string
}

export interface TestComparison {
  original: TestResult
  optimized: TestResult[]
  improvement: {
    responseTime: number
    tokenCount: number
  }
}

export type ModelProvider = 'openai' | 'anthropic' | 'google'