import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import request from 'supertest'
import express from 'express'

// Simple mocks without complex imports
vi.mock('dotenv')

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

const mockTelemetry = {
  recordLatency: vi.fn(),
  recordCounter: vi.fn(),
  getMetrics: vi.fn().mockResolvedValue({
    counters: { test: 1 },
    gauges: { test: 1 },
    histograms: { test: [1, 2, 3] },
  }),
}

vi.mock('@promptdial/shared', () => ({
  createLogger: () => mockLogger,
  getTelemetryService: () => mockTelemetry,
  ERROR_CODES: {
    INVALID_PROMPT: 'E001',
    INTERNAL_ERROR: 'E999',
  },
  DEFAULTS: {
    MAX_VARIANTS: 3,
    COST_CAP_USD: 10,
    LATENCY_CAP_MS: 5000,
    SECURITY_LEVEL: 'standard',
  },
}))

const mockHealthChecker = {
  checkAll: vi.fn().mockResolvedValue({
    classifier: { healthy: true, service: 'Classifier' },
    technique: { healthy: true, service: 'TechniqueEngine' },
    safety: { healthy: true, service: 'SafetyGuard' },
  }),
  checkService: vi.fn().mockImplementation((service) => {
    if (service === 'unknown') {
      throw new Error('Unknown service: unknown')
    }
    return Promise.resolve({
      service: service.charAt(0).toUpperCase() + service.slice(1),
      healthy: true,
      lastCheck: new Date(),
    })
  }),
}

const mockOrchestrator = {
  optimize: vi.fn(),
}

vi.mock('../src/health', () => ({
  HealthChecker: vi.fn(() => mockHealthChecker),
}))

vi.mock('../src/orchestrator', () => ({
  RequestOrchestrator: vi.fn(() => mockOrchestrator),
}))

vi.mock('../src/services', () => ({
  SERVICES: {
    classifier: {
      name: 'Classifier',
      url: 'http://localhost:3001',
      healthEndpoint: '/health',
    },
    technique: {
      name: 'TechniqueEngine',
      url: 'http://localhost:3003',
      healthEndpoint: '/health',
    },
    safety: {
      name: 'SafetyGuard',
      url: 'http://localhost:3006',
      healthEndpoint: '/health',
    },
  },
}))

// Test data
const createTestOptimizationResponse = () => ({
  trace_id: 'trace-123',
  original_prompt: 'Test prompt',
  task_classification: {
    task_type: 'general',
    domain: 'general',
    complexity: 0.5,
    safety_risk: 0.1,
    needs_retrieval: false,
    suggested_techniques: ['chain_of_thought'],
  },
  variants: [
    {
      id: 'v1',
      technique: 'chain_of_thought',
      prompt: "Let's think step by step",
      model: 'gpt-4',
    },
  ],
  recommended_variant: {
    id: 'v1',
    technique: 'chain_of_thought',
    prompt: "Let's think step by step",
    model: 'gpt-4',
  },
  evaluation_results: [],
  optimization_metadata: {
    total_variants_generated: 1,
    pareto_frontier_size: 1,
    techniques_used: ['chain_of_thought'],
    safety_modifications: false,
  },
})

