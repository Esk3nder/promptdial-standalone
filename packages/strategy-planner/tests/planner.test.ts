import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StrategyPlanner, LLMProvider } from '../src/planner'
import { Technique } from '../src/types'

// Mock LLM provider
class MockLLMProvider implements LLMProvider {
  async call(prompt: string): Promise<any> {
    return {
      content: JSON.stringify({
        suggested_techniques: ['chain_of_thought', 'self_consistency'],
        rationale: 'Mock rationale for testing',
        confidence: 0.85,
      }),
      tokens_used: 100,
      latency_ms: 50,
      provider: 'mock',
      model: 'mock-model',
    }
  }
}

describe('StrategyPlanner', () => {
  let planner: StrategyPlanner
  let mockProvider: MockLLMProvider

  beforeEach(() => {
    mockProvider = new MockLLMProvider()
    planner = new StrategyPlanner(mockProvider)
  })

  describe('plan', () => {
    it('should generate valid strategy suggestions', async () => {
      const request = {
        prompt: 'Explain quantum computing in simple terms',
        context: {
          taskType: 'explanation',
          optimizationLevel: 'normal' as const,
        },
      }

      const response = await planner.plan(request)

      expect(response.suggested_techniques).toContain(Technique.CHAIN_OF_THOUGHT)
      expect(response.suggested_techniques).toContain(Technique.SELF_CONSISTENCY)
      expect(response.rationale).toBeTruthy()
      expect(response.confidence).toBeGreaterThan(0)
      expect(response.confidence).toBeLessThanOrEqual(1)
    })

    it('should handle LLM failures with fail-closed baseline', async () => {
      // Mock provider that throws error
      const errorProvider = new MockLLMProvider()

      vi.spyOn(errorProvider, 'call').mockRejectedValue(new Error('LLM timeout'))

      const errorPlanner = new StrategyPlanner(errorProvider)
      const request = {
        prompt: 'Test prompt',
      }

      const response = await errorPlanner.plan(request)

      // Should return baseline response
      expect(response.suggested_techniques).toEqual([Technique.CHAIN_OF_THOUGHT])
      expect(response.confidence).toBe(0.5)
      expect(response.metadata?.modelUsed).toBe('baseline')
    })

    it('should handle malformed LLM responses', async () => {
      const malformedProvider = new MockLLMProvider()

      vi.spyOn(malformedProvider, 'call').mockResolvedValue({
        content: 'Not valid JSON',
        tokens_used: 50,
        latency_ms: 25,
        provider: 'mock',
        model: 'mock-model',
      })

      const malformedPlanner = new StrategyPlanner(malformedProvider)
      const request = {
        prompt: 'Test prompt',
      }

      const response = await malformedPlanner.plan(request)

      // Should return baseline response
      expect(response.suggested_techniques).toEqual([Technique.CHAIN_OF_THOUGHT])
      expect(response.metadata?.modelUsed).toBe('baseline')
    })

    it('should respect context in planning', async () => {
      const contextProvider = new MockLLMProvider()

      vi.spyOn(contextProvider, 'call').mockImplementation(async (prompt) => {
        // Check that context is included in prompt
        expect(prompt).toContain('Task type: coding')
        expect(prompt).toContain('Target model: gpt-4')

        return {
          content: JSON.stringify({
            suggested_techniques: ['self_refine', 'chain_of_thought'],
            rationale: 'Coding task benefits from refinement',
            confidence: 0.9,
          }),
          tokens_used: 100,
          latency_ms: 50,
          provider: 'mock',
          model: 'mock-model',
        }
      })

      const contextPlanner = new StrategyPlanner(contextProvider)
      const request = {
        prompt: 'Write a Python function to sort a list',
        context: {
          taskType: 'coding',
          modelName: 'gpt-4',
          optimizationLevel: 'normal' as const,
        },
      }

      const response = await contextPlanner.plan(request)

      expect(response.suggested_techniques).toContain(Technique.SELF_REFINE)
      expect(response.confidence).toBe(0.9)
    })
  })

  describe('quickPlan', () => {
    it('should return appropriate strategies for known task types', async () => {
      const reasoningResponse = await planner.quickPlan('reasoning')
      expect(reasoningResponse.suggested_techniques).toContain(Technique.CHAIN_OF_THOUGHT)
      expect(reasoningResponse.suggested_techniques).toContain(Technique.SELF_CONSISTENCY)

      const codingResponse = await planner.quickPlan('coding')
      expect(codingResponse.suggested_techniques).toContain(Technique.SELF_REFINE)
      expect(codingResponse.suggested_techniques).toContain(Technique.CHAIN_OF_THOUGHT)
    })

    it('should add guard helpers automatically', async () => {
      const response = await planner.quickPlan('creative')

      const hasGuardHelper = response.suggested_techniques.some(
        (t) => t === Technique.SYCOPHANCY_FILTER || t === Technique.JAILBREAK_REGEX_BANK,
      )

      expect(hasGuardHelper).toBe(true)
    })

    it('should return default strategy for unknown task types', async () => {
      const response = await planner.quickPlan('unknown_task_type')

      expect(response.suggested_techniques).toContain(Technique.CHAIN_OF_THOUGHT)
      expect(response.confidence).toBe(0.7)
      expect(response.metadata?.modelUsed).toBe('rule-based')
    })

    it('should complete quickly without LLM call', async () => {
      const startTime = Date.now()
      await planner.quickPlan('reasoning')
      const duration = Date.now() - startTime

      expect(duration).toBeLessThan(10) // Should be near-instant
    })
  })
})
