import { describe, it, expect, vi, beforeEach } from 'vitest'
import axios from 'axios'
import { RequestOrchestrator } from '../src/orchestrator'
import { ServiceConfig } from '../src/services'
import {
  createTestOptimizationRequest,
  createTestPromptVariant,
  createTestTaskClassification,
  createTestEvaluationResult,
} from '@promptdial/shared'
import type { OptimizationRequest } from '@promptdial/shared'

// Mock axios
vi.mock('axios')

// Mock shared dependencies
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
    getTelemetryService: () => ({
      recordMetric: vi.fn(),
      recordCounter: vi.fn(),
      trackEvent: vi.fn(),
      trackError: vi.fn(),
      flush: vi.fn(),
    }),
  }
})

describe('RequestOrchestrator', () => {
  let orchestrator: RequestOrchestrator
  let mockServices: Record<string, ServiceConfig>
  let mockAxios: any

  beforeEach(() => {
    vi.clearAllMocks()

    mockServices = {
      safety: {
        name: 'SafetyGuard',
        url: 'http://localhost:3006',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 2,
      },
      classifier: {
        name: 'Classifier',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 2,
      },
      retrieval: {
        name: 'RetrievalHub',
        url: 'http://localhost:3004',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 2,
      },
      technique: {
        name: 'TechniqueEngine',
        url: 'http://localhost:3003',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 2,
      },
      evaluator: {
        name: 'Evaluator',
        url: 'http://localhost:3005',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 2,
      },
      optimizer: {
        name: 'Optimizer',
        url: 'http://localhost:3007',
        healthEndpoint: '/health',
        timeout: 5000,
        retries: 2,
      },
    }

    orchestrator = new RequestOrchestrator(mockServices)
    mockAxios = vi.mocked(axios)

    // Set up environment
    process.env.OPENAI_API_KEY = 'test-key'
  })

  describe('optimize', () => {
    let mockResponses: Record<string, any>

    beforeEach(() => {
      const testVariant = createTestPromptVariant()
      const testClassification = createTestTaskClassification()
      const testEvaluation = createTestEvaluationResult()

      mockResponses = {
        safety_check: {
          data: {
            safe: true,
            sanitized_prompt: 'Test prompt',
          },
        },
        safety_check_variant: {
          data: {
            safe: true,
          },
        },
        classify: {
          data: testClassification,
        },
        retrieval: {
          data: {
            documents: ['Example 1', 'Example 2'],
          },
        },
        technique: {
          data: {
            variants: [testVariant],
          },
        },
        llm_runner: {
          data: {
            response: 'Test LLM response',
          },
        },
        evaluator: {
          data: testEvaluation,
        },
        optimizer: {
          data: {
            recommended: {
              variant: testVariant,
              objectives: { quality: 0.9, cost: 0.1, latency: 100 },
            },
            alternatives: [],
            pareto_frontier: [
              { variant: testVariant, objectives: { quality: 0.9, cost: 0.1, latency: 100 } },
            ],
          },
        },
      }

      // Set up axios mock to return appropriate responses
      mockAxios.post.mockImplementation((url: string) => {
        if (url.includes('/check')) return Promise.resolve(mockResponses.safety_check)
        if (url.includes('/check-variant'))
          return Promise.resolve(mockResponses.safety_check_variant)
        if (url.includes('/classify')) return Promise.resolve(mockResponses.classify)
        if (url.includes('/search')) return Promise.resolve(mockResponses.retrieval)
        if (url.includes('/generate')) return Promise.resolve(mockResponses.technique)
        if (url.includes('/run')) return Promise.resolve(mockResponses.llm_runner)
        if (url.includes('/evaluate')) return Promise.resolve(mockResponses.evaluator)
        if (url.includes('/optimize')) return Promise.resolve(mockResponses.optimizer)

        return Promise.reject(new Error('Unknown endpoint'))
      })
    })

    it('should complete full optimization flow', async () => {
      const request = createTestOptimizationRequest()
      const result = await orchestrator.optimize(request, 'trace-123')

      expect(result).toBeDefined()
      expect(result.trace_id).toBe('trace-123')
      expect(result.original_prompt).toBe(request.prompt)
      expect(result.task_classification).toBeDefined()
      expect(result.variants).toHaveLength(1)
      expect(result.recommended_variant).toBeDefined()
      expect(result.evaluation_results).toHaveLength(1)
      expect(result.optimization_metadata).toBeDefined()

      // Verify all services were called
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/check'),
        expect.objectContaining({ prompt: request.prompt }),
        expect.any(Object),
      )
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/classify'),
        expect.any(Object),
        expect.any(Object),
      )
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/generate'),
        expect.any(Object),
        expect.any(Object),
      )
    })

    it('should handle unsafe prompts', async () => {
      mockResponses.safety_check.data = {
        safe: false,
        blocked_reason: 'Contains harmful content',
      }

      const request = createTestOptimizationRequest()

      await expect(orchestrator.optimize(request, 'trace-123')).rejects.toThrow(
        'Contains harmful content',
      )
    })

    it('should sanitize prompts when needed', async () => {
      mockResponses.safety_check.data = {
        safe: true,
        sanitized_prompt: 'Sanitized test prompt',
      }

      const request = createTestOptimizationRequest()
      await orchestrator.optimize(request, 'trace-123')

      // Verify sanitized prompt was used in subsequent calls
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/classify'),
        expect.objectContaining({ prompt: 'Sanitized test prompt' }),
        expect.any(Object),
      )
    })

    it('should handle retrieval failures gracefully', async () => {
      // Make retrieval fail
      mockAxios.post.mockImplementation((url: string) => {
        if (url.includes('/search')) {
          return Promise.reject(new Error('Retrieval service down'))
        }
        // Return default responses for other endpoints
        if (url.includes('/check')) return Promise.resolve(mockResponses.safety_check)
        if (url.includes('/check-variant'))
          return Promise.resolve(mockResponses.safety_check_variant)
        if (url.includes('/classify')) return Promise.resolve(mockResponses.classify)
        if (url.includes('/generate')) return Promise.resolve(mockResponses.technique)
        if (url.includes('/run')) return Promise.resolve(mockResponses.llm_runner)
        if (url.includes('/evaluate')) return Promise.resolve(mockResponses.evaluator)
        if (url.includes('/optimize')) return Promise.resolve(mockResponses.optimizer)
        return Promise.reject(new Error('Unknown endpoint'))
      })

      const request = createTestOptimizationRequest({
        context: { examples: true },
      })

      // Should not throw - retrieval failure is handled
      const result = await orchestrator.optimize(request, 'trace-123')
      expect(result).toBeDefined()
    })

    it('should handle final safety check failure', async () => {
      // Make final safety check fail
      mockAxios.post.mockImplementation((url: string) => {
        if (url.includes('/check-variant')) {
          return Promise.resolve({ data: { safe: false } })
        }
        // Return default responses for other endpoints
        if (url.includes('/check')) return Promise.resolve(mockResponses.safety_check)
        if (url.includes('/classify')) return Promise.resolve(mockResponses.classify)
        if (url.includes('/search')) return Promise.resolve(mockResponses.retrieval)
        if (url.includes('/generate')) return Promise.resolve(mockResponses.technique)
        if (url.includes('/run')) return Promise.resolve(mockResponses.llm_runner)
        if (url.includes('/evaluate')) return Promise.resolve(mockResponses.evaluator)
        if (url.includes('/optimize')) {
          // Provide alternatives
          return Promise.resolve({
            data: {
              ...mockResponses.optimizer.data,
              alternatives: [
                {
                  variant: createTestPromptVariant({ id: 'alt-1' }),
                  objectives: { quality: 0.8, cost: 0.1, latency: 100 },
                },
              ],
            },
          })
        }
        return Promise.reject(new Error('Unknown endpoint'))
      })

      const request = createTestOptimizationRequest()
      const result = await orchestrator.optimize(request, 'trace-123')

      // Should use alternative variant
      expect(result.recommended_variant.id).toBe('alt-1')
    })

    it('should throw when no safe variants available', async () => {
      // Make final safety check fail with no alternatives
      mockAxios.post.mockImplementation((url: string) => {
        if (url.includes('/check-variant')) {
          return Promise.resolve({ data: { safe: false } })
        }
        // Return default responses for other endpoints
        if (url.includes('/check')) return Promise.resolve(mockResponses.safety_check)
        if (url.includes('/classify')) return Promise.resolve(mockResponses.classify)
        if (url.includes('/generate')) return Promise.resolve(mockResponses.technique)
        if (url.includes('/run')) return Promise.resolve(mockResponses.llm_runner)
        if (url.includes('/evaluate')) return Promise.resolve(mockResponses.evaluator)
        if (url.includes('/optimize')) return Promise.resolve(mockResponses.optimizer)
        return Promise.reject(new Error('Unknown endpoint'))
      })

      const request = createTestOptimizationRequest()

      await expect(orchestrator.optimize(request, 'trace-123')).rejects.toThrow(
        'No safe variants available',
      )
    })
  })

  describe('callService', () => {
    it('should make service call with correct parameters', async () => {
      mockAxios.post.mockResolvedValueOnce({ data: { result: 'success' } })

      const result = await (orchestrator as any).callService('classifier', '/classify', {
        prompt: 'test',
        trace_id: 'trace-123',
      })

      expect(result.data.result).toBe('success')
      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:3001/classify',
        { prompt: 'test', trace_id: 'trace-123' },
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'X-Trace-ID': 'trace-123',
          },
        },
      )
    })

    it('should throw for unknown service', async () => {
      await expect((orchestrator as any).callService('unknown', '/endpoint', {})).rejects.toThrow(
        'Unknown service: unknown',
      )
    })

    it('should retry on failure', async () => {
      mockAxios.post
        .mockRejectedValueOnce({ response: { status: 503 }, message: 'Service unavailable' })
        .mockResolvedValueOnce({ data: { result: 'success' } })

      const result = await (orchestrator as any).callService('classifier', '/classify', {
        trace_id: 'trace-123',
      })

      expect(result.data.result).toBe('success')
      expect(mockAxios.post).toHaveBeenCalledTimes(2)
    })

    it('should not retry on client errors', async () => {
      mockAxios.post.mockRejectedValueOnce({
        response: { status: 400 },
        message: 'Bad request',
      })

      await expect(
        (orchestrator as any).callService('classifier', '/classify', {}),
      ).rejects.toThrow('Service classifier failed: Bad request')

      expect(mockAxios.post).toHaveBeenCalledTimes(1)
    })

    it('should exhaust retries', async () => {
      mockAxios.post.mockRejectedValue({
        response: { status: 503 },
        message: 'Service unavailable',
      })

      await expect(
        (orchestrator as any).callService('classifier', '/classify', {}),
      ).rejects.toThrow('Service classifier failed: Service unavailable')

      // 1 initial + 2 retries
      expect(mockAxios.post).toHaveBeenCalledTimes(3)
    })
  })

  describe('executeVariants', () => {
    it('should execute variants through LLM runner', async () => {
      const variants = [
        createTestPromptVariant({ id: 'v1' }),
        createTestPromptVariant({ id: 'v2' }),
      ]

      mockAxios.post.mockResolvedValue({
        data: { response: 'LLM response' },
      })

      const results = await (orchestrator as any).executeVariants(variants, 'trace-123')

      expect(results).toHaveLength(2)
      expect(results[0].response).toBe('LLM response')
      expect(results[1].response).toBe('LLM response')
    })

    it('should handle LLM runner failures', async () => {
      const variants = [createTestPromptVariant({ id: 'v1' })]

      mockAxios.post.mockRejectedValueOnce(new Error('LLM error'))

      const results = await (orchestrator as any).executeVariants(variants, 'trace-123')

      expect(results).toHaveLength(1)
      expect(results[0].response).toContain('Error executing variant')
    })

    it('should respect concurrency limit', async () => {
      const variants = Array(10)
        .fill(null)
        .map((_, i) => createTestPromptVariant({ id: `v${i}` }))

      let activeRequests = 0
      let maxConcurrent = 0

      mockAxios.post.mockImplementation(async () => {
        activeRequests++
        maxConcurrent = Math.max(maxConcurrent, activeRequests)

        // Simulate some delay
        await new Promise((resolve) => setTimeout(resolve, 10))

        activeRequests--
        return { data: { response: 'response' } }
      })

      await (orchestrator as any).executeVariants(variants, 'trace-123')

      // Should not exceed concurrency limit of 3
      expect(maxConcurrent).toBeLessThanOrEqual(3)
    })

    it('should throw when no LLM runner available', async () => {
      // Remove API keys
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.GOOGLE_AI_API_KEY

      const variants = [createTestPromptVariant()]

      await expect((orchestrator as any).executeVariants(variants, 'trace-123')).rejects.toThrow(
        'No LLM provider configured',
      )
    })
  })

  describe('getLLMRunnerUrl', () => {
    it('should return OpenAI runner URL when API key present', () => {
      process.env.OPENAI_API_KEY = 'sk-test'
      const url = (orchestrator as any).getLLMRunnerUrl()
      expect(url).toBe('http://localhost:4001')
    })

    it('should return Anthropic runner URL when API key present', () => {
      delete process.env.OPENAI_API_KEY
      process.env.ANTHROPIC_API_KEY = 'ant-test'
      const url = (orchestrator as any).getLLMRunnerUrl()
      expect(url).toBe('http://localhost:4002')
    })

    it('should return Google runner URL when API key present', () => {
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      process.env.GOOGLE_AI_API_KEY = 'goog-test'
      const url = (orchestrator as any).getLLMRunnerUrl()
      expect(url).toBe('http://localhost:4003')
    })

    it('should use custom URLs from environment', () => {
      process.env.OPENAI_API_KEY = 'sk-test'
      process.env.OPENAI_RUNNER_URL = 'http://custom:5000'
      const url = (orchestrator as any).getLLMRunnerUrl()
      expect(url).toBe('http://custom:5000')
    })

    it('should return null when no API keys', () => {
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.GOOGLE_AI_API_KEY
      const url = (orchestrator as any).getLLMRunnerUrl()
      expect(url).toBeNull()
    })
  })

  describe('evaluateVariants', () => {
    it('should evaluate all variants', async () => {
      const variantResponses = [
        { variant: createTestPromptVariant({ id: 'v1' }), response: 'Response 1' },
        { variant: createTestPromptVariant({ id: 'v2' }), response: 'Response 2' },
      ]

      const mockEvaluation = createTestEvaluationResult()
      mockAxios.post.mockResolvedValue({ data: mockEvaluation })

      const results = await (orchestrator as any).evaluateVariants(
        variantResponses,
        createTestTaskClassification(),
        'Reference output',
        'trace-123',
      )

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual(mockEvaluation)

      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/evaluate'),
        expect.objectContaining({
          variant: variantResponses[0].variant,
          response: 'Response 1',
          references: ['Reference output'],
        }),
        expect.any(Object),
      )
    })

    it('should handle evaluation failures with default scores', async () => {
      const variantResponses = [
        { variant: createTestPromptVariant({ id: 'v1' }), response: 'Response 1' },
      ]

      mockAxios.post.mockRejectedValueOnce(new Error('Evaluation failed'))

      const results = await (orchestrator as any).evaluateVariants(
        variantResponses,
        createTestTaskClassification(),
      )

      expect(results).toHaveLength(1)
      expect(results[0].variant_id).toBeDefined()
      expect(results[0].final_score).toBeGreaterThanOrEqual(0)
      expect(results[0].scores).toBeDefined()
    })
  })
})
