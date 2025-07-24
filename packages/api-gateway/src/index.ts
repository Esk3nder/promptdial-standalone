/**
 * PromptDial 2.0 - API Gateway
 *
 * Central orchestration point for all microservices
 */

import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import axios from 'axios'
import dotenv from 'dotenv'

import {
  OptimizationRequest,
  createLogger,
  getTelemetryService,
  ERROR_CODES,
  DEFAULTS,
} from '@promptdial/shared'

import { SERVICES, ServiceConfig } from './services'
import { HealthChecker } from './health'
import { RequestOrchestrator } from './orchestrator'

// Load environment variables
dotenv.config()

const logger = createLogger('api-gateway')
const app = express()
const PORT = process.env.PORT || 3000

// ============= Middleware =============

// Security headers
app.use(helmet())

// CORS
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:*'],
    credentials: true,
  }),
)

// Body parsing
app.use(express.json({ limit: '10mb' }))

// Rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT || '60'),
  message: 'Too many requests, please try again later',
})
app.use('/api/', limiter)

// Request logging
app.use((req, res, next) => {
  const start = Date.now()
  const traceId =
    req.headers['x-trace-id'] || `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  req.headers['x-trace-id'] = traceId
  res.setHeader('x-trace-id', traceId)

  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`, {
      traceId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration,
    })

    // Record telemetry
    const telemetry = getTelemetryService()
    telemetry.recordLatency('gateway_request', duration)
    telemetry.recordCounter(`gateway_status_${res.statusCode}`, 1)
  })

  next()
})

// ============= Service Instances =============

const healthChecker = new HealthChecker(SERVICES)
const orchestrator = new RequestOrchestrator(SERVICES)

// ============= API Routes =============

/**
 * Main optimization endpoint
 */
app.post('/api/optimize', async (req, res) => {
  const traceId = req.headers['x-trace-id'] as string
  const startTime = Date.now()

  try {
    // Validate request
    const { prompt, options = {} } = req.body

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({
        error: 'Invalid request: prompt is required',
        code: ERROR_CODES.INVALID_PROMPT,
      })
    }

    // Build optimization request
    const request: OptimizationRequest = {
      prompt,
      task_type: options.task_type,
      domain: options.domain,
      constraints: {
        max_variants: options.max_variants || DEFAULTS.MAX_VARIANTS,
        cost_cap_usd: options.cost_cap_usd || DEFAULTS.COST_CAP_USD,
        latency_cap_ms: options.latency_cap_ms || DEFAULTS.LATENCY_CAP_MS,
        security_level: options.security_level || DEFAULTS.SECURITY_LEVEL,
      },
      context: {
        examples: options.examples,
        reference_output: options.reference_output,
        style_guide: options.style_guide,
      },
      preferences: options.preferences,
    }

    // Orchestrate the optimization
    const result = await orchestrator.optimize(request, traceId)

    // Record success metrics
    const duration = Date.now() - startTime
    const telemetry = getTelemetryService()
    telemetry.recordLatency('optimization_total', duration)
    telemetry.recordCounter('optimizations_success', 1)

    res.json({
      success: true,
      trace_id: traceId,
      result,
      metrics: {
        duration_ms: duration,
        variants_generated: result.variants.length,
        techniques_used: [...new Set(result.variants.map((v) => v.technique))],
      },
    })
  } catch (error) {
    const duration = Date.now() - startTime
    logger.error('Optimization failed', error as Error, { traceId })

    // Record error metrics
    const telemetry = getTelemetryService()
    telemetry.recordCounter('optimizations_failed', 1)
    telemetry.recordLatency('optimization_failed', duration)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorCode = (error as any).code || ERROR_CODES.INTERNAL_ERROR

    res.status(500).json({
      success: false,
      trace_id: traceId,
      error: errorMessage,
      code: errorCode,
    })
  }
})

/**
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  const health = await healthChecker.checkAll()
  const overallHealthy = Object.values(health).every((s) => s.healthy)

  res.status(overallHealthy ? 200 : 503).json({
    status: overallHealthy ? 'healthy' : 'degraded',
    services: health,
    timestamp: new Date().toISOString(),
  })
})

/**
 * Service-specific health checks
 */
app.get('/health/:service', async (req, res) => {
  const { service } = req.params

  if (!SERVICES[service]) {
    return res.status(404).json({ error: 'Service not found' })
  }

  const health = await healthChecker.checkService(service)
  res.status(health.healthy ? 200 : 503).json(health)
})

/**
 * Metrics endpoint
 */
app.get('/metrics', async (req, res) => {
  try {
    const telemetry = getTelemetryService()
    const metrics = await telemetry.getMetrics()

    res.json({
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      metrics,
    })
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve metrics' })
  }
})

/**
 * Service discovery endpoint
 */
app.get('/services', (req, res) => {
  const serviceInfo = Object.entries(SERVICES).map(([key, config]) => ({
    id: key,
    name: config.name,
    url: config.url,
    health: `${config.url}${config.healthEndpoint}`,
  }))

  res.json({ services: serviceInfo })
})

// ============= Error Handling =============

app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', err)

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  })
})

// ============= Server Startup =============

async function startServer() {
  // Check critical services
  logger.info('Checking service health...')
  const health = await healthChecker.checkAll()

  const criticalServices = ['classifier', 'technique', 'safety']
  const criticalHealthy = criticalServices.every((s) => health[s]?.healthy)

  if (!criticalHealthy) {
    logger.error('Critical services are not healthy', undefined, { health })
    logger.warn('Starting in degraded mode - some features may not work')
  }

  app.listen(PORT, () => {
    logger.info(`API Gateway running on port ${PORT}`)
    logger.info('Service URLs:', SERVICES)
  })
}

// Export app for testing
export { app }

// Start the server only if this is the main module
if (require.main === module) {
  startServer().catch((err) => {
    logger.error('Failed to start server', err)
    process.exit(1)
  })
}
