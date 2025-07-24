import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { HealthChecker, HealthStatus } from '../src/health'
import { ServiceConfig } from '../src/services'

// Mock axios
vi.mock('axios')

// Mock logger
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

describe('HealthChecker', () => {
  let healthChecker: HealthChecker
  let mockServices: Record<string, ServiceConfig>
  let mockAxios: any

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()

    mockServices = {
      classifier: {
        name: 'Classifier',
        url: 'http://localhost:3001',
        healthEndpoint: '/health',
        timeout: 5000,
      },
      evaluator: {
        name: 'Evaluator',
        url: 'http://localhost:3005',
        healthEndpoint: '/health',
        timeout: 5000,
      },
    }

    healthChecker = new HealthChecker(mockServices)
    mockAxios = vi.mocked(axios)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('checkService', () => {
    it('should check healthy service', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'healthy' },
        status: 200,
      })

      const status = await healthChecker.checkService('classifier')

      expect(status.service).toBe('Classifier')
      expect(status.healthy).toBe(true)
      expect(status.latency).toBeGreaterThanOrEqual(0)
      expect(status.error).toBeUndefined()
      expect(status.lastCheck).toBeInstanceOf(Date)

      expect(mockAxios.get).toHaveBeenCalledWith('http://localhost:3001/health', {
        timeout: 5000,
        validateStatus: expect.any(Function),
      })
    })

    it('should check unhealthy service', async () => {
      mockAxios.get.mockRejectedValueOnce(new Error('Connection refused'))

      const status = await healthChecker.checkService('classifier')

      expect(status.service).toBe('Classifier')
      expect(status.healthy).toBe(false)
      expect(status.error).toBe('Connection refused')
      expect(status.lastCheck).toBeInstanceOf(Date)
    })

    it('should throw for unknown service', async () => {
      await expect(healthChecker.checkService('unknown')).rejects.toThrow(
        'Unknown service: unknown',
      )
    })

    it('should use cached status within timeout', async () => {
      mockAxios.get.mockResolvedValueOnce({
        data: { status: 'healthy' },
        status: 200,
      })

      // First call
      const status1 = await healthChecker.checkService('classifier')
      expect(mockAxios.get).toHaveBeenCalledTimes(1)

      // Second call (should use cache)
      const status2 = await healthChecker.checkService('classifier')
      expect(mockAxios.get).toHaveBeenCalledTimes(1) // No additional call
      expect(status2).toEqual(status1)
    })

    it('should refresh cache after timeout', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ data: { status: 'healthy' }, status: 200 })
        .mockResolvedValueOnce({ data: { status: 'healthy' }, status: 200 })

      // First call
      await healthChecker.checkService('classifier')
      expect(mockAxios.get).toHaveBeenCalledTimes(1)

      // Advance time past cache timeout
      vi.advanceTimersByTime(31000)

      // Second call (should refresh)
      await healthChecker.checkService('classifier')
      expect(mockAxios.get).toHaveBeenCalledTimes(2)
    })

    it('should handle non-200 status codes', async () => {
      mockAxios.get.mockRejectedValueOnce({
        response: { status: 503 },
        message: 'Service Unavailable',
      })

      const status = await healthChecker.checkService('classifier')

      expect(status.healthy).toBe(false)
      expect(status.error).toContain('Unknown error')
    })

    it('should measure latency correctly', async () => {
      let resolvePromise: any
      mockAxios.get.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolvePromise = resolve
          }),
      )

      const statusPromise = healthChecker.checkService('classifier')

      // Simulate 100ms delay
      vi.advanceTimersByTime(100)
      resolvePromise({ data: { status: 'healthy' }, status: 200 })

      const status = await statusPromise
      expect(status.latency).toBeGreaterThanOrEqual(100)
    })
  })

  describe('checkAll', () => {
    it('should check all services in parallel', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ data: { status: 'healthy' }, status: 200 })
        .mockResolvedValueOnce({ data: { status: 'healthy' }, status: 200 })

      const results = await healthChecker.checkAll()

      expect(Object.keys(results)).toHaveLength(2)
      expect(results.classifier.healthy).toBe(true)
      expect(results.evaluator.healthy).toBe(true)
      expect(mockAxios.get).toHaveBeenCalledTimes(2)
    })

    it('should handle mixed healthy/unhealthy services', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ data: { status: 'healthy' }, status: 200 })
        .mockRejectedValueOnce(new Error('Connection timeout'))

      const results = await healthChecker.checkAll()

      expect(results.classifier.healthy).toBe(true)
      expect(results.evaluator.healthy).toBe(false)
      expect(results.evaluator.error).toBe('Connection timeout')
    })

    it('should handle all services being unhealthy', async () => {
      mockAxios.get.mockRejectedValue(new Error('Network error'))

      const results = await healthChecker.checkAll()

      expect(results.classifier.healthy).toBe(false)
      expect(results.evaluator.healthy).toBe(false)
      expect(results.classifier.error).toBe('Network error')
      expect(results.evaluator.error).toBe('Network error')
    })

    it('should use cache for repeated calls', async () => {
      mockAxios.get
        .mockResolvedValueOnce({ data: { status: 'healthy' }, status: 200 })
        .mockResolvedValueOnce({ data: { status: 'healthy' }, status: 200 })

      // First checkAll
      await healthChecker.checkAll()
      expect(mockAxios.get).toHaveBeenCalledTimes(2)

      // Second checkAll (should use cache)
      await healthChecker.checkAll()
      expect(mockAxios.get).toHaveBeenCalledTimes(2) // No additional calls
    })
  })

  describe('clearCache', () => {
    it('should clear the cache', async () => {
      mockAxios.get.mockResolvedValue({ data: { status: 'healthy' }, status: 200 })

      // First call
      await healthChecker.checkService('classifier')
      expect(mockAxios.get).toHaveBeenCalledTimes(1)

      // Clear cache
      healthChecker.clearCache()

      // Second call (should not use cache)
      await healthChecker.checkService('classifier')
      expect(mockAxios.get).toHaveBeenCalledTimes(2)
    })
  })

  describe('edge cases', () => {
    it('should handle non-Error exceptions', async () => {
      mockAxios.get.mockRejectedValueOnce('String error')

      const status = await healthChecker.checkService('classifier')

      expect(status.healthy).toBe(false)
      expect(status.error).toBe('Unknown error')
    })

    it('should handle empty service config', async () => {
      const emptyChecker = new HealthChecker({})
      const results = await emptyChecker.checkAll()

      expect(results).toEqual({})
    })

    it('should validate status codes correctly', async () => {
      mockAxios.get.mockImplementationOnce((url, config) => {
        // Test validateStatus function
        const validateStatus = config?.validateStatus
        expect(validateStatus?.(200)).toBe(true)
        expect(validateStatus?.(201)).toBe(false)
        expect(validateStatus?.(500)).toBe(false)

        return Promise.resolve({ data: {}, status: 200 })
      })

      await healthChecker.checkService('classifier')
    })
  })

  describe('concurrent requests', () => {
    it('should handle concurrent checks to same service', async () => {
      mockAxios.get.mockResolvedValue({ data: { status: 'healthy' }, status: 200 })

      // Make multiple concurrent requests
      const promises = Array(5)
        .fill(null)
        .map(() => healthChecker.checkService('classifier'))

      const results = await Promise.all(promises)

      // Should make some requests (caching may not prevent all in concurrent scenario)
      expect(mockAxios.get).toHaveBeenCalled()

      // All results should be the same
      results.forEach((result) => {
        expect(result.healthy).toBe(true)
      })
    })

    it('should handle concurrent checks to different services', async () => {
      mockAxios.get.mockResolvedValue({ data: { status: 'healthy' }, status: 200 })

      const promise1 = healthChecker.checkService('classifier')
      const promise2 = healthChecker.checkService('evaluator')

      const [result1, result2] = await Promise.all([promise1, promise2])

      expect(mockAxios.get).toHaveBeenCalledTimes(2)
      expect(result1.service).toBe('Classifier')
      expect(result2.service).toBe('Evaluator')
    })
  })
})
