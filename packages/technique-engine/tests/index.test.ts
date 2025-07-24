import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  TechniqueEngine,
  handleGenerateVariantsRequest,
  handleRegisterTechniqueRequest,
} from '../src/index'
import {
  createTestTaskClassification,
  createTestBudgetConstraints,
  createTestTechniqueStrategy,
  createTestServiceRequest,
  createTestPromptVariant,
} from '@promptdial/shared'
import type {
  TaskClassification,
  BudgetConstraints,
  TechniqueStrategy,
  PromptVariant,
} from '@promptdial/shared'

// Mock dependencies
vi.mock('@promptdial/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@promptdial/shared')>()
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    getTelemetryService: () => ({
      logEvent: vi.fn().mockResolvedValue(undefined),
      recordMetric: vi.fn(),
    }),
  }
})

// Mock techniques
vi.mock('../src/techniques', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/techniques')>()

  class MockFewShotCoTTechnique {
    name = 'few_shot_cot'
    description = 'Mock Few-Shot CoT'
    best_for = ['math_reasoning', 'code_generation']
    needs_retrieval = false

    async generate(
      base_prompt: string,
      meta: TaskClassification,
      budget: BudgetConstraints,
    ): Promise<PromptVariant[]> {
      return [
        createTestPromptVariant({
          id: 'few_shot_cot_0',
          technique: 'few_shot_cot',
          prompt: `Few-shot CoT: ${base_prompt}`,
          temperature: 0.7,
          est_tokens: 500,
          cost_usd: 0.01,
        }),
      ]
    }
  }

  class MockSelfConsistencyTechnique {
    name = 'self_consistency'
    description = 'Mock Self-Consistency'
    best_for = ['math_reasoning']
    needs_retrieval = false

    async generate(
      base_prompt: string,
      meta: TaskClassification,
      budget: BudgetConstraints,
    ): Promise<PromptVariant[]> {
      return [
        createTestPromptVariant({
          id: 'self_consistency_0',
          technique: 'self_consistency',
          prompt: `Self-consistency: ${base_prompt}`,
          temperature: 0.8,
          est_tokens: 300,
          cost_usd: 0.005,
        }),
      ]
    }
  }

  class MockIRCoTTechnique {
    name = 'ircot'
    description = 'Mock IRCoT'
    best_for = ['general_qa']
    needs_retrieval = true

    async generate(
      base_prompt: string,
      meta: TaskClassification,
      budget: BudgetConstraints,
    ): Promise<PromptVariant[]> {
      return [
        createTestPromptVariant({
          id: 'ircot_0',
          technique: 'ircot',
          prompt: `IRCoT with retrieval: ${base_prompt}`,
          temperature: 0.5,
          est_tokens: 800,
          cost_usd: 0.02,
        }),
      ]
    }
  }

  return {
    ...actual,
    TECHNIQUE_REGISTRY: new Map([
      ['few_shot_cot', MockFewShotCoTTechnique],
      ['self_consistency', MockSelfConsistencyTechnique],
      ['ircot', MockIRCoTTechnique],
    ]),
    ALL_TECHNIQUES: [MockFewShotCoTTechnique, MockSelfConsistencyTechnique, MockIRCoTTechnique],
  }
})

