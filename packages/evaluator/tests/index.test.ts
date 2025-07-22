import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CalibratedEvaluatorEnsemble,
  getEvaluatorEnsemble,
  handleEvaluateRequest,
  handleCompareRequest,
  handleFeedbackRequest
} from '../src/index'
import {
  createTestPromptVariant,
  createTestTaskClassification,
  createTestEvaluationResult,
  createTestServiceRequest
} from '@promptdial/shared'
import { BaseEvaluator } from '../src/evaluators/base'

// Mock dependencies
vi.mock('@promptdial/shared', async () => {
  const actual = await vi.importActual('@promptdial/shared')
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    getTelemetryService: () => ({
      recordLatency: vi.fn(),
      recordMetric: vi.fn(),
      recordCounter: vi.fn()
    }),
    createServiceResponse: (request: any, data?: any, error?: any) => ({
      request_id: request.request_id || 'test-request',
      success: !error,
      data,
      error,
      timestamp: new Date(),
      service: 'evaluator'
    }),
    createServiceError: (code: string, message: string) => ({
      code,
      message,
      details: null,
      retryable: true
    }),
    mean: (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length,
    confidenceInterval: (values: number[]) => {
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      return [mean - 0.1, mean + 0.1] as [number, number]
    }
  }
})

// Mock evaluator registry
const mockEvaluator = {
  getName: vi.fn().mockReturnValue('mock_evaluator'),
  requiresLLM: vi.fn().mockReturnValue(false),
  requiresReference: vi.fn().mockReturnValue(false),
  evaluate: vi.fn().mockResolvedValue({
    scores: { mock_evaluator: 0.85 }
  })
}

vi.mock('../src/evaluators', () => ({
  BaseEvaluator: class {
    getName() { return 'base' }
    requiresLLM() { return false }
    requiresReference() { return false }
  },
  createEvaluatorRegistry: () => new Map([
    ['g_eval', mockEvaluator],
    ['chat_eval', mockEvaluator],
    ['self_consistency', mockEvaluator]
  ])
}))

// Mock calibration monitor
const mockCalibrationMonitor = {
  calibrateScore: vi.fn((evaluator: string, score: number) => score),
  addDataPoint: vi.fn(),
  addHumanFeedback: vi.fn(),
  getCalibrationStats: vi.fn().mockReturnValue({
    total_samples: 100,
    calibrated_evaluators: ['g_eval', 'chat_eval']
  })
}

vi.mock('../src/calibration', () => ({
  getCalibrationMonitor: () => mockCalibrationMonitor,
  CalibrationMonitor: vi.fn()
}))

describe('CalibratedEvaluatorEnsemble', () => {
  let ensemble: CalibratedEvaluatorEnsemble

  beforeEach(() => {
    vi.clearAllMocks()
    ensemble = new CalibratedEvaluatorEnsemble()
  })

  describe('evaluate', () => {
    it('should evaluate a variant with applicable evaluators', async () => {
      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()
      const references = ['Reference answer']

      const result = await ensemble.evaluate(
        variant,
        response,
        taskMeta,
        references,
        'trace-123'
      )

      expect(result).toBeDefined()
      expect(result.variant_id).toBe(variant.id)
      expect(result.scores).toBeDefined()
      expect(result.final_score).toBeGreaterThan(0)
      expect(result.confidence_interval).toHaveLength(2)
      
      // Verify evaluator was called
      expect(mockEvaluator.evaluate).toHaveBeenCalled()
    })

    it('should handle evaluator failures gracefully', async () => {
      mockEvaluator.evaluate.mockRejectedValueOnce(new Error('Evaluator failed'))

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      // Should not throw - failed evaluators are caught
      const result = await ensemble.evaluate(variant, response, taskMeta)
      
      expect(result).toBeDefined()
      expect(result.variant_id).toBe(variant.id)
    })

    it('should apply calibration to scores', async () => {
      mockEvaluator.evaluate.mockResolvedValueOnce({
        scores: { g_eval: 0.8 }
      })
      mockCalibrationMonitor.calibrateScore.mockReturnValueOnce(0.85)

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      const result = await ensemble.evaluate(variant, response, taskMeta)

      expect(mockCalibrationMonitor.calibrateScore).toHaveBeenCalledWith('g_eval', 0.8)
      expect(result.scores.g_eval).toBe(0.85)
    })

    it('should detect disagreement between evaluators', async () => {
      // Reset mocks for multiple evaluators
      const evaluators = new Map([
        ['e1', {
          ...mockEvaluator,
          getName: () => 'e1',
          evaluate: vi.fn().mockResolvedValue({ scores: { e1: 0.9 } })
        }],
        ['e2', {
          ...mockEvaluator,
          getName: () => 'e2',
          evaluate: vi.fn().mockResolvedValue({ scores: { e2: 0.5 } })
        }]
      ])

      vi.mocked(require('../src/evaluators').createEvaluatorRegistry).mockReturnValueOnce(evaluators)
      ensemble = new CalibratedEvaluatorEnsemble()

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      const result = await ensemble.evaluate(variant, response, taskMeta)

      // Should detect high disagreement (0.9 - 0.5 = 0.4 > 0.3)
      expect(result.calibration_error).toBeDefined()
      expect(result.calibration_error).toBeGreaterThan(0.3)
    })

    it('should include self-consistency evaluator for consistency variants', async () => {
      const variant = createTestPromptVariant({
        technique: 'self_consistency_cot'
      })
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      await ensemble.evaluate(variant, response, taskMeta)

      // Verify self-consistency evaluator was included
      expect(mockEvaluator.evaluate).toHaveBeenCalled()
    })
  })

  describe('compareVariants', () => {
    it('should compare multiple variants and sort by score', async () => {
      const variants = [
        { variant: createTestPromptVariant({ id: 'v1' }), response: 'Response 1' },
        { variant: createTestPromptVariant({ id: 'v2' }), response: 'Response 2' },
        { variant: createTestPromptVariant({ id: 'v3' }), response: 'Response 3' }
      ]
      const taskMeta = createTestTaskClassification()

      // Mock different scores for sorting
      mockEvaluator.evaluate
        .mockResolvedValueOnce({ scores: { mock: 0.7 } })
        .mockResolvedValueOnce({ scores: { mock: 0.9 } })
        .mockResolvedValueOnce({ scores: { mock: 0.8 } })

      const results = await ensemble.compareVariants(variants, taskMeta)

      expect(results).toHaveLength(3)
      // Should be sorted by score (highest first)
      expect(results[0].variant.id).toBe('v2') // 0.9
      expect(results[1].variant.id).toBe('v3') // 0.8
      expect(results[2].variant.id).toBe('v1') // 0.7
    })
  })

  describe('addHumanFeedback', () => {
    it('should add human feedback for calibration', () => {
      ensemble.addHumanFeedback('variant-123', 0.85)

      expect(mockCalibrationMonitor.addHumanFeedback).toHaveBeenCalledWith(
        'variant-123',
        0.85
      )
    })
  })

  describe('getCalibrationStats', () => {
    it('should return calibration statistics', () => {
      const stats = ensemble.getCalibrationStats()

      expect(stats).toEqual({
        total_samples: 100,
        calibrated_evaluators: ['g_eval', 'chat_eval']
      })
    })
  })
})

