/**
 * PromptDial 2.0 - Optimizer Integration Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OptimizerService } from '../index'
import { OptimizationRequest, OptimizationResult } from '../types'
import { PromptVariant, EvaluationResult } from '@promptdial/shared'

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
      recordMetric: vi.fn(),
      recordLatency: vi.fn(),
      recordCounter: vi.fn(),
      incrementCounter: vi.fn(),
    }),
  }
})

describe('OptimizerService Integration', () => {
  let optimizer: OptimizerService

  beforeEach(() => {
    vi.clearAllMocks()
    optimizer = new OptimizerService()
  })

  const createVariant = (id: string, cost: number, latency: number): PromptVariant => ({
    id,
    technique: 'test',
    prompt: `Test prompt for ${id}`,
    temperature: 0.7,
    est_tokens: 100,
    cost_usd: cost,
    latency_ms: latency,
  })

  const createEvaluation = (variantId: string, score: number): EvaluationResult => ({
    variant_id: variantId,
    scores: { test: score },
    final_score: score,
    confidence_interval: [score - 0.05, score + 0.05],
  })

  describe('optimize method', () => {
    it('should optimize with default settings', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('v1', 0.01, 1000),
            evaluation: createEvaluation('v1', 0.9),
          },
          {
            variant: createVariant('v2', 0.005, 2000),
            evaluation: createEvaluation('v2', 0.8),
          },
          {
            variant: createVariant('v3', 0.02, 500),
            evaluation: createEvaluation('v3', 0.85),
          },
        ],
      }

      const result = await optimizer.optimize(request)

      expect(result.pareto_frontier).toBeDefined()
      expect(result.pareto_frontier.length).toBeGreaterThan(0)
      expect(result.recommended).toBeDefined()
      expect(result.alternatives).toBeDefined()
      expect(result.trade_offs).toBeDefined()
    })

    it('should respect quality constraints', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('low-quality', 0.001, 500),
            evaluation: createEvaluation('low-quality', 0.6),
          },
          {
            variant: createVariant('high-quality', 0.02, 1000),
            evaluation: createEvaluation('high-quality', 0.95),
          },
        ],
        constraints: {
          min_quality: 0.8,
        },
      }

      const result = await optimizer.optimize(request)

      expect(result.recommended.variant_id).toBe('high-quality')
      expect(result.pareto_frontier).toHaveLength(1)
    })

    it('should respect cost constraints', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('expensive', 0.15, 500),
            evaluation: createEvaluation('expensive', 0.95),
          },
          {
            variant: createVariant('cheap', 0.005, 1000),
            evaluation: createEvaluation('cheap', 0.85),
          },
        ],
        constraints: {
          max_cost: 0.01,
        },
      }

      const result = await optimizer.optimize(request)

      expect(result.recommended.variant_id).toBe('cheap')
    })

    it('should use preferences in utility mode', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('quality-focused', 0.02, 2000),
            evaluation: createEvaluation('quality-focused', 0.95),
          },
          {
            variant: createVariant('speed-focused', 0.01, 500),
            evaluation: createEvaluation('speed-focused', 0.8),
          },
        ],
        preferences: {
          quality: 0.8,
          cost: 0.1,
          latency: 0.1,
        },
        selection_mode: 'utility',
      }

      const result = await optimizer.optimize(request)

      expect(result.recommended.variant_id).toBe('quality-focused')
    })

    it('should find knee point in pareto mode', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('extreme-quality', 0.1, 5000),
            evaluation: createEvaluation('extreme-quality', 0.99),
          },
          {
            variant: createVariant('extreme-speed', 0.001, 100),
            evaluation: createEvaluation('extreme-speed', 0.7),
          },
          {
            variant: createVariant('balanced', 0.01, 1000),
            evaluation: createEvaluation('balanced', 0.85),
          },
        ],
        selection_mode: 'pareto',
      }

      const result = await optimizer.optimize(request)

      // Should select balanced option as knee point
      expect(result.recommended.variant_id).toBe('balanced')
    })

    it('should provide meaningful trade-off analysis', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('option-a', 0.01, 1000),
            evaluation: createEvaluation('option-a', 0.9),
          },
          {
            variant: createVariant('option-b', 0.005, 2000),
            evaluation: createEvaluation('option-b', 0.8),
          },
        ],
      }

      const result = await optimizer.optimize(request)

      expect(result.trade_offs).toHaveLength(result.alternatives.length)

      for (const tradeOff of result.trade_offs) {
        expect(tradeOff.from_variant).toBe(result.recommended.variant_id)
        expect(tradeOff.to_variant).toBeDefined()
        expect(tradeOff.recommendation).toBeDefined()
        expect(tradeOff.recommendation.length).toBeGreaterThan(0)
      }
    })

    it('should handle edge case with single variant', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('only', 0.01, 1000),
            evaluation: createEvaluation('only', 0.85),
          },
        ],
      }

      const result = await optimizer.optimize(request)

      expect(result.pareto_frontier).toHaveLength(1)
      expect(result.recommended.variant_id).toBe('only')
      expect(result.alternatives).toHaveLength(0)
      expect(result.trade_offs).toHaveLength(0)
    })

    it('should throw error when no variants satisfy constraints', async () => {
      const request: OptimizationRequest = {
        variants: [
          {
            variant: createVariant('v1', 0.1, 1000),
            evaluation: createEvaluation('v1', 0.5),
          },
        ],
        constraints: {
          min_quality: 0.9,
          max_cost: 0.001,
        },
      }

      await expect(optimizer.optimize(request)).rejects.toThrow(
        'No variants satisfy the given constraints',
      )
    })
  })
})
