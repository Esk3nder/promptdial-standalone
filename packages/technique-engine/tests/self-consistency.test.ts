import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  SelfConsistencyTechnique,
  SELF_CONSISTENCY_VOTE_PROMPT,
} from '../src/techniques/self-consistency'
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

describe('SelfConsistencyTechnique', () => {
  let technique: SelfConsistencyTechnique

  beforeEach(() => {
    technique = new SelfConsistencyTechnique()
  })

  describe('properties', () => {
    it('should have correct metadata', () => {
      expect(technique.name).toBe(TECHNIQUES.SELF_CONSISTENCY)
      expect(technique.description).toBe('Multiple reasoning paths with consistency voting')
      expect(technique.best_for).toEqual(['math_reasoning', 'data_analysis', 'general_qa'])
      expect(technique.needs_retrieval).toBe(false)
    })
  })

  describe('generate', () => {
    it('should generate self-consistency variants with multiple samples', async () => {
      const basePrompt =
        'If John is older than Mary, and Mary is older than Tom, who is the youngest?'
      const classification = createTestTaskClassification({
        task_type: 'general_qa',
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.5,
        max_tokens: 3000,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      expect(variants.length).toBeGreaterThan(0)

      // Should have 3-sample variant
      const basicVariant = variants.find((v) => v.technique.includes('3samples'))
      expect(basicVariant).toBeDefined()
      expect(basicVariant?.temperature).toBe(0.8)

      // Cost should be multiplied by number of samples
      expect(basicVariant!.cost_usd).toBeGreaterThan(0.001)

      // Should include self-consistency instructions
      expect(basicVariant?.prompt).toContain('multiple times')
      expect(basicVariant?.prompt).toContain('reasoning paths')
    })

    it('should generate 5-sample variant with sufficient budget', async () => {
      const basePrompt = 'Solve: 2x + 5 = 15'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 1.0,
        max_tokens: 5000,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      // Should have both 3-sample and 5-sample variants
      const basicVariant = variants.find((v) => v.technique.includes('3samples'))
      const enhancedVariant = variants.find((v) => v.technique.includes('5samples'))

      expect(basicVariant).toBeDefined()
      expect(enhancedVariant).toBeDefined()

      // Enhanced variant should have higher temperature
      expect(enhancedVariant?.temperature).toBe(0.9)

      // Enhanced variant should have approach hints
      expect(enhancedVariant?.prompt).toContain('SELF-CONSISTENCY PROTOCOL')
      expect(enhancedVariant?.prompt).toContain('randomly select ONE of these approaches')
    })

    it('should include guided variant for complex problems', async () => {
      const basePrompt = 'Complex math problem'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        complexity: 0.8,
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.5,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      const guidedVariant = variants.find((v) => v.technique.includes('guided'))
      expect(guidedVariant).toBeDefined()
      expect(guidedVariant?.temperature).toBe(0.7)

      // Should have complexity-specific guidance
      expect(guidedVariant?.prompt).toContain('complex problem')
      expect(guidedVariant?.prompt).toContain('Break it into clear sub-problems')
      expect(guidedVariant?.prompt).toContain('REASONING FRAMEWORK')
    })

    it('should return empty array with insufficient budget', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.0001, // Too small for 3 samples
        max_tokens: 100,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      // Need at least 3 samples for self-consistency
      expect(variants).toHaveLength(0)
    })

    it('should provide task-specific approach hints', async () => {
      // Test math reasoning
      const mathPrompt = 'Solve equation'
      const mathClassification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 1.0,
      })

      const mathVariants = await technique.generate(mathPrompt, mathClassification, budget)
      const mathEnhanced = mathVariants.find((v) => v.technique.includes('5samples'))

      expect(mathEnhanced?.prompt).toContain('Algebraic approach')
      expect(mathEnhanced?.prompt).toContain('Working backwards')

      // Test code generation
      const codePrompt = 'Write function'
      const codeClassification = createTestTaskClassification({
        task_type: 'code_generation',
      })

      const codeVariants = await technique.generate(codePrompt, codeClassification, budget)
      const codeEnhanced = codeVariants.find((v) => v.technique.includes('5samples'))

      expect(codeEnhanced?.prompt).toContain('Top-down approach')
      expect(codeEnhanced?.prompt).toContain('Test-driven approach')
    })

    it('should sandwich prompts with system instructions', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'general_qa',
      })
      const budget = createTestBudgetConstraints()

      const variants = await technique.generate(basePrompt, classification, budget)

      variants.forEach((variant) => {
        expect(variant.prompt).toContain('<<SYS>>')
        expect(variant.prompt).toContain('<<USER>>')
        expect(variant.prompt).toContain('<<END>>')
      })
    })

    it('should multiply tokens and cost by sample count', async () => {
      const basePrompt = 'Short prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 1.0,
      })

      const variants = await technique.generate(basePrompt, classification, budget)

      const basicVariant = variants.find((v) => v.technique.includes('3samples'))
      const enhancedVariant = variants.find((v) => v.technique.includes('5samples'))

      // Basic variant should have 3x tokens and cost
      expect(basicVariant!.est_tokens).toBeGreaterThan(100) // Should be multiplied by 3
      expect(basicVariant!.cost_usd).toBeGreaterThan(0.001) // Should be multiplied by 3

      // Enhanced variant should have 5x tokens and cost
      if (enhancedVariant) {
        expect(enhancedVariant.est_tokens).toBeGreaterThan(200) // Should be multiplied by 5
        expect(enhancedVariant.cost_usd).toBeGreaterThan(0.002) // Should be multiplied by 5
      }
    })
  })

  describe('SELF_CONSISTENCY_VOTE_PROMPT', () => {
    it('should have correct structure', () => {
      expect(SELF_CONSISTENCY_VOTE_PROMPT).toContain('multiple solutions')
      expect(SELF_CONSISTENCY_VOTE_PROMPT).toContain('Identify the final answer')
      expect(SELF_CONSISTENCY_VOTE_PROMPT).toContain('Count how many times')
      expect(SELF_CONSISTENCY_VOTE_PROMPT).toContain('most common answer')
      expect(SELF_CONSISTENCY_VOTE_PROMPT).toContain('{solutions}')
    })
  })

  describe('guidance based on complexity', () => {
    it('should provide simple guidance for low complexity', async () => {
      const basePrompt = 'Simple problem'
      const classification = createTestTaskClassification({
        task_type: 'general_qa',
        complexity: 0.3,
      })
      const budget = createTestBudgetConstraints()

      const variants = await technique.generate(basePrompt, classification, budget)
      const guidedVariant = variants.find((v) => v.technique.includes('guided'))

      expect(guidedVariant?.prompt).toContain('Identify the key information')
      expect(guidedVariant?.prompt).toContain('Apply the relevant method')
      expect(guidedVariant?.prompt).not.toContain('Break it into clear sub-problems')
    })

    it('should provide detailed guidance for high complexity', async () => {
      const basePrompt = 'Complex problem'
      const classification = createTestTaskClassification({
        task_type: 'data_analysis',
        complexity: 0.9,
      })
      const budget = createTestBudgetConstraints()

      const variants = await technique.generate(basePrompt, classification, budget)
      const guidedVariant = variants.find((v) => v.technique.includes('guided'))

      expect(guidedVariant?.prompt).toContain('Break it into clear sub-problems')
      expect(guidedVariant?.prompt).toContain('Solve each part methodically')
      expect(guidedVariant?.prompt).toContain('Verify your answer')
    })
  })
})
