import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ReActTechnique } from '../src/techniques/react'
import {
  createTestTaskClassification,
  createTestBudgetConstraints,
  TECHNIQUES
} from '@promptdial/shared'

// Mock dependencies
vi.mock('@promptdial/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@promptdial/shared')>()
  return {
    ...actual,
    generateVariantId: (technique: string, index: number) => `${technique}_${index}`,
    estimateTokens: (prompt: string) => Math.ceil(prompt.length / 4),
    estimateCost: (tokens: number) => tokens * 0.00002
  }
})

describe('ReActTechnique', () => {
  let technique: ReActTechnique
  
  beforeEach(() => {
    technique = new ReActTechnique()
  })
  
  describe('properties', () => {
    it('should have correct metadata', () => {
      expect(technique.name).toBe(TECHNIQUES.REACT)
      expect(technique.description).toBe('Reasoning and acting in an interleaved manner')
      expect(technique.best_for).toEqual(['code_generation', 'data_analysis', 'general_qa'])
      expect(technique.needs_retrieval).toBe(false)
    })
  })
  
  describe('generate', () => {
    it('should generate basic ReAct variant', async () => {
      const basePrompt = 'Write a function to find the median of a list'
      const classification = createTestTaskClassification({
        task_type: 'code_generation'
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.1,
        max_tokens: 2000
      })
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      expect(variants.length).toBeGreaterThan(0)
      
      const basicVariant = variants.find(v => v.technique.includes('basic'))
      expect(basicVariant).toBeDefined()
      expect(basicVariant?.temperature).toBe(0.7)
      
      // Should include ReAct format
      expect(basicVariant?.prompt).toContain('ReAct framework')
      expect(basicVariant?.prompt).toContain('Thought 1:')
      expect(basicVariant?.prompt).toContain('Action 1:')
      expect(basicVariant?.prompt).toContain('Observation 1:')
      
      // Should include available actions
      expect(basicVariant?.prompt).toContain('Available actions:')
      expect(basicVariant?.prompt).toContain('Think:')
      expect(basicVariant?.prompt).toContain('Calculate:')
      expect(basicVariant?.prompt).toContain('Conclude:')
    })
    
    it('should generate explicit action space variant', async () => {
      const basePrompt = 'Analyze sales data for trends'
      const classification = createTestTaskClassification({
        task_type: 'data_analysis'
      })
      const budget = createTestBudgetConstraints()
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      const explicitVariant = variants.find(v => v.technique.includes('explicit'))
      expect(explicitVariant).toBeDefined()
      expect(explicitVariant?.temperature).toBe(0.7)
      
      // Should have explicit action definitions
      expect(explicitVariant?.prompt).toContain('ACTION SPACE')
    })
    
    it('should generate example-based variant with sufficient budget', async () => {
      const basePrompt = 'Solve this problem'
      const classification = createTestTaskClassification({
        task_type: 'general_qa'
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.5, // High budget
        max_tokens: 3000
      })
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      const exampleVariant = variants.find(v => v.technique.includes('examples'))
      expect(exampleVariant).toBeDefined()
      expect(exampleVariant?.temperature).toBe(0.6) // Lower temperature for examples
      
      // Should include example
      expect(exampleVariant?.prompt).toContain('EXAMPLE:')
    })
    
    it('should skip example variant with low budget', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'code_generation'
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.0001, // Very low budget to ensure examples are skipped
        max_tokens: 100
      })
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      // Should not have examples variant due to budget
      const exampleVariant = variants.find(v => v.technique.includes('examples'))
      expect(exampleVariant).toBeUndefined()
    })
    
    it('should sandwich prompts with system instructions', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'data_analysis'
      })
      const budget = createTestBudgetConstraints()
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      variants.forEach(variant => {
        expect(variant.prompt).toContain('<<SYS>>')
        expect(variant.prompt).toContain('<<USER>>')
        expect(variant.prompt).toContain('<<END>>')
      })
    })
    
    it('should respect budget constraints', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'general_qa'
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.001, // Very small budget
        max_tokens: 100
      })
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      // Should generate minimal or no variants
      expect(variants.length).toBeLessThanOrEqual(1)
      
      // Any generated variants should fit budget
      variants.forEach(variant => {
        expect(variant.cost_usd).toBeLessThanOrEqual(budget.remaining_cost_usd)
        expect(variant.est_tokens).toBeLessThanOrEqual(budget.max_tokens)
      })
    })
    
    it('should include task-appropriate actions', async () => {
      // Test code generation
      const codePrompt = 'Write a sorting algorithm'
      const codeClassification = createTestTaskClassification({
        task_type: 'code_generation'
      })
      const budget = createTestBudgetConstraints()
      
      const codeVariants = await technique.generate(codePrompt, codeClassification, budget)
      const codeBasic = codeVariants.find(v => v.technique.includes('basic'))
      
      expect(codeBasic?.prompt).toContain('Plan:')
      expect(codeBasic?.prompt).toContain('Verify:')
      
      // Test data analysis
      const dataPrompt = 'Analyze dataset'
      const dataClassification = createTestTaskClassification({
        task_type: 'data_analysis'
      })
      
      const dataVariants = await technique.generate(dataPrompt, dataClassification, budget)
      const dataBasic = dataVariants.find(v => v.technique.includes('basic'))
      
      expect(dataBasic?.prompt).toContain('Analyze:')
      expect(dataBasic?.prompt).toContain('Calculate:')
    })
    
    it('should create properly formatted prompts', async () => {
      const basePrompt = 'How do I optimize database queries?'
      const classification = createTestTaskClassification({
        task_type: 'general_qa'
      })
      const budget = createTestBudgetConstraints()
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      const basicVariant = variants[0]
      
      // Check formatting elements
      expect(basicVariant.prompt).toContain(basePrompt)
      expect(basicVariant.prompt).toContain('Use this format')
      expect(basicVariant.prompt).toContain('Continue this pattern')
      expect(basicVariant.prompt).toContain('Begin your reasoning now')
    })
    
    it('should generate multiple variants with adequate budget', async () => {
      const basePrompt = 'Complex problem'
      const classification = createTestTaskClassification({
        task_type: 'code_generation'
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 1.0,
        max_tokens: 5000
      })
      
      const variants = await technique.generate(basePrompt, classification, budget)
      
      // Should have at least basic and explicit variants
      expect(variants.length).toBeGreaterThanOrEqual(2)
      
      // Check variant types
      const variantTypes = variants.map(v => v.technique)
      expect(variantTypes).toContain(`${TECHNIQUES.REACT}_basic`)
      expect(variantTypes).toContain(`${TECHNIQUES.REACT}_explicit`)
    })
  })
})