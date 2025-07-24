import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FewShotCoTTechnique } from '../src/techniques/few-shot-cot'
import {
  createTestTaskClassification,
  createTestBudgetConstraints,
  TECHNIQUES,
} from '@promptdial/shared'

// Mock dependencies
vi.mock('@promptdial/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@promptdial/shared')>()
  return {
    ...actual,
    generateVariantId: (technique: string, index: number) => `${technique}_${index}`,
    estimateTokens: (prompt: string) => Math.ceil(prompt.length / 4),
    estimateCost: (tokens: number) => tokens * 0.00002,
  }
})

describe('FewShotCoTTechnique', () => {
  let technique: FewShotCoTTechnique

  beforeEach(() => {
    technique = new FewShotCoTTechnique()
  })

  describe('properties', () => {
    it('should have correct metadata', () => {
      expect(technique.name).toBe(TECHNIQUES.FEW_SHOT_COT)
      expect(technique.description).toBe('Few-shot learning with chain-of-thought reasoning')
      expect(technique.best_for).toEqual(['math_reasoning', 'code_generation', 'data_analysis'])
      expect(technique.needs_retrieval).toBe(false)
    })
  })

  describe('generate', () => {
    it('should generate variants for math reasoning', async () => {
      const basePrompt = 'If a car travels 60 miles in 1.5 hours, what is its speed?'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        complexity: 0.5,
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.1,
        max_tokens: 2000,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      expect(variants.length).toBeGreaterThan(0)
      expect(variants[0].technique).toContain('FewShot_CoT')
      expect(variants[0].prompt).toContain('step by step')
      expect(variants[0].prompt).toContain(basePrompt)

      // Should include examples
      expect(variants[0].prompt).toMatch(/Q:.*A:.*Let's think step by step/s)
    })

    it('should generate variants for code generation', async () => {
      const basePrompt = 'Write a function to find the factorial of a number'
      const classification = createTestTaskClassification({
        task_type: 'code_generation',
        complexity: 0.6,
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.1,
        max_tokens: 2000,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      expect(variants.length).toBeGreaterThan(0)

      // Should include code examples
      const firstVariant = variants[0]
      expect(firstVariant.prompt).toContain('def')
      expect(firstVariant.prompt).toContain('function')
    })

    it('should generate multiple variants with sufficient budget', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        complexity: 0.8,
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 1.0, // Large budget
        max_tokens: 5000,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      expect(variants.length).toBeGreaterThanOrEqual(2)

      // Check for different variant types
      const variantTypes = new Set(variants.map((v) => v.technique))
      expect(variantTypes.size).toBeGreaterThanOrEqual(2)
    })

    it('should respect budget constraints', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.0001, // Very small budget
        max_tokens: 100,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      // Should generate no variants due to budget constraints
      expect(variants).toHaveLength(0)
    })

    it('should use general examples for unsupported task types', async () => {
      const basePrompt = 'Explain quantum computing'
      const classification = createTestTaskClassification({
        task_type: 'unknown_task_type' as any,
      })
      const budget = createTestBudgetConstraints()

      const variants = await technique.generate(basePrompt, classification, budget)

      expect(variants.length).toBeGreaterThan(0)
      // Should fall back to general_qa examples
      expect(variants[0].prompt).toContain('step by step')
    })

    it('should create extended variant for complex tasks', async () => {
      const basePrompt = 'Solve this complex problem'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        complexity: 0.9, // High complexity
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.5,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      // Find extended variant
      const extendedVariant = variants.find((v) => v.technique.includes('extended'))
      expect(extendedVariant).toBeDefined()

      // Should have complexity hint
      expect(extendedVariant?.prompt).toContain('complex')
      expect(extendedVariant?.prompt).toContain('thorough')
    })

    it('should create formatted variant with lower temperature', async () => {
      const basePrompt = 'Calculate something'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.5,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      // Find formatted variant
      const formattedVariant = variants.find((v) => v.technique.includes('formatted'))
      expect(formattedVariant).toBeDefined()

      // Should have lower temperature for structured output
      expect(formattedVariant?.temperature).toBe(0.5)

      // Should have format structure
      expect(formattedVariant?.prompt).toContain('REASONING:')
      expect(formattedVariant?.prompt).toContain('ANSWER:')
    })
  })

  describe('example selection', () => {
    it('should include appropriate examples for math tasks', async () => {
      const basePrompt = 'Solve: 3x + 7 = 22'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints()

      const variants = await technique.generate(basePrompt, classification, budget)

      const basicVariant = variants[0]
      // Should include math examples
      expect(basicVariant.prompt).toContain('train travels')
      expect(basicVariant.prompt).toContain('rectangle')
    })

    it('should include appropriate examples for code tasks', async () => {
      const basePrompt = 'Write a sorting algorithm'
      const classification = createTestTaskClassification({
        task_type: 'code_generation',
      })
      const budget = createTestBudgetConstraints()

      const variants = await technique.generate(basePrompt, classification, budget)

      const basicVariant = variants[0]
      // Should include code examples
      expect(basicVariant.prompt).toContain('is_prime')
      expect(basicVariant.prompt).toContain('reverse_string')
    })
  })

  describe('prompt construction', () => {
    it('should sandwich prompts with system instructions', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints()

      const variants = await technique.generate(basePrompt, classification, budget)

      expect(variants[0].prompt).toContain('<<SYS>>')
      expect(variants[0].prompt).toContain('<<USER>>')
      expect(variants[0].prompt).toContain('<<END>>')
    })

    it('should use correct number of examples based on complexity', async () => {
      const basePrompt = 'Complex problem'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        complexity: 0.8, // High complexity
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.5,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      // Find extended variant
      const extendedVariant = variants.find((v) => v.technique.includes('extended'))
      expect(extendedVariant).toBeDefined()

      // Should have Example 1, Example 2, Example 3 for high complexity
      expect(extendedVariant?.prompt).toContain('Example 1:')
      expect(extendedVariant?.prompt).toContain('Example 2:')
      expect(extendedVariant?.prompt).toContain('Example 3:')
    })
  })
})
