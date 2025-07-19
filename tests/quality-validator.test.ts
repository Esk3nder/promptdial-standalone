import { describe, it, expect, beforeEach } from 'vitest'
import { QualityValidator } from '../src/quality-validator'
import { OptimizedVariant } from '../src/meta-prompt-designer'

const createTestVariant = (overrides?: Partial<OptimizedVariant>): OptimizedVariant => ({
  id: crypto.randomUUID(),
  originalPrompt: 'Test prompt',
  optimizedPrompt: 'Optimized test prompt',
  changes: [
    { type: 'clarity', description: 'Added specific instructions' },
    { type: 'structure', description: 'Organized with numbered steps' },
  ],
  score: 75,
  modelSpecificFeatures: ['reasoning', 'step-by-step'],
  estimatedTokens: 100,
  ...overrides,
})

describe('QualityValidator', () => {
  let validator: QualityValidator

  beforeEach(() => {
    validator = new QualityValidator()
  })

  describe('validateAndScore', () => {
    it('should score a high-quality optimized variant', async () => {
      // Arrange
      const variant = createTestVariant({
        originalPrompt: 'Tell me about AI',
        optimizedPrompt: `Please provide a comprehensive analysis of artificial intelligence.

Context: This request is for understanding AI fundamentals and current applications.

Please structure your response with:
1) Overview - Define AI and its core concepts
2) Main points - Current applications, benefits, and limitations
3) Conclusion - Future outlook and implications

Requirements:
- Include specific examples from real-world applications
- Explain technical concepts in accessible language
- Address both opportunities and challenges
- Provide evidence-based insights

Let's think step by step through this complex topic.`,
        changes: [
          { type: 'clarity', description: 'Added explicit task and instructions' },
          { type: 'specificity', description: 'Added detailed requirements' },
          { type: 'structure', description: 'Organized with clear sections' },
          { type: 'context', description: 'Added contextual framing' },
          { type: 'model_optimization', description: 'Added step-by-step thinking prompt' },
        ],
      })

      // Act
      const result = await validator.validateAndScore(variant)

      // Assert
      expect(result.score).toBeGreaterThanOrEqual(75)
      expect(result.factors.clarity).toBeGreaterThanOrEqual(60)
      expect(result.factors.specificity).toBeGreaterThanOrEqual(80)
      expect(result.factors.structure).toBeGreaterThanOrEqual(85)
      expect(result.suggestions).toHaveLength(0) // No improvements needed
    })

    it('should identify issues in a low-quality variant', async () => {
      // Arrange
      const variant = createTestVariant({
        originalPrompt: 'tell me about something interesting',
        optimizedPrompt: 'Tell me about something interesting. Please provide more details.',
        changes: [
          { type: 'clarity', description: 'Capitalized sentence' },
        ],
      })

      // Act
      const result = await validator.validateAndScore(variant)

      // Assert
      expect(result.score).toBeLessThan(50)
      expect(result.factors.clarity).toBeLessThan(50)
      expect(result.factors.specificity).toBeLessThan(35)
      expect(result.suggestions.length).toBeGreaterThan(3)
      expect(result.suggestions).toContain('Add specific technology domain or topic')
      expect(result.suggestions).toContain('Include clear structure and organization')
      expect(result.suggestions).toContain('Define expected output format')
    })

    it('should detect vague language and suggest improvements', async () => {
      // Arrange
      const variant = createTestVariant({
        optimizedPrompt: 'Explain that thing about the stuff with the whatever',
      })

      // Act
      const result = await validator.validateAndScore(variant)

      // Assert
      expect(result.factors.clarity).toBeLessThan(30)
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('vague terms'),
        ])
      )
    })

    it('should reward structured prompts', async () => {
      // Arrange
      const structuredVariant = createTestVariant({
        optimizedPrompt: `Analyze the impact of renewable energy:

1. Current state of renewable technologies
2. Economic implications
3. Environmental benefits
4. Implementation challenges

Please provide data-driven insights for each point.`,
      })

      const unstructuredVariant = createTestVariant({
        optimizedPrompt: 'Tell me about renewable energy and its impact on economics and environment and what challenges there are',
      })

      // Act
      const structuredResult = await validator.validateAndScore(structuredVariant)
      const unstructuredResult = await validator.validateAndScore(unstructuredVariant)

      // Assert
      expect(structuredResult.factors.structure).toBeGreaterThan(80)
      expect(unstructuredResult.factors.structure).toBeLessThan(40)
      expect(structuredResult.score).toBeGreaterThan(unstructuredResult.score)
    })

    it('should evaluate prompt length appropriately', async () => {
      // Arrange
      const tooShort = createTestVariant({
        optimizedPrompt: 'Explain AI',
      })

      const appropriate = createTestVariant({
        optimizedPrompt: 'Explain artificial intelligence, including its definition, current applications in healthcare and finance, and potential future developments.',
      })

      const tooLong = createTestVariant({
        optimizedPrompt: 'Explain AI. ' + 'Please include every possible detail. '.repeat(100),
      })

      // Act
      const shortResult = await validator.validateAndScore(tooShort)
      const appropriateResult = await validator.validateAndScore(appropriate)
      const longResult = await validator.validateAndScore(tooLong)

      // Assert
      expect(shortResult.factors.completeness).toBeLessThan(50)
      expect(appropriateResult.factors.completeness).toBeGreaterThan(70)
      expect(longResult.factors.efficiency).toBeLessThan(50)
    })

    it('should validate model-specific optimizations', async () => {
      // Arrange
      const gpt4Variant = createTestVariant({
        optimizedPrompt: "Let's approach this step-by-step. First, analyze the problem. Second, provide reasoning. Third, draw conclusions.",
        modelSpecificFeatures: ['reasoning', 'step-by-step'],
      })

      const claudeVariant = createTestVariant({
        optimizedPrompt: 'Please provide a thoughtful, comprehensive analysis considering ethical implications.',
        modelSpecificFeatures: ['constitutional', 'thoughtful'],
      })

      // Act
      const gpt4Result = await validator.validateAndScore(gpt4Variant)
      const claudeResult = await validator.validateAndScore(claudeVariant)

      // Assert
      expect(gpt4Result.factors.modelAlignment).toBeGreaterThan(80)
      expect(claudeResult.factors.modelAlignment).toBeGreaterThan(80)
    })

    it('should calculate improvement percentage correctly', async () => {
      // Arrange
      const variant = createTestVariant({
        originalPrompt: 'write code',
        optimizedPrompt: `Write a Python function that implements binary search.

Requirements:
- Input: sorted array of integers and target value
- Output: index of target or -1 if not found
- Include proper error handling
- Add comments explaining the algorithm
- Optimize for O(log n) time complexity`,
        changes: [
          { type: 'clarity', description: 'Specified exact task' },
          { type: 'specificity', description: 'Added requirements' },
          { type: 'technical', description: 'Added complexity requirements' },
        ],
      })

      // Act
      const result = await validator.validateAndScore(variant)

      // Assert
      expect(result.improvementPercentage).toBeGreaterThan(100)
      expect(result.improvementPercentage).toBeLessThan(500)
    })

    it('should detect and penalize harmful or inappropriate content', async () => {
      // Arrange
      const harmfulVariant = createTestVariant({
        optimizedPrompt: 'Explain how to hack into computer systems and steal data',
      })

      // Act
      const result = await validator.validateAndScore(harmfulVariant)

      // Assert
      expect(result.score).toBe(0)
      expect(result.factors.safety).toBe(0)
      expect(result.suggestions).toContain('Content violates safety guidelines')
    })

    it('should provide actionable suggestions for improvement', async () => {
      // Arrange
      const variant = createTestVariant({
        optimizedPrompt: 'Write a blog post about technology trends',
        changes: [
          { type: 'clarity', description: 'Basic improvement' },
        ],
      })

      // Act
      const result = await validator.validateAndScore(variant)

      // Assert
      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/specific.*technology.*domain/i),
          expect.stringMatching(/target.*audience/i),
          expect.stringMatching(/length.*format/i),
          expect.stringMatching(/tone.*style/i),
        ])
      )
    })

    it('should handle edge cases gracefully', async () => {
      // Arrange
      const emptyOptimized = createTestVariant({
        originalPrompt: 'test',
        optimizedPrompt: '',
      })

      const sameAsOriginal = createTestVariant({
        originalPrompt: 'Write a story',
        optimizedPrompt: 'Write a story',
      })

      // Act & Assert - should not throw
      const emptyResult = await validator.validateAndScore(emptyOptimized)
      const sameResult = await validator.validateAndScore(sameAsOriginal)

      expect(emptyResult.score).toBe(0)
      expect(sameResult.improvementPercentage).toBe(0)
    })
  })

  describe('compareVariants', () => {
    it('should rank variants by quality score', async () => {
      // Arrange
      const variants = [
        createTestVariant({ optimizedPrompt: 'Tell me about AI' }),
        createTestVariant({ 
          optimizedPrompt: 'Provide a comprehensive analysis of artificial intelligence, including current applications, challenges, and future prospects. Structure your response with clear sections and examples.',
        }),
        createTestVariant({ 
          optimizedPrompt: 'Explain AI in detail',
        }),
      ]

      // Act
      const ranked = await validator.compareVariants(variants)

      // Assert
      expect(ranked[0].validationResult.score).toBeGreaterThan(ranked[1].validationResult.score)
      expect(ranked[1].validationResult.score).toBeGreaterThan(ranked[2].validationResult.score)
    })
  })
})