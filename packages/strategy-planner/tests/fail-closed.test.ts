import { describe, it, expect, beforeEach } from 'vitest'
import { FailClosedHandler } from '../src/fail-closed'
import { ValidationError, PlannerError, Technique } from '../src/types'

describe('FailClosedHandler', () => {
  let handler: FailClosedHandler

  beforeEach(() => {
    handler = new FailClosedHandler()
  })

  describe('handleError', () => {
    it('should return baseline response for validation errors', () => {
      const error = new ValidationError('Invalid technique')
      const startTime = Date.now() - 50

      const response = handler.handleError(error, startTime)

      expect(response.suggested_techniques).toEqual([Technique.CHAIN_OF_THOUGHT])
      expect(response.confidence).toBe(0.5)
      expect(response.metadata?.modelUsed).toBe('baseline')
      expect(response.metadata?.failedValidations).toContain('Validation failed: Invalid technique')
    })

    it('should return baseline response for planner errors', () => {
      const error = new PlannerError('LLM timeout')
      const startTime = Date.now() - 100

      const response = handler.handleError(error, startTime)

      expect(response.suggested_techniques).toEqual([Technique.CHAIN_OF_THOUGHT])
      expect(response.metadata?.failedValidations).toContain('Planner error: LLM timeout')
    })

    it('should handle unexpected errors', () => {
      const error = new Error('Unexpected error')
      const startTime = Date.now()

      const response = handler.handleError(error, startTime)

      expect(response.suggested_techniques).toEqual([Technique.CHAIN_OF_THOUGHT])
      expect(response.metadata?.failedValidations).toContain('Unexpected error: Unexpected error')
    })

    it('should track processing time correctly', () => {
      const error = new Error('Test error')
      const startTime = Date.now() - 75

      const response = handler.handleError(error, startTime)

      expect(response.metadata?.processingTimeMs).toBeGreaterThanOrEqual(75)
      expect(response.metadata?.processingTimeMs).toBeLessThan(100)
    })
  })

  describe('wrapOperation', () => {
    it('should return result on success', async () => {
      const operation = async () => 'success'
      const fallback = (error: Error) => 'fallback'

      const result = await handler.wrapOperation(operation, fallback)
      expect(result).toBe('success')
    })

    it('should use fallback on error', async () => {
      const operation = async () => {
        throw new Error('Operation failed')
      }
      const fallback = (error: Error) => 'fallback result'

      const result = await handler.wrapOperation(operation, fallback)
      expect(result).toBe('fallback result')
    })
  })

  describe('isBaselineResponse', () => {
    it('should identify baseline responses', () => {
      const baseline = handler.getBaselineResponse()
      expect(handler.isBaselineResponse(baseline)).toBe(true)
    })

    it('should reject non-baseline responses', () => {
      const nonBaseline = {
        suggested_techniques: [Technique.TREE_OF_THOUGHT],
        rationale: 'Advanced technique',
        confidence: 0.9,
        metadata: {
          processingTimeMs: 50,
          modelUsed: 'gpt-4',
        },
      }

      expect(handler.isBaselineResponse(nonBaseline)).toBe(false)
    })
  })

  describe('getBaselineResponse', () => {
    it('should return consistent baseline response', () => {
      const response1 = handler.getBaselineResponse()
      const response2 = handler.getBaselineResponse()

      expect(response1).toEqual(response2)
      expect(response1.suggested_techniques).toEqual([Technique.CHAIN_OF_THOUGHT])
      expect(response1.confidence).toBe(0.5)
    })
  })
})
