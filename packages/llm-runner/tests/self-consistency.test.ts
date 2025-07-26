import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SelfConsistencyHandler, SelfConsistencyResult } from '../src/self-consistency'
import { BaseLLMProvider } from '../src/providers/base'
import { createTestPromptVariant } from '@promptdial/shared'
import type { PromptVariant, LLMProviderConfig } from '@promptdial/shared'
import type { LLMResponse, StreamingCallback } from '../src/providers/base'

// Mock provider for testing
class MockProvider extends BaseLLMProvider {
  private responses: string[]
  private currentIndex = 0

  constructor(config: LLMProviderConfig, responses: string[]) {
    super(config)
    this.responses = responses
  }

  async call(
    variant: PromptVariant,
    streaming?: boolean,
    callback?: StreamingCallback,
  ): Promise<LLMResponse> {
    const content = this.responses[this.currentIndex % this.responses.length]
    this.currentIndex++

    return {
      content,
      tokens_used: 100,
      latency_ms: 100,
      provider: this.config.provider,
      model: this.config.model || 'test-model',
    }
  }

  protected extractTokenFromChunk(chunk: any): string | null {
    return null
  }
}

// Mock dependencies
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

describe('SelfConsistencyHandler', () => {
  let handler: SelfConsistencyHandler
  let mockProvider: MockProvider

  beforeEach(() => {
    handler = new SelfConsistencyHandler()
  })

  describe('generateMultiple', () => {
    it('should generate multiple responses', async () => {
      mockProvider = new MockProvider({ provider: 'test', api_key: 'key' }, [
        'Response 1',
        'Response 2',
        'Response 3',
      ])

      const variant = createTestPromptVariant()
      const responses = await handler.generateMultiple(mockProvider, variant, 3)

      expect(responses).toHaveLength(3)
      expect(responses[0].content).toBe('Response 1')
      expect(responses[1].content).toBe('Response 2')
      expect(responses[2].content).toBe('Response 3')
    })

    it('should handle generation errors gracefully', async () => {
      let callCount = 0
      mockProvider = new MockProvider({ provider: 'test', api_key: 'key' }, [])

      // Override to throw error on second call
      mockProvider.call = vi.fn().mockImplementation(async () => {
        callCount++
        if (callCount === 2) {
          throw new Error('Generation failed')
        }
        return {
          content: `Response ${callCount}`,
          tokens_used: 100,
          latency_ms: 100,
          provider: 'test',
          model: 'test-model',
        }
      })

      const variant = createTestPromptVariant()
      const responses = await handler.generateMultiple(mockProvider, variant, 3)

      // Should still return 2 successful responses
      expect(responses).toHaveLength(2)
      expect(responses[0].content).toBe('Response 1')
      expect(responses[1].content).toBe('Response 3')
    })

    it('should generate responses in parallel', async () => {
      const startTime = Date.now()

      mockProvider = new MockProvider({ provider: 'test', api_key: 'key' }, [
        'R1',
        'R2',
        'R3',
        'R4',
        'R5',
      ])

      // Add delay to simulate API calls
      const originalCall = mockProvider.call.bind(mockProvider)
      mockProvider.call = async (...args) => {
        await new Promise((resolve) => setTimeout(resolve, 100))
        return originalCall(...args)
      }

      const variant = createTestPromptVariant()
      const responses = await handler.generateMultiple(mockProvider, variant, 5)

      const duration = Date.now() - startTime

      expect(responses).toHaveLength(5)
      // Should take around 100ms (parallel) not 500ms (sequential)
      expect(duration).toBeLessThan(200)
    })
  })

  describe('analyzeConsistency', () => {
    it('should identify consistent responses', () => {
      const responses: LLMResponse[] = [
        {
          content: 'The answer is 42',
          tokens_used: 10,
          latency_ms: 100,
          provider: 'test',
          model: 'test',
        },
        {
          content: 'The answer is 42',
          tokens_used: 10,
          latency_ms: 100,
          provider: 'test',
          model: 'test',
        },
        {
          content: 'The answer is 42',
          tokens_used: 10,
          latency_ms: 100,
          provider: 'test',
          model: 'test',
        },
      ]

      const result = handler.analyzeConsistency(responses)

      expect(result.final_answer).toBe('The answer is 42')
      expect(result.confidence).toBe(1.0)
      expect(result.agreement_rate).toBe(1.0)
      expect(result.answer_distribution['The answer is 42']).toBe(3)
    })

    it('should handle majority vote', () => {
      const responses: LLMResponse[] = [
        { content: 'Answer A', tokens_used: 10, latency_ms: 100, provider: 'test', model: 'test' },
        { content: 'Answer A', tokens_used: 10, latency_ms: 100, provider: 'test', model: 'test' },
        { content: 'Answer B', tokens_used: 10, latency_ms: 100, provider: 'test', model: 'test' },
      ]

      const result = handler.analyzeConsistency(responses)

      expect(result.final_answer).toBe('Answer A')
      expect(result.confidence).toBeCloseTo(0.67, 2)
      expect(result.agreement_rate).toBeCloseTo(0.67, 2)
      expect(result.answer_distribution['Answer A']).toBe(2)
      expect(result.answer_distribution['Answer B']).toBe(1)
    })

    it('should handle no clear majority', () => {
      const responses: LLMResponse[] = [
        { content: 'Answer A', tokens_used: 10, latency_ms: 100, provider: 'test', model: 'test' },
        { content: 'Answer B', tokens_used: 10, latency_ms: 100, provider: 'test', model: 'test' },
        { content: 'Answer C', tokens_used: 10, latency_ms: 100, provider: 'test', model: 'test' },
      ]

      const result = handler.analyzeConsistency(responses)

      // Should pick one of the answers
      expect(['Answer A', 'Answer B', 'Answer C']).toContain(result.final_answer)
      expect(result.confidence).toBeCloseTo(0.33, 2)
      expect(result.agreement_rate).toBeCloseTo(0.33, 2)
    })

    it('should handle empty responses', () => {
      const result = handler.analyzeConsistency([])

      expect(result.final_answer).toBe('')
      expect(result.confidence).toBe(0)
      expect(result.agreement_rate).toBe(0)
      expect(result.total_samples).toBe(0)
    })

    it('should normalize similar answers', () => {
      const responses: LLMResponse[] = [
        {
          content: 'The answer is 42.',
          tokens_used: 10,
          latency_ms: 100,
          provider: 'test',
          model: 'test',
        },
        {
          content: 'The answer is 42',
          tokens_used: 10,
          latency_ms: 100,
          provider: 'test',
          model: 'test',
        },
        {
          content: 'the answer is 42',
          tokens_used: 10,
          latency_ms: 100,
          provider: 'test',
          model: 'test',
        },
      ]

      const result = handler.analyzeConsistency(responses)

      // Should treat these as the same answer
      expect(result.confidence).toBeGreaterThan(0.9)
      expect(result.agreement_rate).toBeGreaterThan(0.9)
    })
  })

  describe('execute', () => {
    it('should execute full self-consistency flow', async () => {
      mockProvider = new MockProvider({ provider: 'test', api_key: 'key' }, [
        '42',
        '42',
        '42',
        '43',
        '42',
      ])

      const variant = createTestPromptVariant({
        prompt: 'What is 6 * 7?',
      })

      const result = await handler.execute(mockProvider, variant, 5)

      expect(result.final_answer).toBe('42')
      expect(result.confidence).toBe(0.8) // 4 out of 5
      expect(result.total_samples).toBe(5)
      expect(result.total_tokens).toBe(500) // 5 * 100
      expect(result.answer_distribution['42']).toBe(4)
      expect(result.answer_distribution['43']).toBe(1)
    })

    it('should handle temperature adjustment', async () => {
      const config = {
        provider: 'test' as const,
        api_key: 'key',
        temperature: 0.0,
      }

      mockProvider = new MockProvider(config, ['A', 'B', 'C'])

      // Spy on the provider to check temperature changes
      const callSpy = vi.spyOn(mockProvider, 'call')

      const variant = createTestPromptVariant()
      await handler.execute(mockProvider, variant, 3, 0.7)

      // Temperature should be temporarily changed
      expect(config.temperature).toBe(0.7)
      expect(callSpy).toHaveBeenCalledTimes(3)
    })

    it('should provide reasonable result with single sample', async () => {
      mockProvider = new MockProvider({ provider: 'test', api_key: 'key' }, ['Single answer'])

      const variant = createTestPromptVariant()
      const result = await handler.execute(mockProvider, variant, 1)

      expect(result.final_answer).toBe('Single answer')
      expect(result.confidence).toBe(1.0)
      expect(result.total_samples).toBe(1)
    })

    it('should handle all failures gracefully', async () => {
      mockProvider = new MockProvider({ provider: 'test', api_key: 'key' }, [])

      mockProvider.call = vi.fn().mockRejectedValue(new Error('All failed'))

      const variant = createTestPromptVariant()
      const result = await handler.execute(mockProvider, variant, 3)

      expect(result.final_answer).toBe('')
      expect(result.confidence).toBe(0)
      expect(result.total_samples).toBe(0)
      expect(result.total_tokens).toBe(0)
    })
  })

  describe('normalizeAnswer', () => {
    it('should normalize whitespace and punctuation', () => {
      const testCases = [
        { input: 'The answer is 42.', expected: 'the answer is 42' },
        { input: '  Multiple   spaces  ', expected: 'multiple spaces' },
        { input: 'UPPERCASE TEXT!!!', expected: 'uppercase text' },
        { input: 'Line\nbreaks\tand\ttabs', expected: 'line breaks and tabs' },
      ]

      testCases.forEach(({ input, expected }) => {
        const normalized = (handler as any).normalizeAnswer(input)
        expect(normalized).toBe(expected)
      })
    })

    it('should handle edge cases', () => {
      expect((handler as any).normalizeAnswer('')).toBe('')
      expect((handler as any).normalizeAnswer('   ')).toBe('')
      expect((handler as any).normalizeAnswer('!!!')).toBe('')
    })
  })

  describe('calculateTokens', () => {
    it('should sum tokens from all responses', () => {
      const responses: LLMResponse[] = [
        { content: 'A', tokens_used: 10, latency_ms: 100, provider: 'test', model: 'test' },
        { content: 'B', tokens_used: 20, latency_ms: 100, provider: 'test', model: 'test' },
        { content: 'C', tokens_used: 30, latency_ms: 100, provider: 'test', model: 'test' },
      ]

      const total = (handler as any).calculateTokens(responses)
      expect(total).toBe(60)
    })

    it('should handle empty array', () => {
      const total = (handler as any).calculateTokens([])
      expect(total).toBe(0)
    })
  })
})
