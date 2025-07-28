/**
 * PromptDial 3.0 - Telemetry Service
 *
 * Handles event logging, metrics collection, and monitoring
 */

import {
  TelemetryEvent,
  PerformanceMetrics,
  ServiceRequest,
  ServiceResponse,
  createServiceResponse,
  createServiceError,
  createLogger,
  ERROR_CODES,
  METRICS,
} from '@promptdial/shared'
import { EventEmitter } from 'events'

const logger = createLogger('telemetry')

// ============= Event Store Interface =============

interface EventStore {
  write(event: TelemetryEvent): Promise<void>
  query(filters: EventFilters): Promise<TelemetryEvent[]>
  flush(): Promise<void>
}

interface EventFilters {
  trace_id?: string
  variant_id?: string
  start_time?: Date
  end_time?: Date
  event_type?: TelemetryEvent['event_type']
  task_type?: string
}

// ============= In-Memory Event Store (for development) =============

class InMemoryEventStore implements EventStore {
  private events: TelemetryEvent[] = []
  private maxEvents = 10000

  async write(event: TelemetryEvent): Promise<void> {
    this.events.push(event)

    // Circular buffer - remove oldest events if over limit
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(-this.maxEvents)
    }
  }

  async query(filters: EventFilters): Promise<TelemetryEvent[]> {
    return this.events.filter((event) => {
      if (filters.trace_id && event.trace_id !== filters.trace_id) return false
      if (filters.variant_id && event.variant_id !== filters.variant_id) return false
      if (filters.event_type && event.event_type !== filters.event_type) return false
      if (filters.task_type && event.task_type !== filters.task_type) return false

      const eventTime = new Date(event.ts_utc)
      if (filters.start_time && eventTime < filters.start_time) return false
      if (filters.end_time && eventTime > filters.end_time) return false

      return true
    })
  }

  async flush(): Promise<void> {
    logger.info(`Flushing ${this.events.length} events`)
    // In production, this would batch write to BigQuery/S3
    this.events = []
  }
}

// ============= Metrics Collector =============

interface MetricPoint {
  name: string
  value: number
  timestamp: Date
  labels: Record<string, string>
}

class MetricsCollector {
  private metrics: Map<string, MetricPoint[]> = new Map()
  private flushInterval: NodeJS.Timeout | null = null
  private readonly maxPointsPerMetric = 1000 // Prevent unbounded growth

  constructor(private flushIntervalMs: number = 60000) {
    this.startAutoFlush()
  }

  record(name: string, value: number, labels: Record<string, string> = {}): void {
    const point: MetricPoint = {
      name,
      value,
      timestamp: new Date(),
      labels,
    }

    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const points = this.metrics.get(name)!
    points.push(point)
    
    // Enforce maximum points per metric to prevent memory leak
    if (points.length > this.maxPointsPerMetric) {
      // Remove oldest points, keep most recent
      points.splice(0, points.length - this.maxPointsPerMetric)
    }
  }

  increment(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    this.record(name, value, labels)
  }

  histogram(name: string, value: number, labels: Record<string, string> = {}): void {
    this.record(name, value, labels)
  }

  async calculatePerformanceMetrics(
    service: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<PerformanceMetrics> {
    const latencyMetric = `${METRICS.REQUEST_DURATION}_${service}`
    const latencies = this.metrics.get(latencyMetric) || []

    // Filter by time range if provided
    const filtered = latencies.filter((point) => {
      if (startTime && point.timestamp < startTime) return false
      if (endTime && point.timestamp > endTime) return false
      return true
    })

    const values = filtered.map((p) => p.value).sort((a, b) => a - b)

    if (values.length === 0) {
      return {
        p50_latency_ms: 0,
        p95_latency_ms: 0,
        p99_latency_ms: 0,
        success_rate: 0,
        error_rate: 0,
        avg_cost_per_request: 0,
      }
    }

    // Calculate percentiles
    const p50Index = Math.floor(values.length * 0.5)
    const p95Index = Math.floor(values.length * 0.95)
    const p99Index = Math.floor(values.length * 0.99)

    // Calculate success/error rates
    const successCount = (this.metrics.get(METRICS.REQUEST_COUNT) || []).filter(
      (p) => p.labels.status === 'success',
    ).length
    const errorCount = (this.metrics.get(METRICS.ERROR_COUNT) || []).length
    const totalRequests = successCount + errorCount

    // Calculate average cost
    const costs = (this.metrics.get(METRICS.COST_USD) || []).map((p) => p.value)
    const avgCost = costs.length > 0 ? costs.reduce((sum, c) => sum + c, 0) / costs.length : 0

    return {
      p50_latency_ms: values[p50Index] || 0,
      p95_latency_ms: values[p95Index] || 0,
      p99_latency_ms: values[p99Index] || 0,
      success_rate: totalRequests > 0 ? successCount / totalRequests : 0,
      error_rate: totalRequests > 0 ? errorCount / totalRequests : 0,
      avg_cost_per_request: avgCost,
    }
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => {
      this.flush()
    }, this.flushIntervalMs)
  }

