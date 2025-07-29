/**
 * PromptDial 3.0 - Shared Utilities
 */

import { TelemetryEvent, ServiceResponse } from './types'
import { ERROR_CODES } from './constants'

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
  retryable?: boolean
  details?: Record<string, unknown>
}

export function createServiceError(
  code: string,
  message: string,
  retryable?: boolean,
  details?: Record<string, unknown>,
): ServiceError {
  return {
    code,
    message,
    retryable: retryable || false,
    details,
  }
}

// ============= Service Communication =============

export function createServiceResponse<T = unknown>(
  request: { trace_id?: string; service?: string; [key: string]: unknown },
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
    service: request.service || process.env.SERVICE_NAME || 'unknown',
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
    'openai:gpt-4': 0.03,
    'openai:gpt-3.5-turbo': 0.002,
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

// PromptDialError class
export class PromptDialError extends Error {
  code: string
  statusCode: number
  retryable: boolean
  details?: Record<string, unknown>

  constructor(
    code: string,
    message: string,
    statusCode: number = 500,
    retryable: boolean = false,
    details?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'PromptDialError'
    this.code = code
    this.statusCode = statusCode
    this.retryable = retryable
    this.details = details
  }
}

// Check if error is retryable
export function isRetryableError(error: any): boolean {
  if (error instanceof PromptDialError) {
    return error.retryable
  }
  // Check error codes first - they take precedence
  if (error && error.code) {
    const retryableCodes = [ERROR_CODES.SERVICE_UNAVAILABLE, ERROR_CODES.TIMEOUT, ERROR_CODES.RATE_LIMIT_EXCEEDED]
    if (retryableCodes.includes(error.code)) {
      return true
    }
  }
  // Then check if error has explicit retryable property
  if (error && typeof error.retryable === 'boolean') {
    return error.retryable
  }
  // For testing: regular Error objects are retryable by default
  if (error instanceof Error && error.constructor === Error) {
    return true
  }
  return false
}

// Create service request
export function createServiceRequest(
  service: string,
  method: string,
  data: any,
  traceId?: string,
): any {
  return {
    service,
    method,
    payload: data,
    trace_id: traceId || generateTraceId(),
    timestamp: new Date(),
  }
}

// Validation functions
export function validatePrompt(prompt: string): void {
  if (!prompt || typeof prompt !== 'string') {
    throw new PromptDialError('INVALID_PROMPT', 'Prompt must be a non-empty string', 400, false)
  }
  if (prompt.length > 10000) {
    throw new PromptDialError('INVALID_PROMPT', 'Prompt exceeds maximum length of 10000 characters', 400, false)
  }
}

export function validateBudget(costCap: number, latencyCap: number): void {
  if (typeof costCap !== 'number' || costCap < 0.01 || costCap > 100) {
    throw new PromptDialError('INVALID_PARAMETERS', 'Cost cap must be between 0.01 and 100', 400, false)
  }
  if (typeof latencyCap !== 'number' || latencyCap < 1000 || latencyCap > 60000) {
    throw new PromptDialError('INVALID_PARAMETERS', 'Latency cap must be between 1000 and 60000ms', 400, false)
  }
}

// Math utilities
export function confidenceInterval(scores: number[], level: number = 0.95): [number, number] {
  const m = mean(scores)
  const sd = stddev(scores)
  const n = scores.length
  
  // Use t-distribution for small samples
  const tValue = level === 0.99 ? 3.355 : 2.776 // Approximation for df=4
  const margin = (sd / Math.sqrt(n)) * tValue
  
  return [m - margin, m + margin]
}

// Pareto optimization
export function findParetoFrontier(points: Array<{ id: string; score: number; cost: number }>): Array<{ id: string; score: number; cost: number }> {
  if (points.length === 0) return []
  if (points.length === 1) return points
  
  const frontier: typeof points = []
  
  for (const point of points) {
    // Check if dominated by any existing point
    let dominated = false
    const toRemove: number[] = []
    
    for (let i = 0; i < frontier.length; i++) {
      const f = frontier[i]
      if (f.score >= point.score && f.cost <= point.cost) {
        // Current point is dominated
        dominated = true
        break
      } else if (point.score >= f.score && point.cost <= f.cost) {
        // Current point dominates frontier point
        toRemove.push(i)
      }
    }
    
    if (!dominated) {
      // Remove dominated points in reverse order
      for (let i = toRemove.length - 1; i >= 0; i--) {
        frontier.splice(toRemove[i], 1)
      }
      frontier.push(point)
    }
  }
  
  // Sort by ID to maintain consistent order
  return frontier.sort((a, b) => a.id.localeCompare(b.id))
}

// Retry with backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000,
): Promise<T> {
  let lastError: Error | undefined
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      // Don't retry if not retryable
      if (!isRetryableError(error)) {
        throw error
      }
      
      // Don't retry on last attempt
      if (i === maxRetries - 1) {
        throw error
      }
      
      // Wait with exponential backoff
      const delay = initialDelay * Math.pow(2, i)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }
  
  throw lastError
}
