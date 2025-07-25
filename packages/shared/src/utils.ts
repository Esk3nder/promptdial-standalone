/**
 * PromptDial 2.0 - Shared Utilities
 */

import { TelemetryEvent, ServiceResponse } from './types'

// ============= ID Generation =============

export function generateTraceId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 6)
  return `${timestamp}-${random}`
}

export function generateVariantId(technique: string, index: number): string {
  const timestamp = Date.now().toString(36)
  return `${technique.toLowerCase()}-${timestamp}-${index}`
}

// ============= Error Handling =============

export interface ServiceError {
  code: string
  message: string
  details?: Record<string, unknown>
}

export function createServiceError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ServiceError {
  return {
    code,
    message,
    details,
  }
}

// ============= Service Communication =============

export function createServiceResponse<T = unknown>(
  request: { trace_id?: string; [key: string]: unknown },
  data?: T,
  error?: {
    code: string
    message: string
    details?: any
    retryable: boolean
  },
): ServiceResponse<T> {
  return {
    trace_id: request.trace_id || generateTraceId(),
    timestamp: new Date(),
    service: process.env.SERVICE_NAME || 'unknown',
    success: !error,
    data,
    error,
  }
}

// ============= Token Estimation =============

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  // More accurate would use tiktoken or similar
  return Math.ceil(text.length / 4)
}

export function estimateCost(tokens: number, provider: string, model: string): number {
  // 2025 pricing rates (input tokens) - cheapest models as defaults per provider
  const costPer1kTokens: Record<string, number> = {
    'openai:gpt-4o-mini': 0.00015,
    'openai:gpt-4o': 0.005,
    'openai:gpt-4': 0.01,
    'openai:gpt-3.5-turbo': 0.0005,
    'anthropic:claude-3.5-sonnet': 0.003,
    'anthropic:claude-sonnet-4': 0.003,
    'anthropic:claude-3-opus': 0.015,
    'google:gemini-2.0-flash': 0.0001,
    'google:gemini-1.5-flash': 0.00125,
    'google:gemini-2.5-pro': 0.00125,
    'google:gemini-pro': 0.00125,
  }

  const key = `${provider}:${model}`
  const rate = costPer1kTokens[key] || 0.01
  return (tokens / 1000) * rate
}

// ============= Telemetry Helpers =============

export function createTelemetryEvent(
  type: TelemetryEvent['event_type'],
  traceId: string,
  variantId?: string,
  additionalData?: Partial<TelemetryEvent>,
): TelemetryEvent {
  return {
    trace_id: traceId,
    variant_id: variantId || '',
    ts_utc: new Date().toISOString(),
    event_type: type,
    task_type: 'general_qa',
    ...additionalData,
  }
}

// ============= Validation Helpers =============

// ============= Logging Helpers =============

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, error?: Error, meta?: Record<string, unknown>): void
}

export function createLogger(service: string): Logger {
  return {
    debug: (message: string, meta?: Record<string, unknown>) => {
      console.debug(`[${service}] ${message}`, meta)
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      console.info(`[${service}] ${message}`, meta)
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      console.warn(`[${service}] ${message}`, meta)
    },
    error: (message: string, error?: Error, meta?: Record<string, unknown>) => {
      console.error(`[${service}] ${message}`, error, meta)
    },
  }
}

// ============= Math Utilities =============

export function mean(numbers: number[]): number {
  if (numbers.length === 0) return 0
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

export function stddev(numbers: number[]): number {
  if (numbers.length < 2) return 0
  const avg = mean(numbers)
  const squareDiffs = numbers.map((n) => Math.pow(n - avg, 2))
  return Math.sqrt(mean(squareDiffs))
}

// ============= Pareto Optimization =============

// ============= Telemetry Service =============

interface TelemetryMetrics {
  counters: Record<string, number>
  latencies: Record<string, number[]>
  errors: Array<{ timestamp: string; error: string; context?: Record<string, unknown> }>
}

interface TelemetryService {
  trackEvent(event: TelemetryEvent): void
  trackMetric(name: string, value: number, tags?: Record<string, string>): void
  trackError(error: Error, context?: Record<string, unknown>): void
  recordLatency(name: string, duration: number): void
  recordCounter(name: string, count: number): void
  recordMetric(name: string, value: number, labels?: Record<string, string>): void
  incrementCounter(name: string, count?: number): void
  getMetrics(): Promise<TelemetryMetrics>
  flush(): Promise<void>
}

// Singleton telemetry service
let telemetryService: TelemetryService | null = null

export function getTelemetryService(): TelemetryService {
  if (!telemetryService) {
    // Simple console-based telemetry for now
    telemetryService = {
      trackEvent: (event: TelemetryEvent) => {
        console.log('[Telemetry] Event:', event)
      },
      trackMetric: (name: string, value: number, tags?: Record<string, string>) => {
        console.log('[Telemetry] Metric:', { name, value, tags })
      },
      trackError: (error: Error, context?: Record<string, unknown>) => {
        console.error('[Telemetry] Error:', error, context)
      },
      recordLatency: (name: string, duration: number) => {
        console.log('[Telemetry] Latency:', { name, duration })
      },
      recordCounter: (name: string, count: number) => {
        console.log('[Telemetry] Counter:', { name, count })
      },
      recordMetric: (name: string, value: number, labels?: Record<string, string>) => {
        console.log('[Telemetry] Metric:', { name, value, labels })
      },
      incrementCounter: (name: string, count: number = 1) => {
        console.log('[Telemetry] Increment Counter:', { name, count })
      },
      getMetrics: async () => {
        // Return mock metrics for now
        return {
          counters: {},
          latencies: {},
          errors: [],
        }
      },
      flush: async () => {
        // No-op for console telemetry
      },
    }
  }
  return telemetryService
}

// ============= Retry Logic =============
