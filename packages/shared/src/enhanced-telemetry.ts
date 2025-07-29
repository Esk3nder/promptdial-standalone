/**
 * PromptDial 3.0 - Enhanced Telemetry Service
 * 
 * Provides comprehensive metrics tracking for observability
 */

import { TelemetryEvent } from './types'

const logger = {
  info: (message: string, meta?: any) => console.info(`[telemetry] ${message}`, meta),
  error: (message: string, error?: any, meta?: any) => console.error(`[telemetry] ${message}`, error, meta)
}

export interface Metric {
  name: string
  value: number
  timestamp: number
  labels?: Record<string, string>
}

export interface MetricsSummary {
  counters: Record<string, number>
  gauges: Record<string, number>
  histograms: Record<string, {
    count: number
    sum: number
    min: number
    max: number
    p50: number
    p95: number
    p99: number
  }>
  errors: Array<{
    timestamp: string
    error: string
    context?: Record<string, unknown>
  }>
}

export class EnhancedTelemetryService {
  private counters: Map<string, number> = new Map()
  private gauges: Map<string, number> = new Map()
  private histograms: Map<string, number[]> = new Map()
  private errors: Array<{
    timestamp: string
    error: string
    context?: Record<string, unknown>
  }> = []
  private events: TelemetryEvent[] = []

  // Critical metrics to track
  private readonly CRITICAL_METRICS = {
    FLOW_MISMATCH: 'flow_mismatch_total',
    ZERO_TECHNIQUES: 'zero_techniques_total',
    BUILDER_INVARIANT_VIOLATIONS: 'builder_invariant_violations',
    CANARY_FAILURES: 'canary_test_failed',
    RECEIPT_INVALID: 'receipt_invalid_total',
  }

  /**
   * Track a telemetry event
   */
  trackEvent(event: TelemetryEvent): void {
    this.events.push(event)
    
    // Derive metrics from events
    if (event.event_type === 'optimization_end') {
      if (event.latency_ms) {
        this.recordLatency('optimization_latency', event.latency_ms)
      }
      if (event.cost_usd) {
        this.recordGauge('optimization_cost_usd', event.cost_usd)
      }
    }
  }

  /**
   * Track a generic metric
   */
  trackMetric(name: string, value: number, tags?: Record<string, string>): void {
    const fullName = tags ? `${name}{${Object.entries(tags).map(([k, v]) => `${k}="${v}"`).join(',')}}` : name
    this.recordGauge(fullName, value)
  }

