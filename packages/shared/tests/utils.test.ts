import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  generateTraceId,
  generateVariantId,
  PromptDialError,
  createServiceError,
  isRetryableError,
  createServiceRequest,
  createServiceResponse,
  estimateTokens,
  estimateCost,
  createTelemetryEvent,
  validatePrompt,
  validateBudget,
  createLogger,
  mean,
  stddev,
  confidenceInterval,
  findParetoFrontier,
  retryWithBackoff,
} from '../src/utils'
import { ERROR_CODES, STATUS_CODES } from '../src/constants'

describe('ID Generation', () => {
  describe('generateTraceId', () => {
    it('should generate unique trace IDs', () => {
      const id1 = generateTraceId()
      const id2 = generateTraceId()
      expect(id1).not.toBe(id2)
    })

    it('should generate IDs with correct format', () => {
      const id = generateTraceId()
      expect(id).toMatch(/^[a-z0-9]+-[a-z0-9]{4}$/)
    })
  })

  describe('generateVariantId', () => {
    it('should include technique and index', () => {
      const id = generateVariantId('Few_Shot_COT', 3)
      expect(id).toMatch(/^few_shot_cot-[a-z0-9]+-3$/)
    })

    it('should handle different techniques', () => {
      const id1 = generateVariantId('REACT', 1)
      const id2 = generateVariantId('Chain_Of_Thought', 2)
      expect(id1).toMatch(/^react-/)
      expect(id2).toMatch(/^chain_of_thought-/)
    })
  })
})

describe('Error Handling', () => {
  describe('PromptDialError', () => {
    it('should create error with all properties', () => {
      const error = new PromptDialError('TEST_ERROR', 'Test message', 400, true, {
        extra: 'details',
      })

      expect(error.code).toBe('TEST_ERROR')
      expect(error.message).toBe('Test message')
      expect(error.statusCode).toBe(400)
      expect(error.retryable).toBe(true)
      expect(error.details).toEqual({ extra: 'details' })
      expect(error.name).toBe('PromptDialError')
    })

    it('should use default values', () => {
      const error = new PromptDialError('TEST', 'message')
      expect(error.statusCode).toBe(STATUS_CODES.INTERNAL_ERROR)
      expect(error.retryable).toBe(false)
    })
  })

  describe('createServiceError', () => {
    it('should create service error object', () => {
      const error = createServiceError('CODE', 'message', true, { data: 1 })
      expect(error).toEqual({
        code: 'CODE',
        message: 'message',
        retryable: true,
        details: { data: 1 },
      })
    })
  })

  describe('isRetryableError', () => {
    it('should identify retryable errors', () => {
      expect(
        isRetryableError({ code: ERROR_CODES.SERVICE_UNAVAILABLE, message: '', retryable: false }),
      ).toBe(true)
      expect(isRetryableError({ code: ERROR_CODES.TIMEOUT, message: '', retryable: false })).toBe(
        true,
      )
      expect(
        isRetryableError({ code: ERROR_CODES.RATE_LIMIT_EXCEEDED, message: '', retryable: false }),
      ).toBe(true)
      expect(isRetryableError({ code: 'OTHER', message: '', retryable: true })).toBe(true)
    })

    it('should identify non-retryable errors', () => {
      expect(
        isRetryableError({ code: ERROR_CODES.INVALID_PROMPT, message: '', retryable: false }),
      ).toBe(false)
      expect(isRetryableError({ code: 'OTHER', message: '', retryable: false })).toBe(false)
    })
  })
})

describe('Service Communication', () => {
  describe('createServiceRequest', () => {
    it('should create request with provided trace ID', () => {
      const request = createServiceRequest('api-gateway', 'optimize', { data: 1 }, 'custom-trace')
      expect(request.trace_id).toBe('custom-trace')
      expect(request.service).toBe('api-gateway')
      expect(request.method).toBe('optimize')
      expect(request.payload).toEqual({ data: 1 })
      expect(request.timestamp).toBeInstanceOf(Date)
    })

    it('should generate trace ID if not provided', () => {
      const request = createServiceRequest('service', 'method', {})
      expect(request.trace_id).toBeTruthy()
      expect(request.trace_id).toMatch(/^[a-z0-9]+-[a-z0-9]{4}$/)
    })
  })

  describe('createServiceResponse', () => {
    it('should create success response', () => {
      const request = createServiceRequest('service', 'method', {}, 'trace-123')
      const response = createServiceResponse(request, { result: 'success' })

      expect(response.trace_id).toBe('trace-123')
      expect(response.service).toBe('service')
      expect(response.success).toBe(true)
      expect(response.data).toEqual({ result: 'success' })
      expect(response.error).toBeUndefined()
    })

    it('should create error response', () => {
      const request = createServiceRequest('service', 'method', {})
      const error = createServiceError('ERROR', 'Failed')
      const response = createServiceResponse(request, undefined, error)

      expect(response.success).toBe(false)
      expect(response.error).toEqual(error)
      expect(response.data).toBeUndefined()
    })
  })
})

