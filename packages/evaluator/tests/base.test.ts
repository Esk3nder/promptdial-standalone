import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseEvaluator, EvaluatorConfig } from '../src/evaluators/base'
import { createTestPromptVariant, createTestTaskClassification } from '@promptdial/shared'
import type { PromptVariant, TaskClassification, EvaluationResult } from '@promptdial/shared'

// Mock logger
vi.mock('@promptdial/shared', async () => {
  const actual = await vi.importActual('@promptdial/shared')
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }
})

// Concrete implementation for testing
class TestEvaluator extends BaseEvaluator {
  async evaluate(
    variant: PromptVariant,
    response: string,
    taskMeta: TaskClassification,
    references?: string[],
  ): Promise<Partial<EvaluationResult>> {
    return {
      variant_id: variant.id,
      scores: {
        test: 0.8,
      },
    }
  }
}

describe('BaseEvaluator', () => {
  let evaluator: TestEvaluator
  let config: EvaluatorConfig

  beforeEach(() => {
    config = {
      name: 'test_evaluator',
      description: 'Test evaluator for unit testing',
      requiresReference: false,
      requiresLLM: false,
    }
    evaluator = new TestEvaluator(config)
  })

  describe('getName', () => {
    it('should return the evaluator name', () => {
      expect(evaluator.getName()).toBe('test_evaluator')
    })
  })

  describe('requiresReference', () => {
    it('should return false by default', () => {
      expect(evaluator.requiresReference()).toBe(false)
    })

    it('should return true when configured', () => {
      const refEvaluator = new TestEvaluator({
        ...config,
        requiresReference: true,
      })
      expect(refEvaluator.requiresReference()).toBe(true)
    })
  })

  describe('requiresLLM', () => {
    it('should return false by default', () => {
      expect(evaluator.requiresLLM()).toBe(false)
    })

    it('should return true when configured', () => {
      const llmEvaluator = new TestEvaluator({
        ...config,
        requiresLLM: true,
      })
      expect(llmEvaluator.requiresLLM()).toBe(true)
    })
  })

  describe('normalizeScore', () => {
    it('should normalize score to 0-1 range', () => {
      // Access protected method through any cast
      const normalizeScore = (evaluator as any).normalizeScore.bind(evaluator)

      expect(normalizeScore(50, 0, 100)).toBe(0.5)
      expect(normalizeScore(0, 0, 100)).toBe(0)
      expect(normalizeScore(100, 0, 100)).toBe(1)
    })

    it('should clamp values outside range', () => {
      const normalizeScore = (evaluator as any).normalizeScore.bind(evaluator)

      expect(normalizeScore(150, 0, 100)).toBe(1)
      expect(normalizeScore(-50, 0, 100)).toBe(0)
    })

    it('should handle custom ranges', () => {
      const normalizeScore = (evaluator as any).normalizeScore.bind(evaluator)

      expect(normalizeScore(3, 1, 5)).toBe(0.5)
      expect(normalizeScore(7, 5, 10)).toBe(0.4)
    })
  })

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      const calculateSimilarity = (evaluator as any).calculateSimilarity.bind(evaluator)

      expect(calculateSimilarity('hello world', 'hello world')).toBe(1)
      expect(calculateSimilarity('Hello World', 'hello world')).toBe(1) // Case insensitive
    })

    it('should calculate Jaccard similarity', () => {
      const calculateSimilarity = (evaluator as any).calculateSimilarity.bind(evaluator)

      // "the cat" and "the dog" share "the"
      const sim1 = calculateSimilarity('the cat', 'the dog')
      expect(sim1).toBeCloseTo(0.333, 2) // 1/3

      // No common words
      const sim2 = calculateSimilarity('hello world', 'foo bar')
      expect(sim2).toBe(0)

      // All words in common
      const sim3 = calculateSimilarity('hello beautiful world', 'world hello beautiful')
      expect(sim3).toBe(1)
    })

    it('should handle empty strings', () => {
      const calculateSimilarity = (evaluator as any).calculateSimilarity.bind(evaluator)

      expect(calculateSimilarity('', '')).toBe(1) // Both empty
      expect(calculateSimilarity('hello', '')).toBe(0)
      expect(calculateSimilarity('', 'world')).toBe(0)
    })
  })

  describe('extractKeyInfo', () => {
    it('should extract structure indicators', () => {
      const extractKeyInfo = (evaluator as any).extractKeyInfo.bind(evaluator)

      const response1 = '1) First point\n2) Second point\n3) Third point'
      const info1 = extractKeyInfo(response1)
      expect(info1.hasStructure).toBe(true)

      const response2 = '- Item one\n- Item two\n- Item three'
      const info2 = extractKeyInfo(response2)
      expect(info2.hasStructure).toBe(true)

      const response3 = 'First, we do this. Second, we do that. Finally, we conclude.'
      const info3 = extractKeyInfo(response3)
      expect(info3.hasStructure).toBe(true)

      const response4 = 'This is just a simple response without structure'
      const info4 = extractKeyInfo(response4)
      expect(info4.hasStructure).toBe(false)
    })

    it('should detect examples', () => {
      const extractKeyInfo = (evaluator as any).extractKeyInfo.bind(evaluator)

      const response1 = 'For example, we can use Python to solve this.'
      const info1 = extractKeyInfo(response1)
      expect(info1.hasExamples).toBe(true)

      const response2 = 'Languages such as JavaScript and TypeScript are popular.'
      const info2 = extractKeyInfo(response2)
      expect(info2.hasExamples).toBe(true)

      const response3 = 'This is a response without any examples.'
      const info3 = extractKeyInfo(response3)
      expect(info3.hasExamples).toBe(false)
    })

    it('should detect reasoning', () => {
      const extractKeyInfo = (evaluator as any).extractKeyInfo.bind(evaluator)

      const response1 = 'We should use this approach because it is more efficient.'
      const info1 = extractKeyInfo(response1)
      expect(info1.hasReasoning).toBe(true)

      const response2 = 'The algorithm failed. Therefore, we need a different approach.'
      const info2 = extractKeyInfo(response2)
      expect(info2.hasReasoning).toBe(true)

      const response3 = 'This is the answer to your question.'
      const info3 = extractKeyInfo(response3)
      expect(info3.hasReasoning).toBe(false)
    })

    it('should count words and sentences', () => {
      const extractKeyInfo = (evaluator as any).extractKeyInfo.bind(evaluator)

      const response = 'This is sentence one. This is sentence two! Is this sentence three?'
      const info = extractKeyInfo(response)

      expect(info.wordCount).toBe(12)
      expect(info.sentenceCount).toBe(3)
    })

    it('should handle edge cases', () => {
      const extractKeyInfo = (evaluator as any).extractKeyInfo.bind(evaluator)

      // Empty response
      const info1 = extractKeyInfo('')
      expect(info1.wordCount).toBe(0)
      expect(info1.sentenceCount).toBe(0)

      // Only whitespace
      const info2 = extractKeyInfo('   \n\t   ')
      expect(info2.wordCount).toBe(0)
      expect(info2.sentenceCount).toBe(0)

      // Multiple punctuation
      const info3 = extractKeyInfo('Hello... World!!! How are you???')
      expect(info3.sentenceCount).toBe(3)
    })
  })

  describe('evaluate', () => {
    it('should be implemented by subclass', async () => {
      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      const result = await evaluator.evaluate(variant, response, taskMeta)

      expect(result).toBeDefined()
      expect(result.variant_id).toBe(variant.id)
      expect(result.scores).toEqual({ test: 0.8 })
    })
  })
})
