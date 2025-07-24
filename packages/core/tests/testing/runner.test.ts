import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { runPerformanceTest, formatTestResults } from '../../src/testing/runner'
import { PromptDial } from '../../src/index'
import { testAllProviders } from '../../src/testing/clients'
import type { TestResult, ModelProvider } from '../../src/testing/types'

// Mock dependencies
vi.mock('../../src/index')
vi.mock('../../src/testing/clients')

// Mock console methods
const originalConsoleLog = console.log

describe('Performance Test Runner', () => {
  let mockTestAllProviders: ReturnType<typeof vi.fn>
  let mockOptimize: ReturnType<typeof vi.fn>

  const mockTestResults: Record<ModelProvider, TestResult> = {
    openai: {
      success: true,
      responseTime: 100,
      tokenCount: 50,
      error: null,
    },
    anthropic: {
      success: true,
      responseTime: 120,
      tokenCount: 55,
      error: null,
    },
    google: {
      success: true,
      responseTime: 110,
      tokenCount: 52,
      error: null,
    },
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
    console.log = vi.fn()

    // Setup mock implementations
    mockTestAllProviders = vi.fn().mockResolvedValue(mockTestResults)
    ;(testAllProviders as any).mockImplementation(mockTestAllProviders)

    mockOptimize = vi.fn().mockResolvedValue(mockOptimizationResult)
    ;(PromptDial as any).mockImplementation(() => ({
      optimize: mockOptimize,
    }))
  })

  afterEach(() => {
    console.log = originalConsoleLog
  })

  describe('runPerformanceTest', () => {
    it('should run a complete performance test with default options', async () => {
      const result = await runPerformanceTest('Test prompt')

      // Verify structure
      expect(result).toMatchObject({
        original: mockTestResults,
        optimized: expect.arrayContaining([
          expect.objectContaining({
            variant: 'Optimized prompt 1',
            results: mockTestResults,
            quality: 85,
          }),
          expect.objectContaining({
            variant: 'Optimized prompt 2',
            results: mockTestResults,
            quality: 90,
          }),
        ]),
        summary: {
          bestVariantIndex: 1, // Second variant has higher quality
          averageImprovement: {
            responseTime: 0,
            tokenCount: 0,
          },
        },
      })

      // Verify mock calls
      expect(mockTestAllProviders).toHaveBeenCalledTimes(3) // 1 original + 2 variants
      expect(mockTestAllProviders).toHaveBeenNthCalledWith(1, 'Test prompt')
      expect(mockTestAllProviders).toHaveBeenNthCalledWith(2, 'Optimized prompt 1')
      expect(mockTestAllProviders).toHaveBeenNthCalledWith(3, 'Optimized prompt 2')

      expect(mockOptimize).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        targetModel: 'gpt-4',
        optimizationLevel: 'advanced',
      })

      // Verify console logs
      expect(console.log).toHaveBeenCalledWith('🔍 Testing original prompt...')
      expect(console.log).toHaveBeenCalledWith('✨ Optimizing prompt...')
      expect(console.log).toHaveBeenCalledWith('📊 Testing 2 optimized variants...')
    })

    it('should use custom options when provided', async () => {
      await runPerformanceTest('Test prompt', {
        targetModel: 'claude-3-opus',
        optimizationLevel: 'expert',
      })

      expect(mockOptimize).toHaveBeenCalledWith({
        prompt: 'Test prompt',
        targetModel: 'claude-3-opus',
        optimizationLevel: 'expert',
      })
    })

    it('should calculate improvements correctly', async () => {
      // Setup different results for optimized variants
      const optimizedResults: Record<ModelProvider, TestResult> = {
        openai: { success: true, responseTime: 80, tokenCount: 40, error: null },
        anthropic: { success: true, responseTime: 100, tokenCount: 45, error: null },
        google: { success: true, responseTime: 90, tokenCount: 42, error: null },
      }

      mockTestAllProviders
        .mockResolvedValueOnce(mockTestResults) // Original
        .mockResolvedValueOnce(optimizedResults) // Variant 1
        .mockResolvedValueOnce(optimizedResults) // Variant 2

      const result = await runPerformanceTest('Test prompt')

      // Calculate expected improvements
      // OpenAI: (100-80)/100 * 100 = 20%
      // Anthropic: (120-100)/120 * 100 = 16.67%
      // Google: (110-90)/110 * 100 = 18.18%
      // Average response time improvement: (20 + 16.67 + 18.18) / 3 = 18.28%

      // Token improvements:
      // OpenAI: (50-40)/50 * 100 = 20%
      // Anthropic: (55-45)/55 * 100 = 18.18%
      // Google: (52-42)/52 * 100 = 19.23%
      // Average: (20 + 18.18 + 19.23) / 3 = 19.14%

      expect(result.summary.averageImprovement.responseTime).toBeCloseTo(18.28, 1)
      expect(result.summary.averageImprovement.tokenCount).toBeCloseTo(19.14, 1)
    })

    it('should handle variants without quality scores', async () => {
      const variantsWithoutQuality = {
        ...mockOptimizationResult,
        variants: mockOptimizationResult.variants.map((v) => ({
          ...v,
          quality: undefined,
        })),
      }

      mockOptimize.mockResolvedValueOnce(variantsWithoutQuality)

      const result = await runPerformanceTest('Test prompt')

      expect(result.optimized[0].quality).toBe(0)
      expect(result.optimized[1].quality).toBe(0)
      expect(result.summary.bestVariantIndex).toBe(0) // Defaults to first when all are 0
    })

    it('should handle provider errors gracefully', async () => {
      const resultsWithError: Record<ModelProvider, TestResult> = {
        openai: { success: true, responseTime: 100, tokenCount: 50, error: null },
        anthropic: { success: false, responseTime: 0, tokenCount: 0, error: 'API error' },
        google: { success: true, responseTime: 110, tokenCount: 52, error: null },
      }

      mockTestAllProviders.mockResolvedValue(resultsWithError)

      const result = await runPerformanceTest('Test prompt')

      // Should complete successfully despite error
      expect(result.original.anthropic.error).toBe('API error')

      // Improvements should only be calculated for successful comparisons
      expect(result.summary.averageImprovement).toBeDefined()
    })

    it('should handle empty optimization results', async () => {
      mockOptimize.mockResolvedValueOnce({
        variants: [],
        summary: { totalVariants: 0, averageQualityScore: 0 },
      })

      const result = await runPerformanceTest('Test prompt')

      expect(result.optimized).toHaveLength(0)
      expect(result.summary.averageImprovement).toEqual({
        responseTime: 0,
        tokenCount: 0,
      })
    })
  })

  describe('formatTestResults', () => {
    const testResults = {
      original: mockTestResults,
      optimized: [
        {
          variant: 'Optimized prompt 1',
          results: {
            openai: { success: true, responseTime: 80, tokenCount: 40, error: null },
            anthropic: { success: true, responseTime: 100, tokenCount: 45, error: null },
            google: { success: true, responseTime: 90, tokenCount: 42, error: null },
          },
          quality: 85,
        },
        {
          variant: 'Optimized prompt 2',
          results: mockTestResults,
          quality: 90,
        },
      ],
      summary: {
        bestVariantIndex: 1,
        averageImprovement: {
          responseTime: 15.5,
          tokenCount: 18.2,
        },
      },
    }

    it('should format results correctly', () => {
      const formatted = formatTestResults(testResults)

      expect(formatted).toContain('📊 Performance Test Results')
      expect(formatted).toContain('🔵 Original Prompt Performance:')
      expect(formatted).toContain('openai: 100ms, 50 tokens')
      expect(formatted).toContain('anthropic: 120ms, 55 tokens')
      expect(formatted).toContain('google: 110ms, 52 tokens')

      expect(formatted).toContain('🟢 Best Optimized Variant (Quality: 90/100):')
      expect(formatted).toContain('openai: 100ms (0.0%), 50 tokens (0.0%)')

      expect(formatted).toContain('📈 Summary:')
      expect(formatted).toContain('Average Response Time Improvement: 15.5%')
      expect(formatted).toContain('Average Token Count Improvement: 18.2%')
      expect(formatted).toContain('Total Variants Tested: 2')
    })

    it('should handle errors in results', () => {
      const resultsWithError = {
        ...testResults,
        original: {
          ...mockTestResults,
          anthropic: { success: false, responseTime: 0, tokenCount: 0, error: 'API Error' },
        },
      }

      const formatted = formatTestResults(resultsWithError)

      expect(formatted).toContain('anthropic: ❌ Error - API Error')
    })

    it('should handle optimized variant errors', () => {
      const resultsWithOptError = {
        ...testResults,
        optimized: [
          testResults.optimized[0],
          {
            ...testResults.optimized[1],
            results: {
              ...testResults.optimized[1].results,
              google: { success: false, responseTime: 0, tokenCount: 0, error: 'Timeout' },
            },
          },
        ],
        summary: {
          ...testResults.summary,
          bestVariantIndex: 1, // Best variant has the error
        },
      }

      const formatted = formatTestResults(resultsWithOptError)

      expect(formatted).toContain('google: ❌ Error - Timeout')
    })

    it('should show raw values when original had error but optimized succeeded', () => {
      const mixedResults = {
        ...testResults,
        original: {
          ...mockTestResults,
          openai: { success: false, responseTime: 0, tokenCount: 0, error: 'Original error' },
        },
      }

      const formatted = formatTestResults(mixedResults)

      // Should show raw values without percentage comparison for OpenAI
      expect(formatted).toContain('openai: 100ms, 50 tokens')
      expect(formatted).not.toContain('openai: 100ms (') // No percentage shown
    })
  })
})
