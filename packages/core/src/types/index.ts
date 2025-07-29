// Re-export types from shared with some extensions for core functionality
export * from '@promptdial/shared'

// Extended types for core package
export interface ExtendedPromptVariant {
  id: string
  technique: string
  prompt: string
  temperature: number
  est_tokens: number
  cost_usd: number
  model?: string
  model_params?: {
    temperature?: number
    max_tokens?: number
    top_p?: number
  }
  // Extended properties for core functionality
  score?: number
  quality?: any
  latency?: number
  originalPrompt?: string
}