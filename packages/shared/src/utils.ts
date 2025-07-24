/**
 * PromptDial 2.0 - Shared Utilities
 */

import { TelemetryEvent } from './types'

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

// ============= Service Communication =============


// ============= Token Estimation =============

export function estimateTokens(text: string): number {
  // Rough estimation: ~4 characters per token
  // More accurate would use tiktoken or similar
  return Math.ceil(text.length / 4)
}

export function estimateCost(
  tokens: number,
  provider: string,
  model: string
): number {
  // Simplified cost estimation - in production, use actual pricing
  const costPer1kTokens: Record<string, number> = {
    'openai:gpt-4': 0.03,
    'openai:gpt-3.5-turbo': 0.002,
    'anthropic:claude-3-opus': 0.015,
    'anthropic:claude-3-sonnet': 0.003,
    'google:gemini-pro': 0.001,
    'google:gemini-1.5-flash': 0.0005
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
  additionalData?: Partial<TelemetryEvent>
): TelemetryEvent {
  return {
    trace_id: traceId,
    variant_id: variantId || '',
    ts_utc: new Date().toISOString(),
    event_type: type,
    task_type: 'general_qa',
    ...additionalData
  }
}

// ============= Validation Helpers =============

// ============= Logging Helpers =============

export interface Logger {
  debug(message: string, meta?: any): void
  info(message: string, meta?: any): void
  warn(message: string, meta?: any): void
  error(message: string, error?: Error, meta?: any): void
}

export function createLogger(service: string): Logger {
  return {
    debug: (message: string, meta?: any) => {
      console.debug(`[${service}] ${message}`, meta)
    },
    info: (message: string, meta?: any) => {
      console.info(`[${service}] ${message}`, meta)
    },
    warn: (message: string, meta?: any) => {
      console.warn(`[${service}] ${message}`, meta)
    },
    error: (message: string, error?: Error, meta?: any) => {
      console.error(`[${service}] ${message}`, error, meta)
    }
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
  const squareDiffs = numbers.map(n => Math.pow(n - avg, 2))
  return Math.sqrt(mean(squareDiffs))
}


// ============= Pareto Optimization =============

// ============= Telemetry Service =============

interface TelemetryService {
  trackEvent(event: TelemetryEvent): void
  trackMetric(name: string, value: number, tags?: Record<string, string>): void
  trackError(error: Error, context?: Record<string, any>): void
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
      trackError: (error: Error, context?: Record<string, any>) => {
        console.error('[Telemetry] Error:', error, context)
      },
      flush: async () => {
        // No-op for console telemetry
      }
    }
  }
  return telemetryService
}

// ============= Retry Logic =============