  private async flush(): Promise<void> {
    // In production, this would send to Prometheus/Datadog
    const metricsCount = Array.from(this.metrics.values()).reduce(
      (sum, points) => sum + points.length,
      0,
    )

    if (metricsCount > 0) {
      logger.info(`Flushing ${metricsCount} metric points`)

      // Keep only recent metrics (last hour)
      const oneHourAgo = new Date(Date.now() - 3600000)
      for (const [name, points] of this.metrics.entries()) {
        const recent = points.filter((p) => p.timestamp > oneHourAgo)
        this.metrics.set(name, recent)
      }
    }
  }

  stop(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval)
      this.flushInterval = null
    }
  }
}

// ============= Telemetry Service =============

export class TelemetryService extends EventEmitter {
  private eventStore: EventStore
  private metricsCollector: MetricsCollector
  private batchSize = 100
  private maxBatchSize = 1000 // Prevent unbounded batch growth on failures
  private eventBatch: TelemetryEvent[] = []

  constructor(eventStore?: EventStore) {
    super()
    this.eventStore = eventStore || new InMemoryEventStore()
    this.metricsCollector = new MetricsCollector()
  }

  async logEvent(event: TelemetryEvent): Promise<void> {
    // Validate event
    if (!event.trace_id || !event.event_type) {
      throw new Error('Invalid telemetry event: missing required fields')
    }

    // Add to batch
    this.eventBatch.push(event)

    // Update metrics based on event
    this.updateMetrics(event)

    // Emit event for real-time monitoring
    this.emit('event', event)

    // Flush if batch is full
    if (this.eventBatch.length >= this.batchSize) {
      await this.flushEvents()
    }
  }

  async queryEvents(filters: EventFilters): Promise<TelemetryEvent[]> {
    return this.eventStore.query(filters)
  }

  async getTraceEvents(traceId: string): Promise<TelemetryEvent[]> {
    return this.queryEvents({ trace_id: traceId })
  }

  async getPerformanceMetrics(
    service: string,
    startTime?: Date,
    endTime?: Date,
  ): Promise<PerformanceMetrics> {
    return this.metricsCollector.calculatePerformanceMetrics(service, startTime, endTime)
  }

  recordMetric(name: string, value: number, labels: Record<string, string> = {}): void {
    this.metricsCollector.record(name, value, labels)
  }

  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    this.metricsCollector.increment(name, value, labels)
  }

  recordLatency(service: string, latencyMs: number): void {
    this.metricsCollector.histogram(`${METRICS.REQUEST_DURATION}_${service}`, latencyMs, {
      service,
    })
  }

  private updateMetrics(event: TelemetryEvent): void {
    // Update counters
    this.incrementCounter(METRICS.REQUEST_COUNT, 1, {
      event_type: event.event_type,
      task_type: event.task_type,
    })

    // Update latency
    if (event.latency_ms) {
      this.recordLatency(event.provider || 'unknown', event.latency_ms)
    }

    // Update token usage
    if (event.total_tokens) {
      this.incrementCounter(METRICS.TOKEN_USAGE, event.total_tokens, {
        provider: event.provider || 'unknown',
      })
    }

    // Update cost
    if (event.cost_usd) {
      this.metricsCollector.record(METRICS.COST_USD, event.cost_usd, {
        provider: event.provider || 'unknown',
      })
    }

    // Update quality scores
    if (event.score !== undefined) {
      this.metricsCollector.record(METRICS.EVALUATION_SCORE, event.score, {
        task_type: event.task_type,
      })
    }

    // Update security metrics
    if (event.safety_verdict === 'unsafe') {
      this.incrementCounter(METRICS.SECURITY_VIOLATIONS, 1, {
        task_type: event.task_type,
      })
    }

    // Update error metrics
    if (event.error) {
      this.incrementCounter(METRICS.ERROR_COUNT, 1, {
        error_type: event.error,
      })
    }
  }

  private async flushEvents(): Promise<void> {
    if (this.eventBatch.length === 0) return

    const batch = this.eventBatch.slice()
    this.eventBatch = []

    try {
      // Write events in parallel
      await Promise.all(batch.map((event) => this.eventStore.write(event)))
      logger.info(`Flushed ${batch.length} events to store`)
    } catch (error) {
      logger.error('Failed to flush events', error as Error)
      
      // Re-add failed events to batch, but enforce maximum batch size to prevent memory leak
      const combinedSize = this.eventBatch.length + batch.length
      if (combinedSize <= this.maxBatchSize) {
        this.eventBatch.unshift(...batch)
      } else {
        // If adding all events would exceed max batch size, only keep the most recent events
        const availableSpace = this.maxBatchSize - this.eventBatch.length
        if (availableSpace > 0) {
          this.eventBatch.unshift(...batch.slice(-availableSpace))
          logger.warn(`Dropped ${batch.length - availableSpace} events due to batch size limit`)
        } else {
          logger.warn(`Dropped ${batch.length} events due to batch size limit`)
        }
      }
    }
  }

  async shutdown(): Promise<void> {
    // Flush remaining events
    await this.flushEvents()
    await this.eventStore.flush()

    // Stop metrics collector
    this.metricsCollector.stop()

    logger.info('Telemetry service shut down')
  }
}

