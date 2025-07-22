import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseTechnique } from '../src/techniques/base'
import {
  createTestTaskClassification,
  createTestBudgetConstraints,
  createTestPromptVariant
} from '@promptdial/shared'
import type {
  PromptVariant,
  TaskClassification,
  BudgetConstraints
} from '@promptdial/shared'

// Mock dependencies
vi.mock('@promptdial/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@promptdial/shared')>()
  return {
    ...actual,
    generateVariantId: (technique: string, index: number) => `${technique}_${index}`,
    estimateTokens: (prompt: string) => Math.ceil(prompt.length / 4),
    estimateCost: (tokens: number, provider: string, model: string) => {
      // Simple mock cost calculation
      const rates: Record<string, number> = {
        'openai': 0.00002,
        'anthropic': 0.00003,
        'google': 0.000025
      }
      return tokens * (rates[provider] || 0.00002)
    }
  }
})

// Concrete implementation for testing
class TestTechnique extends BaseTechnique {
  name = 'test_technique'
  description = 'Test technique for unit testing'
  best_for = ['general_qa', 'math_reasoning'] as const
  needs_retrieval = false
  
  async generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints
  ): Promise<PromptVariant[]> {
    // Simple implementation that creates one variant
    const variant = this.createVariant(
      this.sandwichPrompt(base_prompt),
      this.name,
      0.7,
      0
    )
    
    if (this.fitsInBudget(variant, budget)) {
      return [variant]
    }
    
    return []
  }
}

describe('BaseTechnique', () => {
  let technique: TestTechnique
  
  beforeEach(() => {
    technique = new TestTechnique()
  })
  
  describe('createVariant', () => {
    it('should create a variant with correct properties', () => {
      const prompt = 'Test prompt for variant creation'
      const variant = technique['createVariant'](
        prompt,
        'test_technique',
        0.7,
        0
      )
      
      expect(variant).toEqual({
        id: 'test_technique_0',
        technique: 'test_technique',
        prompt: prompt,
        est_tokens: Math.ceil(prompt.length / 4),
        temperature: 0.7,
        cost_usd: expect.any(Number)
      })
      
      expect(variant.cost_usd).toBeGreaterThan(0)
    })
    
    it('should use custom provider and model', () => {
      const prompt = 'Test prompt'
      const variant = technique['createVariant'](
        prompt,
        'test_technique',
        0.5,
        1,
        'anthropic',
        'claude-3'
      )
      
      expect(variant.id).toBe('test_technique_1')
      expect(variant.temperature).toBe(0.5)
      // Cost should be different for anthropic
      expect(variant.cost_usd).toBeGreaterThan(0)
    })
  })
  
  describe('fitsInBudget', () => {
    it('should return true when variant fits in budget', () => {
      const variant = createTestPromptVariant({
        cost_usd: 0.01,
        est_tokens: 500
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.05,
        max_tokens: 1000
      })
      
      expect(technique['fitsInBudget'](variant, budget)).toBe(true)
    })
    
    it('should return false when cost exceeds budget', () => {
      const variant = createTestPromptVariant({
        cost_usd: 0.05,
        est_tokens: 500
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.01,
        max_tokens: 1000
      })
      
      expect(technique['fitsInBudget'](variant, budget)).toBe(false)
    })
    
    it('should return false when tokens exceed limit', () => {
      const variant = createTestPromptVariant({
        cost_usd: 0.01,
        est_tokens: 1500
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.05,
        max_tokens: 1000
      })
      
      expect(technique['fitsInBudget'](variant, budget)).toBe(false)
    })
  })
  
  describe('sandwichPrompt', () => {
    it('should wrap user prompt with system instructions', () => {
      const userPrompt = 'Calculate the square root of 144'
      const sandwiched = technique['sandwichPrompt'](userPrompt)
      
      expect(sandwiched).toContain('<<SYS>>')
      expect(sandwiched).toContain('<<USER>>')
      expect(sandwiched).toContain('<<END>>')
      expect(sandwiched).toContain(userPrompt)
      expect(sandwiched).toMatch(/helpful AI assistant/)
    })
  })
  
  describe('addStepByStep', () => {
    it('should add step-by-step instruction to prompt', () => {
      const prompt = 'Solve this problem'
      const enhanced = technique['addStepByStep'](prompt)
      
      expect(enhanced).toContain(prompt)
      expect(enhanced).toContain('step-by-step')
      expect(enhanced).toContain('reasoning')
    })
  })
  
  describe('addOutputFormat', () => {
    it('should add output format specification', () => {
      const prompt = 'Generate a list'
      const format = '1. First item\n2. Second item\n3. Third item'
      const formatted = technique['addOutputFormat'](prompt, format)
      
      expect(formatted).toContain(prompt)
      expect(formatted).toContain('Provide your response in the following format:')
      expect(formatted).toContain(format)
    })
  })
  
  describe('generate', () => {
    it('should generate variants within budget', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification()
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.1,
        max_tokens: 2000
      })
      
      const variants = await technique.generate(
        basePrompt,
        classification,
        budget
      )
      
      expect(variants).toHaveLength(1)
      expect(variants[0].technique).toBe('test_technique')
      expect(variants[0].prompt).toContain(basePrompt)
    })
    
    it('should return empty array when budget is insufficient', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification()
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.00001, // Very small budget
        max_tokens: 10 // Very few tokens
      })
      
      const variants = await technique.generate(
        basePrompt,
        classification,
        budget
      )
      
      expect(variants).toHaveLength(0)
    })
  })
  
  describe('properties', () => {
    it('should have required properties', () => {
      expect(technique.name).toBe('test_technique')
      expect(technique.description).toBe('Test technique for unit testing')
      expect(technique.best_for).toEqual(['general_qa', 'math_reasoning'])
      expect(technique.needs_retrieval).toBe(false)
    })
  })
})