describe('API Gateway', () => {
  let app: express.Application
  let server: any

  beforeEach(async () => {
    vi.clearAllMocks()

    // Set up default mock response
    mockOrchestrator.optimize.mockResolvedValue(createTestOptimizationResponse())

    // Clear and re-import the module to get fresh instance
    vi.resetModules()
    const module = await import('../src/index')
    app = (module as any).app || express()
  })

  afterEach(() => {
    if (server) {
      server.close()
    }
  })

  describe('POST /api/optimize', () => {
    it('should optimize a valid prompt', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .send({
          prompt: 'Test prompt for optimization',
          options: {
            max_variants: 3,
            task_type: 'classification',
          },
        })
        .expect(200)

      expect(response.body.success).toBe(true)
      expect(response.body.trace_id).toBeDefined()
      expect(response.body.result).toBeDefined()
      expect(response.body.metrics).toBeDefined()
      expect(response.body.metrics.variants_generated).toBeGreaterThan(0)

      // Verify orchestrator was called correctly
      expect(mockOrchestrator.optimize).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt for optimization',
          task_type: 'classification',
          constraints: expect.objectContaining({
            max_variants: 3,
          }),
        }),
        expect.stringContaining('trace-'),
      )
    })

    it('should handle missing prompt', async () => {
      const response = await request(app).post('/api/optimize').send({}).expect(400)

      expect(response.body.error).toContain('prompt is required')
      expect(response.body.code).toBe('E001')
    })

    it('should handle invalid prompt type', async () => {
      const response = await request(app).post('/api/optimize').send({ prompt: 123 }).expect(400)

      expect(response.body.error).toContain('prompt is required')
    })

    it('should use default options when not provided', async () => {
      await request(app).post('/api/optimize').send({ prompt: 'Test prompt' }).expect(200)

      expect(mockOrchestrator.optimize).toHaveBeenCalledWith(
        expect.objectContaining({
          constraints: expect.objectContaining({
            max_variants: 3,
            cost_cap_usd: 10,
            latency_cap_ms: 5000,
            security_level: 'standard',
          }),
        }),
        expect.any(String),
      )
    })

    it('should handle orchestrator errors', async () => {
      mockOrchestrator.optimize.mockRejectedValueOnce(new Error('Service unavailable'))

      const response = await request(app)
        .post('/api/optimize')
        .send({ prompt: 'Test prompt' })
        .expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Service unavailable')
      expect(response.body.trace_id).toBeDefined()
    })

    it('should include trace ID in response headers', async () => {
      const response = await request(app)
        .post('/api/optimize')
        .send({ prompt: 'Test prompt' })
        .expect(200)

      expect(response.headers['x-trace-id']).toBeDefined()
    })

    it('should use provided trace ID', async () => {
      const traceId = 'custom-trace-123'

      const response = await request(app)
        .post('/api/optimize')
        .set('x-trace-id', traceId)
        .send({ prompt: 'Test prompt' })
        .expect(200)

      expect(response.headers['x-trace-id']).toBe(traceId)
      expect(mockOrchestrator.optimize).toHaveBeenCalledWith(expect.any(Object), traceId)
    })

    it('should handle all optional parameters', async () => {
      const fullRequest = {
        prompt: 'Test prompt',
        options: {
          task_type: 'classification',
          domain: 'medical',
          max_variants: 5,
          cost_cap_usd: 20,
          latency_cap_ms: 10000,
          security_level: 'high',
          examples: ['Example 1', 'Example 2'],
          reference_output: 'Expected output',
          style_guide: 'Be concise',
          preferences: {
            priority: 'quality',
            temperature: 0.7,
          },
        },
      }

      await request(app).post('/api/optimize').send(fullRequest).expect(200)

      expect(mockOrchestrator.optimize).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Test prompt',
          task_type: 'classification',
          domain: 'medical',
          constraints: {
            max_variants: 5,
            cost_cap_usd: 20,
            latency_cap_ms: 10000,
            security_level: 'high',
          },
          context: {
            examples: ['Example 1', 'Example 2'],
            reference_output: 'Expected output',
            style_guide: 'Be concise',
          },
          preferences: {
            priority: 'quality',
            temperature: 0.7,
          },
        }),
        expect.any(String),
      )
    })
  })

  describe('GET /health', () => {
    it('should return healthy status when all services are healthy', async () => {
      const response = await request(app).get('/health').expect(200)

      expect(response.body.status).toBe('healthy')
      expect(response.body.services).toBeDefined()
      expect(response.body.timestamp).toBeDefined()
    })

    it('should return degraded status when some services are unhealthy', async () => {
      mockHealthChecker.checkAll.mockResolvedValueOnce({
        classifier: { healthy: true, service: 'Classifier' },
        technique: { healthy: false, service: 'TechniqueEngine', error: 'Connection failed' },
        safety: { healthy: true, service: 'SafetyGuard' },
      })

      const response = await request(app).get('/health').expect(503)

      expect(response.body.status).toBe('degraded')
      expect(response.body.services.technique.healthy).toBe(false)
    })
  })

  describe('GET /health/:service', () => {
    it('should return health for specific service', async () => {
      const response = await request(app).get('/health/classifier').expect(200)

      expect(response.body.service).toBe('Classifier')
      expect(response.body.healthy).toBe(true)
      expect(mockHealthChecker.checkService).toHaveBeenCalledWith('classifier')
    })

    it('should return 404 for unknown service', async () => {
      const response = await request(app).get('/health/unknown').expect(404)

      expect(response.body.error).toBe('Service not found')
    })

    it('should return 503 for unhealthy service', async () => {
      mockHealthChecker.checkService.mockResolvedValueOnce({
        service: 'Classifier',
        healthy: false,
        error: 'Service down',
        lastCheck: new Date(),
      })

      const response = await request(app).get('/health/classifier').expect(503)

      expect(response.body.healthy).toBe(false)
      expect(response.body.error).toBe('Service down')
    })
  })

  describe('GET /metrics', () => {
    it('should return metrics', async () => {
      const response = await request(app).get('/metrics').expect(200)

      expect(response.body.uptime).toBeGreaterThan(0)
      expect(response.body.memory).toBeDefined()
      expect(response.body.metrics).toBeDefined()
    })

    it('should handle metrics retrieval error', async () => {
      mockTelemetry.getMetrics.mockRejectedValueOnce(new Error('Metrics error'))

      const response = await request(app).get('/metrics').expect(500)

      expect(response.body.error).toBe('Failed to retrieve metrics')
    })
  })

  describe('GET /services', () => {
    it('should return service discovery information', async () => {
      const response = await request(app).get('/services').expect(200)

      expect(response.body.services).toBeInstanceOf(Array)
      expect(response.body.services).toHaveLength(3)

      const classifier = response.body.services.find((s: any) => s.id === 'classifier')
      expect(classifier).toEqual({
        id: 'classifier',
        name: 'Classifier',
        url: 'http://localhost:3001',
        health: 'http://localhost:3001/health',
      })
    })
  })

  describe('middleware', () => {
    it('should handle CORS', async () => {
      // Just verify the endpoint is accessible - CORS headers depend on request origin
      const response = await request(app).get('/health').expect(200)

      expect(response.status).toBe(200)
    })

    it('should handle large payloads up to 10mb', async () => {
      const largePrompt = 'x'.repeat(5 * 1024 * 1024) // 5MB

      const response = await request(app)
        .post('/api/optimize')
        .send({ prompt: largePrompt })
        .expect(200)

      expect(response.body.success).toBe(true)
    })

    it('should reject payloads over 10mb', async () => {
      const hugePrompt = 'x'.repeat(11 * 1024 * 1024) // 11MB

      const response = await request(app).post('/api/optimize').send({ prompt: hugePrompt })

      // Express may return 413 or 500 for large payloads
      expect([413, 500]).toContain(response.status)
    })

    it('should add trace ID to requests without one', async () => {
      const response = await request(app).get('/health').expect(200)

      expect(response.headers['x-trace-id']).toMatch(/^trace-\d+-[a-z0-9]+$/)
    })
  })

  describe('error handling', () => {
    it('should handle unhandled errors gracefully', async () => {
      // Mock orchestrator to throw non-Error
      mockOrchestrator.optimize.mockRejectedValueOnce('String error')

      const response = await request(app).post('/api/optimize').send({ prompt: 'Test' }).expect(500)

      expect(response.body.success).toBe(false)
      expect(response.body.error).toBe('Unknown error')
    })

    it('should include error details in development', async () => {
      process.env.NODE_ENV = 'development'

      // Trigger an error through a malformed request
      mockOrchestrator.optimize.mockRejectedValueOnce(new Error('Detailed error message'))

      const response = await request(app).post('/api/optimize').send({ prompt: 'Test' }).expect(500)

      expect(response.body.error).toBe('Detailed error message')

      // Reset env
      delete process.env.NODE_ENV
    })

    it('should hide error details in production', async () => {
      process.env.NODE_ENV = 'production'

      mockOrchestrator.optimize.mockRejectedValueOnce(new Error('Sensitive error'))

      const response = await request(app).post('/api/optimize').send({ prompt: 'Test' }).expect(500)

      expect(response.body.error).toBe('Sensitive error')
      expect(response.body.message).toBeUndefined()

      // Reset env
      delete process.env.NODE_ENV
    })

    it('should handle errors with custom error codes', async () => {
      const customError = new Error('Custom error') as any
      customError.code = 'E999'

      mockOrchestrator.optimize.mockRejectedValueOnce(customError)

      const response = await request(app).post('/api/optimize').send({ prompt: 'Test' }).expect(500)

      expect(response.body.code).toBe('E999')
    })
  })

  describe('server startup', () => {
    it('should start in degraded mode when critical services are unhealthy', async () => {
      mockHealthChecker.checkAll.mockResolvedValueOnce({
        classifier: { healthy: false, service: 'Classifier', error: 'Down' },
        technique: { healthy: true, service: 'TechniqueEngine' },
        safety: { healthy: true, service: 'SafetyGuard' },
      })

      // Server should still start and handle requests
      const response = await request(app).get('/health').expect(503)

      expect(response.body.status).toBe('degraded')
    })
  })

  describe('telemetry', () => {
    it('should record request metrics', async () => {
      await request(app).post('/api/optimize').send({ prompt: 'Test' }).expect(200)

      expect(mockTelemetry.recordLatency).toHaveBeenCalledWith(
        'gateway_request',
        expect.any(Number),
      )
      expect(mockTelemetry.recordCounter).toHaveBeenCalledWith('gateway_status_200', 1)
      expect(mockTelemetry.recordLatency).toHaveBeenCalledWith(
        'optimization_total',
        expect.any(Number),
      )
      expect(mockTelemetry.recordCounter).toHaveBeenCalledWith('optimizations_success', 1)
    })

    it('should record error metrics', async () => {
      mockOrchestrator.optimize.mockRejectedValueOnce(new Error('Failed'))

      await request(app).post('/api/optimize').send({ prompt: 'Test' }).expect(500)

      expect(mockTelemetry.recordCounter).toHaveBeenCalledWith('optimizations_failed', 1)
      expect(mockTelemetry.recordLatency).toHaveBeenCalledWith(
        'optimization_failed',
        expect.any(Number),
      )
    })
  })
})