describe('TechniqueEngine', () => {
  let engine: TechniqueEngine

  beforeEach(() => {
    vi.clearAllMocks()
    engine = new TechniqueEngine()
  })

  describe('generateVariants', () => {
    it('should generate variants using applicable techniques', async () => {
      const basePrompt = 'Solve for x: 2x + 4 = 10'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        suggested_techniques: ['few_shot_cot', 'self_consistency'],
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.1,
        max_tokens: 2000,
      })

      const variants = await engine.generateVariants(
        basePrompt,
        classification,
        budget,
        'test-trace-123',
      )

      expect(variants).toHaveLength(2)
      expect(variants[0].technique).toBe('few_shot_cot')
      expect(variants[1].technique).toBe('self_consistency')
      expect(variants[0].prompt).toContain(basePrompt)
    })

    it('should respect budget constraints', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        suggested_techniques: ['few_shot_cot', 'self_consistency'],
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.015, // Enough for at least one technique but not all
        max_tokens: 2000,
      })

      const variants = await engine.generateVariants(
        basePrompt,
        classification,
        budget,
        'test-trace-123',
      )

      // Should have at least one variant, but not all due to budget
      expect(variants.length).toBeGreaterThan(0)
      expect(variants.length).toBeLessThan(3)
    })

    it('should skip techniques that need retrieval when task does not', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'general_qa',
        needs_retrieval: false,
        suggested_techniques: ['ircot', 'few_shot_cot'], // IRCoT needs retrieval, few_shot_cot doesn't
      })
      const budget = createTestBudgetConstraints()

      const variants = await engine.generateVariants(
        basePrompt,
        classification,
        budget,
        'test-trace-123',
      )

      // Should not have IRCoT variant since it needs retrieval
      const hasIRCoT = variants.some((v) => v.technique === 'ircot')
      expect(hasIRCoT).toBe(false)

      // Should have variants from techniques that don't need retrieval
      expect(variants.length).toBeGreaterThan(0)
      // Check that we have at least one variant from a technique that doesn't need retrieval
      const nonRetrievalVariant = variants.find((v) => !v.technique.includes('ircot'))
      expect(nonRetrievalVariant).toBeDefined()
    })

    it('should handle technique failures gracefully', async () => {
      // Override one technique to throw an error
      const MockFailingTechnique = vi.fn().mockImplementation(() => ({
        name: 'failing_technique',
        description: 'Failing technique',
        best_for: ['math_reasoning'],
        needs_retrieval: false,
        generate: vi.fn().mockRejectedValue(new Error('Technique failed')),
      }))

      engine['techniques'].set('failing_technique', MockFailingTechnique as any)

      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        suggested_techniques: ['failing_technique', 'few_shot_cot'],
      })
      const budget = createTestBudgetConstraints()

      const variants = await engine.generateVariants(
        basePrompt,
        classification,
        budget,
        'test-trace-123',
      )

      // Should still get variants from working technique
      expect(variants.length).toBeGreaterThan(0)
      expect(variants[0].technique).toBe('few_shot_cot')
    })

    it('should prioritize suggested techniques', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        suggested_techniques: ['self_consistency'], // Suggest self_consistency
      })
      const budget = createTestBudgetConstraints()

      const variants = await engine.generateVariants(
        basePrompt,
        classification,
        budget,
        'test-trace-123',
      )

      // Should have self_consistency first
      expect(variants[0].technique).toBe('self_consistency')
    })

    it('should stop when budget is exhausted', async () => {
      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        suggested_techniques: ['few_shot_cot', 'self_consistency'],
      })
      const budget = createTestBudgetConstraints({
        remaining_cost_usd: 0.001, // Very small budget
      })

      const variants = await engine.generateVariants(
        basePrompt,
        classification,
        budget,
        'test-trace-123',
      )

      // Should generate no variants due to budget constraints
      expect(variants).toHaveLength(0)
    })
  })

  describe('registerTechnique', () => {
    it('should register a custom technique', () => {
      const customTechnique = createTestTechniqueStrategy({
        name: 'custom_technique',
        description: 'My custom technique',
      })

      engine.registerTechnique(customTechnique)

      // Verify technique is registered
      const registered = engine['customTechniques'].get('custom_technique')
      expect(registered).toBeDefined()
      expect(registered?.name).toBe('custom_technique')
    })

    it('should throw error if technique name already exists', () => {
      const technique1 = createTestTechniqueStrategy({ name: 'duplicate' })
      const technique2 = createTestTechniqueStrategy({ name: 'duplicate' })

      engine.registerTechnique(technique1)

      expect(() => engine.registerTechnique(technique2)).toThrow(
        'Technique duplicate is already registered',
      )
    })

    it('should throw error if technique name conflicts with built-in', () => {
      const technique = createTestTechniqueStrategy({ name: 'few_shot_cot' })

      expect(() => engine.registerTechnique(technique)).toThrow(
        'Technique few_shot_cot is already registered',
      )
    })
  })

  describe('variant validation', () => {
    it('should filter out invalid variants', async () => {
      // Override technique to return invalid variant
      const MockInvalidTechnique = vi.fn().mockImplementation(() => ({
        name: 'invalid_technique',
        description: 'Returns invalid variant',
        best_for: ['math_reasoning'],
        needs_retrieval: false,
        generate: vi
          .fn()
          .mockResolvedValue([
            {
              id: '',
              prompt: 'test',
              technique: 'invalid',
              est_tokens: 100,
              temperature: 0.5,
              cost_usd: 0.01,
            },
            createTestPromptVariant({ id: 'valid_variant' }),
          ]),
      }))

      engine['techniques'].set('invalid_technique', MockInvalidTechnique as any)

      const basePrompt = 'Test prompt'
      const classification = createTestTaskClassification({
        task_type: 'math_reasoning',
        suggested_techniques: ['invalid_technique'],
      })
      const budget = createTestBudgetConstraints()

      const variants = await engine.generateVariants(
        basePrompt,
        classification,
        budget,
        'test-trace-123',
      )

      // Check what variants were returned
      const invalidVariant = variants.find((v) => v.id === '')
      const validVariant = variants.find((v) => v.id === 'valid_variant')

      // Should have filtered out the invalid variant
      expect(invalidVariant).toBeUndefined()
      expect(validVariant).toBeDefined()
      expect(validVariant?.id).toBe('valid_variant')
    })
  })
})

describe('Service API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleGenerateVariantsRequest', () => {
    it('should handle valid generate request', async () => {
      const request = createTestServiceRequest({
        base_prompt: 'Test prompt',
        classification: createTestTaskClassification(),
        budget: createTestBudgetConstraints(),
        trace_id: 'test-trace-123',
      })

      const response = await handleGenerateVariantsRequest(request)

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(Array.isArray(response.data)).toBe(true)
    })

    it('should handle errors in generate request', async () => {
      const request = createTestServiceRequest({
        base_prompt: 'Test prompt',
        classification: null as any, // Invalid classification
        budget: createTestBudgetConstraints(),
        trace_id: 'test-trace-123',
      })

      const response = await handleGenerateVariantsRequest(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe('INTERNAL_ERROR')
    })
  })

  describe('handleRegisterTechniqueRequest', () => {
    it('should handle valid register request', async () => {
      const request = createTestServiceRequest(
        createTestTechniqueStrategy({
          name: 'new_custom_technique',
        }),
      )

      const response = await handleRegisterTechniqueRequest(request)

      expect(response.success).toBe(true)
      expect(response.error).toBeUndefined()
    })

    it('should handle duplicate registration error', async () => {
      const technique = createTestTechniqueStrategy({
        name: 'duplicate_custom',
      })

      // Register once
      await handleRegisterTechniqueRequest(createTestServiceRequest(technique))

      // Try to register again
      const response = await handleRegisterTechniqueRequest(createTestServiceRequest(technique))

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe('INVALID_PARAMETERS')
    })
  })
})