  /**
   * Track an error
   */
  trackError(error: Error, context?: Record<string, unknown>): void {
    this.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      context
    })
    
    // Increment error counter
    this.incrementCounter('errors_total')
  }

  /**
   * Record a latency measurement
   */
  recordLatency(name: string, duration: number): void {
    if (!this.histograms.has(name)) {
      this.histograms.set(name, [])
    }
    this.histograms.get(name)!.push(duration)
  }

  /**
   * Record a counter value
   */
  recordCounter(name: string, count: number): void {
    this.counters.set(name, (this.counters.get(name) || 0) + count)
    
    // Alert on critical metrics
    this.checkCriticalMetrics(name, count)
  }

  /**
   * Record a gauge value
   */
  recordGauge(name: string, value: number): void {
    this.gauges.set(name, value)
  }

  /**
   * Record a metric (alias for recordGauge)
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    this.trackMetric(name, value, labels)
  }

  /**
   * Increment a counter
   */
  incrementCounter(name: string, count: number = 1): void {
    this.recordCounter(name, count)
  }

  /**
   * Log an event (for compatibility)
   */
  async logEvent(event: TelemetryEvent): Promise<void> {
    this.trackEvent(event)
  }

  /**
   * Get all metrics
   */
  async getMetrics(): Promise<MetricsSummary> {
    const summary: MetricsSummary = {
      counters: {},
      gauges: {},
      histograms: {},
      errors: this.errors.slice(-100) // Last 100 errors
    }

    // Export counters
    for (const [name, value] of this.counters) {
      summary.counters[name] = value
    }

    // Export gauges
    for (const [name, value] of this.gauges) {
      summary.gauges[name] = value
    }

    // Export histograms with percentiles
    for (const [name, values] of this.histograms) {
      if (values.length > 0) {
        const sorted = values.slice().sort((a, b) => a - b)
        summary.histograms[name] = {
          count: values.length,
          sum: values.reduce((a, b) => a + b, 0),
          min: sorted[0],
          max: sorted[sorted.length - 1],
          p50: this.percentile(sorted, 0.5),
          p95: this.percentile(sorted, 0.95),
          p99: this.percentile(sorted, 0.99)
        }
      }
    }

    return summary
  }

  /**
   * Get metrics in Prometheus format
   */
  async getPrometheusMetrics(): Promise<string> {
    const lines: string[] = []
    
    // Export counters
    for (const [name, value] of this.counters) {
      lines.push(`# TYPE ${name} counter`)
      lines.push(`${name} ${value}`)
    }

    // Export gauges
    for (const [name, value] of this.gauges) {
      lines.push(`# TYPE ${name} gauge`)
      lines.push(`${name} ${value}`)
    }

    // Export histograms
    for (const [name, values] of this.histograms) {
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0)
        
        lines.push(`# TYPE ${name} histogram`)
        lines.push(`${name}_bucket{le="0.005"} ${values.filter(v => v <= 5).length}`)
        lines.push(`${name}_bucket{le="0.01"} ${values.filter(v => v <= 10).length}`)
        lines.push(`${name}_bucket{le="0.025"} ${values.filter(v => v <= 25).length}`)
        lines.push(`${name}_bucket{le="0.05"} ${values.filter(v => v <= 50).length}`)
        lines.push(`${name}_bucket{le="0.1"} ${values.filter(v => v <= 100).length}`)
        lines.push(`${name}_bucket{le="0.25"} ${values.filter(v => v <= 250).length}`)
        lines.push(`${name}_bucket{le="0.5"} ${values.filter(v => v <= 500).length}`)
        lines.push(`${name}_bucket{le="1"} ${values.filter(v => v <= 1000).length}`)
        lines.push(`${name}_bucket{le="2.5"} ${values.filter(v => v <= 2500).length}`)
        lines.push(`${name}_bucket{le="5"} ${values.filter(v => v <= 5000).length}`)
        lines.push(`${name}_bucket{le="10"} ${values.filter(v => v <= 10000).length}`)
        lines.push(`${name}_bucket{le="+Inf"} ${values.length}`)
        lines.push(`${name}_sum ${sum}`)
        lines.push(`${name}_count ${values.length}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Flush metrics (no-op for in-memory)
   */
  async flush(): Promise<void> {
    // In production, this would send to a metrics backend
    logger.info('Flushing metrics', {
      counters: this.counters.size,
      gauges: this.gauges.size,
      histograms: this.histograms.size,
      events: this.events.length
    })
  }

  /**
   * Check critical metrics and alert if needed
   */
  private checkCriticalMetrics(name: string, count: number): void {
    if (count > 0) {
      switch (name) {
        case this.CRITICAL_METRICS.FLOW_MISMATCH:
          logger.error('CRITICAL: Flow mismatch detected!', undefined, { count })
          break
        case this.CRITICAL_METRICS.ZERO_TECHNIQUES:
          logger.error('CRITICAL: Zero techniques detected!', undefined, { count })
          break
        case this.CRITICAL_METRICS.BUILDER_INVARIANT_VIOLATIONS:
          logger.error('CRITICAL: Builder invariant violation!', undefined, { count })
          break
        case this.CRITICAL_METRICS.CANARY_FAILURES:
          logger.error('CRITICAL: Canary test failed!', undefined, { count })
          break
        case this.CRITICAL_METRICS.RECEIPT_INVALID:
          logger.error('CRITICAL: Invalid receipt detected!', undefined, { count })
          break
      }
    }
  }

  /**
   * Calculate percentile from sorted array
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1
    return sorted[Math.max(0, index)]
  }

  /**
   * Get critical metrics status
   */
  getCriticalMetricsStatus(): Record<string, number> {
    const status: Record<string, number> = {}
    
    for (const metricName of Object.values(this.CRITICAL_METRICS)) {
      status[metricName] = this.counters.get(metricName) || 0
    }

    return status
  }
}

// Singleton instance
let enhancedTelemetryInstance: EnhancedTelemetryService | null = null

export function getEnhancedTelemetryService(): EnhancedTelemetryService {
  if (!enhancedTelemetryInstance) {
    enhancedTelemetryInstance = new EnhancedTelemetryService()
  }
  return enhancedTelemetryInstance
}