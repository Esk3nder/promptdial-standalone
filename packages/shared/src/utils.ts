/**
 * PromptDial 2.0 - Shared Utilities
 */

import { ServiceError, ServiceRequest, ServiceResponse, TelemetryEvent } from './types'
import { ERROR_CODES, STATUS_CODES } from './constants'

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

export class PromptDialError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = STATUS_CODES.INTERNAL_ERROR,
    public retryable: boolean = false,
    public details?: any
  ) {
    super(message)
    this.name = 'PromptDialError'
  }
}

export function createServiceError(
  code: string,
  message: string,
  retryable: boolean = false,
  details?: any
): ServiceError {
  return {
    code,
    message,
    retryable,
    details
  }
}

export function isRetryableError(error: ServiceError | PromptDialError): boolean {
  return error.retryable || 
    error.code === ERROR_CODES.SERVICE_UNAVAILABLE ||
    error.code === ERROR_CODES.TIMEOUT ||
    error.code === ERROR_CODES.RATE_LIMIT_EXCEEDED
}

// ============= Service Communication =============

export function createServiceRequest<T>(
  service: string,
  method: string,
  payload: T,
  traceId?: string
): ServiceRequest<T> {
  return {
    trace_id: traceId || generateTraceId(),
    timestamp: new Date(),
    service,
    method,
    payload
  }
}

export function createServiceResponse<T>(
  request: ServiceRequest,
  data?: T,
  error?: ServiceError
): ServiceResponse<T> {
  return {
    trace_id: request.trace_id,
    timestamp: new Date(),
    service: request.service,
    success: !error,
    data,
    error
  }
}

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

export function validatePrompt(prompt: string): void {
  if (!prompt || typeof prompt !== 'string') {
    throw new PromptDialError(
      ERROR_CODES.INVALID_PROMPT,
      'Prompt must be a non-empty string',
      STATUS_CODES.BAD_REQUEST
    )
  }
  
  if (prompt.length > 10000) {
    throw new PromptDialError(
      ERROR_CODES.INVALID_PROMPT,
      'Prompt exceeds maximum length of 10,000 characters',
      STATUS_CODES.BAD_REQUEST
    )
  }
}

export function validateBudget(costCap: number, latencyCap: number): void {
  if (costCap < 0.01) {
    throw new PromptDialError(
      ERROR_CODES.INVALID_PARAMETERS,
      'Cost cap must be at least $0.01',
      STATUS_CODES.UNPROCESSABLE_ENTITY
    )
  }
  
  if (latencyCap < 1000) {
    throw new PromptDialError(
      ERROR_CODES.INVALID_PARAMETERS,
      'Latency cap must be at least 1000ms',
      STATUS_CODES.UNPROCESSABLE_ENTITY
    )
  }
}

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

export function confidenceInterval(
  scores: number[],
  confidenceLevel: number = 0.95
): [number, number] {
  const m = mean(scores)
  const sd = stddev(scores)
  const z = confidenceLevel === 0.95 ? 1.96 : 2.576 // 95% or 99%
  const margin = z * (sd / Math.sqrt(scores.length))
  return [m - margin, m + margin]
}

// ============= Pareto Optimization =============

export interface ParetoPoint {
  id: string
  score: number
  cost: number
}

export function findParetoFrontier(points: ParetoPoint[]): ParetoPoint[] {
  // Sort by cost (ascending)
  const sorted = points.slice().sort((a, b) => a.cost - b.cost)
  const frontier: ParetoPoint[] = []
  let maxScore = -Infinity
  
  for (const point of sorted) {
    // A point is on the frontier if it has higher score than all cheaper points
    if (point.score > maxScore) {
      frontier.push(point)
      maxScore = point.score
    }
  }
  
  return frontier
}

// ============= Retry Logic =============

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error
      
      if (error instanceof PromptDialError && !error.retryable) {
        throw error
      }
      
      if (i < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, i)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  throw lastError || new Error('Retry failed')
}