// ============= Service API =============

let telemetryService: TelemetryService | null = null

export function getTelemetryService(): TelemetryService {
  if (!telemetryService) {
    telemetryService = new TelemetryService()
  }
  return telemetryService
}

export async function handleLogEventRequest(
  request: ServiceRequest<TelemetryEvent>,
): Promise<ServiceResponse<void>> {
  try {
    await getTelemetryService().logEvent(request.payload)
    return createServiceResponse(request)
  } catch (error) {
    const serviceError = createServiceError(ERROR_CODES.INTERNAL_ERROR, 'Failed to log event', true)
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleQueryEventsRequest(
  request: ServiceRequest<EventFilters>,
): Promise<ServiceResponse<TelemetryEvent[]>> {
  try {
    const events = await getTelemetryService().queryEvents(request.payload)
    return createServiceResponse(request, events)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Failed to query events',
      true,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleMetricsRequest(
  request: ServiceRequest<{ service: string; start_time?: string; end_time?: string }>,
): Promise<ServiceResponse<PerformanceMetrics>> {
  try {
    const startTime = request.payload.start_time ? new Date(request.payload.start_time) : undefined
    const endTime = request.payload.end_time ? new Date(request.payload.end_time) : undefined

    const metrics = await getTelemetryService().getPerformanceMetrics(
      request.payload.service,
      startTime,
      endTime,
    )
    return createServiceResponse(request, metrics)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Failed to get metrics',
      true,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3009

  // Error handling middleware
  const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }

  const errorHandler = (err: any, req: any, res: any, next: any) => {
    logger.error('Request failed', err, {
      path: req.path,
      method: req.method,
      body: req.body,
    })
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Internal server error',
        retryable: true,
      },
    })
  }

  app.use(express.json({ limit: '10mb' }))

  // Log event endpoint
  app.post('/events', asyncHandler(async (req: any, res: any) => {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is required',
          retryable: false,
        },
      })
    }

    const response = await handleLogEventRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  }))

  // Query events endpoint
  app.post('/events/query', asyncHandler(async (req: any, res: any) => {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is required',
          retryable: false,
        },
      })
    }

    const response = await handleQueryEventsRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  }))

  // Get metrics endpoint
  app.post('/metrics', asyncHandler(async (req: any, res: any) => {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Request body is required',
          retryable: false,
        },
      })
    }

    const response = await handleMetricsRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  }))

  // Prometheus metrics endpoint
  app.get('/metrics', asyncHandler(async (_req: any, res: any) => {
    // In production, this would export Prometheus format
    res.type('text/plain')
    res.send(
      '# HELP promptdial_request_total Total requests\n# TYPE promptdial_request_total counter\n',
    )
  }))

  app.get('/health', asyncHandler(async (_req: any, res: any) => {
    res.json({ status: 'healthy', service: 'telemetry', timestamp: new Date().toISOString() })
  }))

  // Apply error handling middleware
  app.use(errorHandler)

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM, shutting down gracefully')
    await getTelemetryService().shutdown()
    process.exit(0)
  })

  app.listen(PORT, () => {
    logger.info(`Telemetry service running on port ${PORT}`)
  })
}