describe('Service Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleEvaluateRequest', () => {
    it('should handle evaluation request successfully', async () => {
      const request = createTestServiceRequest({
        variant: createTestPromptVariant(),
        response: 'Test response',
        task_meta: createTestTaskClassification(),
        references: ['Reference'],
        trace_id: 'trace-123'
      })

      const response = await handleEvaluateRequest(request as any)

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.data.variant_id).toBeDefined()
      expect(response.data.scores).toBeDefined()
    })

    it('should handle evaluation failure', async () => {
      mockEvaluator.evaluate.mockRejectedValueOnce(new Error('Evaluation failed'))

      const request = createTestServiceRequest({
        variant: createTestPromptVariant(),
        response: 'Test response',
        task_meta: createTestTaskClassification()
      })

      const response = await handleEvaluateRequest(request as any)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error.code).toBe('E005')
    })
  })

  describe('handleCompareRequest', () => {
    it('should handle comparison request successfully', async () => {
      const request = createTestServiceRequest({
        variants: [
          { variant: createTestPromptVariant({ id: 'v1' }), response: 'Response 1' },
          { variant: createTestPromptVariant({ id: 'v2' }), response: 'Response 2' }
        ],
        task_meta: createTestTaskClassification(),
        references: ['Reference']
      })

      const response = await handleCompareRequest(request as any)

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.data).toHaveLength(2)
      expect(response.data[0].variant).toBeDefined()
      expect(response.data[0].evaluation).toBeDefined()
    })

    it('should handle comparison failure', async () => {
      mockEvaluator.evaluate.mockRejectedValueOnce(new Error('Comparison failed'))

      const request = createTestServiceRequest({
        variants: [
          { variant: createTestPromptVariant(), response: 'Response' }
        ],
        task_meta: createTestTaskClassification()
      })

      const response = await handleCompareRequest(request as any)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })
  })

  describe('handleFeedbackRequest', () => {
    it('should handle feedback request successfully', async () => {
      const request = createTestServiceRequest({
        variant_id: 'variant-123',
        human_score: 0.9
      })

      const response = await handleFeedbackRequest(request as any)

      expect(response.success).toBe(true)
      expect(mockCalibrationMonitor.addHumanFeedback).toHaveBeenCalledWith(
        'variant-123',
        0.9
      )
    })

    it('should handle feedback failure', async () => {
      mockCalibrationMonitor.addHumanFeedback.mockImplementationOnce(() => {
        throw new Error('Feedback failed')
      })

      const request = createTestServiceRequest({
        variant_id: 'variant-123',
        human_score: 0.9
      })

      const response = await handleFeedbackRequest(request as any)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })
  })
})

describe('getEvaluatorEnsemble', () => {
  it('should return singleton instance', () => {
    const instance1 = getEvaluatorEnsemble()
    const instance2 = getEvaluatorEnsemble()

    expect(instance1).toBe(instance2)
  })
})