describe('Token and Cost Estimation', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      expect(estimateTokens('test')).toBe(1) // 4 chars
      expect(estimateTokens('hello world')).toBe(3) // 11 chars -> 3 tokens
      expect(estimateTokens('a'.repeat(100))).toBe(25) // 100 chars -> 25 tokens
    })

    it('should handle empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })
  })

  describe('estimateCost', () => {
    it('should calculate cost for known models', () => {
      expect(estimateCost(1000, 'openai', 'gpt-4')).toBe(0.03)
      expect(estimateCost(2000, 'openai', 'gpt-3.5-turbo')).toBe(0.004)
      expect(estimateCost(500, 'anthropic', 'claude-3-opus')).toBe(0.0075)
    })

    it('should use default rate for unknown models', () => {
      expect(estimateCost(1000, 'unknown', 'model')).toBe(0.01)
    })
  })
})

describe('Telemetry', () => {
  describe('createTelemetryEvent', () => {
    it('should create telemetry event with all fields', () => {
      const event = createTelemetryEvent('optimization_started', 'trace-123', 'variant-456', {
        task_type: 'code_generation',
      })

      expect(event.event_type).toBe('optimization_started')
      expect(event.trace_id).toBe('trace-123')
      expect(event.variant_id).toBe('variant-456')
      expect(event.task_type).toBe('code_generation')
      expect(event.ts_utc).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should handle missing variant ID', () => {
      const event = createTelemetryEvent('event', 'trace-123')
      expect(event.variant_id).toBe('')
    })
  })
})

describe('Validation', () => {
  describe('validatePrompt', () => {
    it('should accept valid prompts', () => {
      expect(() => validatePrompt('Valid prompt')).not.toThrow()
      expect(() => validatePrompt('a')).not.toThrow()
    })

    it('should reject invalid prompts', () => {
      expect(() => validatePrompt('')).toThrow(PromptDialError)
      expect(() => validatePrompt(null as any)).toThrow(PromptDialError)
      expect(() => validatePrompt(undefined as any)).toThrow(PromptDialError)
      expect(() => validatePrompt(123 as any)).toThrow(PromptDialError)
    })

    it('should reject prompts exceeding max length', () => {
      const longPrompt = 'a'.repeat(10001)
      expect(() => validatePrompt(longPrompt)).toThrow(PromptDialError)
    })
  })

  describe('validateBudget', () => {
    it('should accept valid budgets', () => {
      expect(() => validateBudget(0.01, 1000)).not.toThrow()
      expect(() => validateBudget(100, 60000)).not.toThrow()
    })

    it('should reject low cost cap', () => {
      expect(() => validateBudget(0.005, 1000)).toThrow(PromptDialError)
      expect(() => validateBudget(0, 1000)).toThrow(PromptDialError)
    })

    it('should reject low latency cap', () => {
      expect(() => validateBudget(1, 999)).toThrow(PromptDialError)
      expect(() => validateBudget(1, 0)).toThrow(PromptDialError)
    })
  })
})

