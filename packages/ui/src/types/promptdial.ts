// Temporary types until core package is properly built
export interface OptimizationRequest {
  prompt: string
  targetModel: string
  optimizationLevel: 'basic' | 'advanced' | 'expert'
  taskType?: 'creative' | 'analytical' | 'coding' | 'general'
  constraints?: {
    maxLength?: number
    format?: string
    tone?: string
  }
}

export interface OptimizedVariant {
  id: string
  originalPrompt: string
  optimizedPrompt: string
  changes: Array<{
    type: string
    description: string
  }>
  modelSpecificFeatures: string[]
  estimatedTokens: number
  quality?: ValidationResult
  formatted?: {
    markdown: string
    technique_name: string
    technique_category: string
    transformations: string[]
  }
}

export interface ValidationResult {
  score: number
  factors: QualityFactors
  suggestions: string[]
  improvementPercentage: number
}

export interface QualityFactors {
  clarity: number
  specificity: number
  structure: number
  completeness: number
  efficiency: number
  modelAlignment: number
  safety: number
}

export interface OptimizedResult {
  variants: OptimizedVariant[]
  request: OptimizationRequest
  summary: {
    totalVariants: number
    bestScore?: number
    averageScore?: number
  }
}

export interface PromptDialOptions {
  autoValidate?: boolean
  sortByQuality?: boolean
}

export class PromptDial {
  constructor(options?: PromptDialOptions) {}

  async optimize(request: OptimizationRequest): Promise<OptimizedResult> {
    // This will use the API endpoint instead
    const response = await fetch('/api/optimize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Optimization failed')
    }

    return response.json()
  }
}
