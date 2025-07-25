import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { StreamingTestRunner } from '../../src/testing/runner-streaming'
import { PromptDial } from '../../src/index'
import { testPrompt } from '../../src/testing/clients'
import type { TestResult, ModelProvider } from '../../src/testing/types'
import type { PerformanceTestEvent } from '../../src/testing/runner-events'

// Mock dependencies
vi.mock('../../src/index')
vi.mock('../../src/testing/clients')

describe('StreamingTestRunner', () => {
  let runner: StreamingTestRunner
  let mockTestPrompt: ReturnType<typeof vi.fn>
  let mockOptimize: ReturnType<typeof vi.fn>

  const mockTestResult: TestResult = {
    success: true,
    responseTime: 100,
    tokenCount: 50,
    error: null,
  }

  const mockOptimizationResult = {
    variants: [
      {
        id: 'variant-1',
        optimizedPrompt: 'Optimized prompt 1',
        targetModel: 'gpt-4' as const,
        changes: [],
        quality: { score: 85 },
      },
      {
        id: 'variant-2',
        optimizedPrompt: 'Optimized prompt 2',
        targetModel: 'gpt-4' as const,
        changes: [],
        quality: { score: 90 },
      },
    ],
    summary: {
      totalVariants: 2,
      averageQualityScore: 87.5,
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()

    // Setup mock implementations
    mockTestPrompt = vi.fn().mockResolvedValue(mockTestResult)
    ;(testPrompt as any).mockImplementation(mockTestPrompt)

    mockOptimize = vi.fn().mockResolvedValue(mockOptimizationResult)
    ;(PromptDial as any).mockImplementation(() => ({
      optimize: mockOptimize,
    }))

    runner = new StreamingTestRunner()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('constructor', () => {
    it('should initialize with a unique test ID', () => {
      const runner1 = new StreamingTestRunner()
      const runner2 = new StreamingTestRunner()

      // Access private property through indexing
      const id1 = (runner1 as any).testId
      const id2 = (runner2 as any).testId

      expect(id1).toBeTruthy()
      expect(id2).toBeTruthy()
      expect(id1).not.toBe(id2)
    })
  })

  describe('onEvent', () => {
    it('should register event listeners for all event types', () => {
      const listener = vi.fn()
      runner.onEvent(listener)

      // Test that listener is registered for all event types
      const emitter = (runner as any).emitter
      const eventTypes = [
        'test_started',
        'provider_test_started',
        'provider_test_completed',
        'optimization_started',
        'optimization_completed',
        'test_completed',
        'test_error',
      ]

      eventTypes.forEach((type) => {
        expect(emitter.listenerCount(type)).toBe(1)
      })
    })
  })

  describe('runTest', () => {
    it('should run a complete test with default options', async () => {
      const events: PerformanceTestEvent[] = []
      const listener = vi.fn((event: PerformanceTestEvent) => {
        events.push(event)
      })

      runner.onEvent(listener)

      const result = await runner.runTest('Test prompt')

      // Verify test structure
      expect(result).toMatchObject({
        original: {
          openai: mockTestResult,
          anthropic: mockTestResult,
          google: mockTestResult,
        },
        optimized: expect.arrayContaining([
          expect.objectContaining({
            variant: 'Optimized prompt 1',
            results: {
              openai: mockTestResult,
              anthropic: mockTestResult,
              google: mockTestResult,
            },
            quality: 85,
          }),
          expect.objectContaining({
            variant: 'Optimized prompt 2',
            results: {
              openai: mockTestResult,
              anthropic: mockTestResult,
              google: mockTestResult,
            },
            quality: 90,
          }),
        ]),
        variants: mockOptimizationResult.variants,
        summary: {
          bestVariantIndex: 1, // Second variant has higher quality
          averageImprovement: {
            responseTime: 0,
            tokenCount: 0,
          },
        },
      })

      // Verify all providers were tested
      expect(mockTestPrompt).toHaveBeenCalledTimes(9) // 3 providers × (1 original + 2 variants)

      // Verify optimization was called
      expect(mockOptimize).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        targetModel: 'gpt-4',
      })

      // Verify events were emitted in correct order
      expect(events[0].type).toBe('test_started')
      expect(events).toContainEqual(expect.objectContaining({ type: 'provider_test_started' }))
      expect(events).toContainEqual(expect.objectContaining({ type: 'optimization_started' }))
      expect(events).toContainEqual(expect.objectContaining({ type: 'optimization_completed' }))
      expect(events[events.length - 1].type).toBe('test_completed')
    })

    it('should use custom options when provided', async () => {
      await runner.runTest('Test prompt', {
        targetModel: 'claude-3-opus',
      })

      expect(mockOptimize).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        targetModel: 'claude-3-opus',
      })
    })

    it('should handle test errors gracefully', async () => {
      const testError = new Error('Test failed')
      mockTestPrompt.mockRejectedValueOnce(testError)

      const events: PerformanceTestEvent[] = []
      runner.onEvent((event) => events.push(event))

      await expect(runner.runTest('Test prompt')).rejects.toThrow('Test failed')

      // Verify error event was emitted
      const errorEvent = events.find((e) => e.type === 'test_error')
      expect(errorEvent).toBeDefined()
      expect(errorEvent).toMatchObject({
        type: 'test_error',
        error: 'Test failed',
      })
    })

    it('should handle non-Error exceptions', async () => {
      mockTestPrompt.mockRejectedValueOnce('String error')

      const events: PerformanceTestEvent[] = []
      runner.onEvent((event) => events.push(event))

      await expect(runner.runTest('Test prompt')).rejects.toThrow('String error')

      const errorEvent = events.find((e) => e.type === 'test_error')
      expect(errorEvent?.error).toBe('Unknown error')
    })

    it('should calculate improvements correctly', async () => {
      // Setup different results for original vs optimized
      const originalResult: TestResult = {
        success: true,
        responseTime: 200,
        tokenCount: 100,
        error: null,
      }

      const optimizedResult: TestResult = {
        success: true,
        responseTime: 150,
        tokenCount: 80,
        error: null,
      }

      mockTestPrompt
        .mockResolvedValueOnce(originalResult) // OpenAI original
        .mockResolvedValueOnce(originalResult) // Anthropic original
        .mockResolvedValueOnce(originalResult) // Google original
        .mockResolvedValueOnce(optimizedResult) // OpenAI variant 1
        .mockResolvedValueOnce(optimizedResult) // Anthropic variant 1
        .mockResolvedValueOnce(optimizedResult) // Google variant 1
        .mockResolvedValueOnce(optimizedResult) // OpenAI variant 2
        .mockResolvedValueOnce(optimizedResult) // Anthropic variant 2
        .mockResolvedValueOnce(optimizedResult) // Google variant 2

      const result = await runner.runTest('Test prompt')

      // Verify improvements calculation
      // (200-150)/200 * 100 = 25% improvement in response time
      // (100-80)/100 * 100 = 20% improvement in token count
      expect(result.summary.averageImprovement).toMatchObject({
        responseTime: 25,
        tokenCount: 20,
      })
    })

    it('should handle mixed success/error results', async () => {
      const errorResult: TestResult = {
        success: false,
        responseTime: 0,
        tokenCount: 0,
        error: 'API error',
      }

      // Mix of success and error results
      mockTestPrompt
        .mockResolvedValueOnce(mockTestResult) // OpenAI original - success
        .mockResolvedValueOnce(errorResult) // Anthropic original - error
        .mockResolvedValueOnce(mockTestResult) // Google original - success
        .mockResolvedValue(mockTestResult) // All other calls succeed

      const result = await runner.runTest('Test prompt')

      // Test should complete successfully
      expect(result.original.openai.success).toBe(true)
      expect(result.original.anthropic.success).toBe(false)
      expect(result.original.google.success).toBe(true)
    })

    it('should emit events with correct data', async () => {
      const events: PerformanceTestEvent[] = []
      runner.onEvent((event) => events.push(event))

      await runner.runTest('Test prompt', {
        targetModel: 'gemini-pro',
      })

      // Check test_started event
      const startEvent = events.find((e) => e.type === 'test_started')
      expect(startEvent).toMatchObject({
        type: 'test_started',
        prompt: 'Test prompt',
        targetModel: 'gemini-pro',
        testId: expect.any(String),
        timestamp: expect.any(Date),
      })

      // Check provider_test_started events
      const providerStartEvents = events.filter((e) => e.type === 'provider_test_started')
      expect(providerStartEvents).toHaveLength(9) // 3 providers × 3 tests
      expect(providerStartEvents[0]).toMatchObject({
        provider: 'openai',
        variant: 'original',
      })

      // Check optimization events
      const optStartEvent = events.find((e) => e.type === 'optimization_started')
      expect(optStartEvent).toBeDefined()

      const optCompleteEvent = events.find((e) => e.type === 'optimization_completed')
      expect(optCompleteEvent).toMatchObject({
        type: 'optimization_completed',
        variantCount: 2,
      })

      // Check test_completed event
      const completeEvent = events.find((e) => e.type === 'test_completed')
      expect(completeEvent).toMatchObject({
        type: 'test_completed',
        summary: {
          bestVariantIndex: 1,
          averageImprovement: expect.any(Object),
        },
      })
    })

    it('should use onEvent option if provided', async () => {
      const customListener = vi.fn()

      await runner.runTest('Test prompt', {
        onEvent: customListener,
      })

      expect(customListener).toHaveBeenCalled()
      expect(customListener.mock.calls[0][0]).toMatchObject({
        type: 'test_started',
      })
    })

    it('should identify best variant correctly', async () => {
      // Create variants with different quality scores
      const customOptResult = {
        variants: [
          { ...mockOptimizationResult.variants[0], quality: { score: 70 } },
          { ...mockOptimizationResult.variants[1], quality: { score: 95 } },
        ],
        summary: mockOptimizationResult.summary,
      }

      mockOptimize.mockResolvedValueOnce(customOptResult)

      const result = await runner.runTest('Test prompt')

      expect(result.summary.bestVariantIndex).toBe(1) // Second variant has highest score
    })

    it('should handle variants without quality scores', async () => {
      const variantsWithoutQuality = {
        variants: [
          { ...mockOptimizationResult.variants[0], quality: undefined },
          { ...mockOptimizationResult.variants[1], quality: undefined },
        ],
        summary: mockOptimizationResult.summary,
      }

      mockOptimize.mockResolvedValueOnce(variantsWithoutQuality)

      const result = await runner.runTest('Test prompt')

      // Should default to 0 quality and select first variant
      expect(result.summary.bestVariantIndex).toBe(0)
      expect(result.optimized[0].quality).toBe(0)
      expect(result.optimized[1].quality).toBe(0)
    })

    it('should handle empty optimization results', async () => {
      mockOptimize.mockResolvedValueOnce({
        variants: [],
        summary: { totalVariants: 0, averageQualityScore: 0 },
      })

      const result = await runner.runTest('Test prompt')

      expect(result.optimized).toHaveLength(0)
      expect(result.summary.averageImprovement).toEqual({
        responseTime: 0,
        tokenCount: 0,
      })
    })
  })

  describe('calculateImprovements', () => {
    it('should return zero improvements when no valid comparisons', async () => {
      // All results have errors
      const errorResult: TestResult = {
        success: false,
        responseTime: 0,
        tokenCount: 0,
        error: 'Error',
      }

      mockTestPrompt.mockResolvedValue(errorResult)

      const result = await runner.runTest('Test prompt')

      expect(result.summary.averageImprovement).toEqual({
        responseTime: 0,
        tokenCount: 0,
      })
    })
  })
})