describe('Logging', () => {
  describe('createLogger', () => {
    beforeEach(() => {
      vi.spyOn(console, 'debug').mockImplementation(() => {})
      vi.spyOn(console, 'info').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    it('should create logger with service name', () => {
      const logger = createLogger('test-service')

      logger.debug('debug message', { extra: 1 })
      expect(console.debug).toHaveBeenCalledWith('[test-service] debug message', { extra: 1 })

      logger.info('info message')
      expect(console.info).toHaveBeenCalledWith('[test-service] info message', undefined)

      logger.warn('warning')
      expect(console.warn).toHaveBeenCalledWith('[test-service] warning', undefined)

      const error = new Error('test error')
      logger.error('error occurred', error, { context: 'test' })
      expect(console.error).toHaveBeenCalledWith('[test-service] error occurred', error, {
        context: 'test',
      })
    })
  })
})

describe('Math Utilities', () => {
  describe('mean', () => {
    it('should calculate mean correctly', () => {
      expect(mean([1, 2, 3, 4, 5])).toBe(3)
      expect(mean([10])).toBe(10)
      expect(mean([0, 0, 0])).toBe(0)
      expect(mean([-1, 1])).toBe(0)
    })

    it('should handle empty array', () => {
      expect(mean([])).toBe(0)
    })
  })

  describe('stddev', () => {
    it('should calculate standard deviation', () => {
      expect(stddev([1, 2, 3, 4, 5])).toBeCloseTo(1.414, 3)
      expect(stddev([10, 10, 10])).toBe(0)
    })

    it('should handle edge cases', () => {
      expect(stddev([])).toBe(0)
      expect(stddev([5])).toBe(0)
    })
  })

  describe('confidenceInterval', () => {
    it('should calculate 95% confidence interval', () => {
      const scores = [0.8, 0.85, 0.9, 0.82, 0.88]
      const [lower, upper] = confidenceInterval(scores)
      expect(lower).toBeLessThan(mean(scores))
      expect(upper).toBeGreaterThan(mean(scores))
    })

    it('should support 99% confidence level', () => {
      const scores = [0.8, 0.85, 0.9, 0.82, 0.88]
      const [lower95, upper95] = confidenceInterval(scores, 0.95)
      const [lower99, upper99] = confidenceInterval(scores, 0.99)

      // 99% CI should be wider
      expect(upper99 - lower99).toBeGreaterThan(upper95 - lower95)
    })
  })
})

describe('Pareto Optimization', () => {
  describe('findParetoFrontier', () => {
    it('should find pareto frontier correctly', () => {
      const points = [
        { id: '1', score: 0.5, cost: 0.01 },
        { id: '2', score: 0.7, cost: 0.02 },
        { id: '3', score: 0.6, cost: 0.03 }, // Dominated by #2
        { id: '4', score: 0.9, cost: 0.05 },
        { id: '5', score: 0.8, cost: 0.08 }, // Dominated by #4
      ]

      const frontier = findParetoFrontier(points)
      expect(frontier).toHaveLength(3)
      expect(frontier.map((p) => p.id)).toEqual(['1', '2', '4'])
    })

    it('should handle single point', () => {
      const points = [{ id: '1', score: 0.5, cost: 0.01 }]
      const frontier = findParetoFrontier(points)
      expect(frontier).toEqual(points)
    })

    it('should handle empty array', () => {
      expect(findParetoFrontier([])).toEqual([])
    })
  })
})

describe('Retry Logic', () => {
  describe('retryWithBackoff', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })
    
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should succeed on first try', async () => {
      const fn = vi.fn().mockResolvedValue('success')
      const result = await retryWithBackoff(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should retry on failure', async () => {
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValue('success')

      const promise = retryWithBackoff(fn, 3, 100)

      // First attempt
      await vi.advanceTimersByTimeAsync(0)
      expect(fn).toHaveBeenCalledTimes(1)

      // Second attempt after 100ms
      await vi.advanceTimersByTimeAsync(100)
      expect(fn).toHaveBeenCalledTimes(2)

      // Third attempt after 200ms more
      await vi.advanceTimersByTimeAsync(200)
      expect(fn).toHaveBeenCalledTimes(3)

      const result = await promise
      expect(result).toBe('success')
    })

    it('should not retry non-retryable errors', async () => {
      const error = new PromptDialError('TEST', 'message', 400, false)
      const fn = vi.fn().mockRejectedValue(error)

      await expect(retryWithBackoff(fn)).rejects.toThrow(error)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('should throw last error after max retries', async () => {
      const error = new Error('persistent failure')
      const fn = vi.fn().mockRejectedValue(error)

      const promise = retryWithBackoff(fn, 2, 100)

      await vi.advanceTimersByTimeAsync(0)
      await vi.advanceTimersByTimeAsync(100)

      await expect(promise).rejects.toThrow(error)
      expect(fn).toHaveBeenCalledTimes(2)
    })

    it('should use exponential backoff', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('fail'))
      const promise = retryWithBackoff(fn, 4, 100)

      // Delays should be: 100ms, 200ms, 400ms
      await vi.advanceTimersByTimeAsync(0)
      expect(fn).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(100)
      expect(fn).toHaveBeenCalledTimes(2)

      await vi.advanceTimersByTimeAsync(200)
      expect(fn).toHaveBeenCalledTimes(3)

      await vi.advanceTimersByTimeAsync(400)
      expect(fn).toHaveBeenCalledTimes(4)

      await expect(promise).rejects.toThrow()
    })
  })
})
