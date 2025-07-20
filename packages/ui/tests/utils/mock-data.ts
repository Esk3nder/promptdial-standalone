import type { OptimizedVariant, ValidationResult } from 'promptdial'

export const createMockVariant = (
  overrides: Partial<OptimizedVariant & { quality?: ValidationResult }> = {}
): OptimizedVariant & { quality?: ValidationResult } => ({
  id: '1',
  originalPrompt: 'test prompt',
  optimizedPrompt: 'Please provide a comprehensive and detailed test prompt that clearly articulates the specific requirements and expected outcomes.',
  changes: [
    { type: 'clarity', description: 'Added clear action verb' },
    { type: 'specificity', description: 'Included specific requirements' },
    { type: 'structure', description: 'Organized with clear sections' },
  ],
  modelSpecificFeatures: ['Structured format', 'Clear instructions'],
  estimatedTokens: 45,
  quality: {
    score: 85,
    factors: {
      clarity: 90,
      specificity: 85,
      structure: 88,
      completeness: 82,
      efficiency: 86,
      modelAlignment: 87,
      safety: 100,
    },
    suggestions: [
      'Consider adding specific examples',
      'Could benefit from explicit success criteria',
    ],
    improvementPercentage: 150,
  },
  ...overrides,
})

export const createMockOptimizationResult = (variantCount = 1) => ({
  variants: Array.from({ length: variantCount }, (_, i) =>
    createMockVariant({
      id: String(i + 1),
      quality: {
        score: 85 - i * 5,
        factors: {
          clarity: 90 - i * 5,
          specificity: 85 - i * 5,
          structure: 88 - i * 5,
          completeness: 82 - i * 5,
          efficiency: 86 - i * 5,
          modelAlignment: 87 - i * 5,
          safety: 100,
        },
        suggestions: [],
        improvementPercentage: 150 - i * 10,
      },
    })
  ),
  request: {
    prompt: 'test prompt',
    targetModel: 'gpt-4',
    optimizationLevel: 'basic' as const,
  },
  summary: {
    totalVariants: variantCount,
    bestScore: 85,
    averageScore: variantCount === 1 ? 85 : 80,
  },
})