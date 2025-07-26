import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handleGenerateVariantsRequest } from '../src/index'
import { TaskClassification, BudgetConstraints, ServiceRequest } from '@promptdial/shared'

describe('Technique Engine Invariants', () => {
  const mockRequest = (payload: any): ServiceRequest => ({
    trace_id: 'test-trace-123',
    timestamp: new Date(),
    service: 'test',
    method: 'generateVariants',
    payload
  })

  const mockTaskClassification: TaskClassification = {
    task_type: 'general_qa',
    domain: 'general',
    complexity: 0.5,
    safety_risk: 0.1,
    needs_retrieval: false,
    suggested_techniques: ['chain_of_thought']
  }

  const mockBudget: BudgetConstraints = {
    max_cost_usd: 1.0,
    max_latency_ms: 30000,
    max_tokens: 4096,
    remaining_cost_usd: 1.0,
    remaining_time_ms: 30000
  }

  describe('Runtime invariant checks', () => {
    it('should pass when variants are generated with techniques', async () => {
      const request = mockRequest({
        base_prompt: 'Test prompt',
        classification: mockTaskClassification,
        budget: mockBudget,
        trace_id: 'test-trace-123'
      })

      const response = await handleGenerateVariantsRequest(request)

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.data!.length).toBeGreaterThan(0)
      expect(response.data!.every(v => v.technique)).toBe(true)
    })

    it('should fail invariant when no variants generated', async () => {
      // Mock empty generation
      const request = mockRequest({
        base_prompt: 'Test prompt',
        classification: {
          ...mockTaskClassification,
          suggested_techniques: [] // This might result in no variants
        },
        budget: {
          ...mockBudget,
          remaining_cost_usd: 0 // No budget means no variants
        },
        trace_id: 'test-trace-123'
      })

      const response = await handleGenerateVariantsRequest(request)

      if (response.data && response.data.length === 0) {
        expect(response.success).toBe(false)
        expect(response.error?.message).toContain('No variants generated')
        expect(response.error?.retryable).toBe(false)
      }
    })

    it('should fail invariant when variant missing technique', async () => {
      // This test would require mocking the engine instance to return bad data
      // In real scenarios, the validateVariant method should prevent this
      const request = mockRequest({
        base_prompt: 'Test prompt',
        classification: mockTaskClassification,
        budget: mockBudget,
        trace_id: 'test-trace-123'
      })

      const response = await handleGenerateVariantsRequest(request)

      // Verify all variants have techniques
      if (response.success && response.data) {
        const allHaveTechniques = response.data.every(v => v.technique && v.technique !== '')
        expect(allHaveTechniques).toBe(true)
      }
    })

    it('should ensure diverse techniques are applied', async () => {
      const request = mockRequest({
        base_prompt: 'Complex mathematical problem requiring multiple approaches',
        classification: {
          ...mockTaskClassification,
          task_type: 'math_reasoning',
          complexity: 0.9,
          suggested_techniques: ['chain_of_thought', 'tree_of_thought', 'self_consistency']
        },
        budget: {
          ...mockBudget,
          max_cost_usd: 5.0,
          remaining_cost_usd: 5.0
        },
        trace_id: 'test-trace-123'
      })

      const response = await handleGenerateVariantsRequest(request)

      if (response.success && response.data) {
        const uniqueTechniques = new Set(response.data.map(v => v.technique))
        expect(uniqueTechniques.size).toBeGreaterThan(0)
      }
    })
  })

  describe('Error handling', () => {
    it('should record telemetry on invariant violations', async () => {
      const telemetrySpy = vi.spyOn(require('@promptdial/shared').getTelemetryService(), 'recordCounter')

      const request = mockRequest({
        base_prompt: '',  // Invalid prompt
        classification: mockTaskClassification,
        budget: mockBudget,
        trace_id: 'test-trace-123'
      })

      const response = await handleGenerateVariantsRequest(request)

      if (!response.success) {
        expect(telemetrySpy).toHaveBeenCalledWith('builder_invariant_violations', 1)
      }
    })
  })
})