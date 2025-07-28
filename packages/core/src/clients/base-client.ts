import axios, { AxiosInstance, AxiosError } from 'axios'

export interface CircuitBreakerOptions {
  failureThreshold: number
  resetTimeout: number
  halfOpenRetries: number
}

export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
}

export interface ServiceClientOptions {
  timeout?: number
  retryOptions?: RetryOptions
  circuitBreakerOptions?: CircuitBreakerOptions
  maxRetries?: number
}

enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

class CircuitBreaker {
  private state = CircuitState.CLOSED
  private failureCount = 0
  private lastFailureTime?: number
  private halfOpenRetries = 0

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - (this.lastFailureTime || 0) > this.options.resetTimeout) {
        this.state = CircuitState.HALF_OPEN
        this.halfOpenRetries = 0
      } else {
        throw new Error('Circuit breaker is OPEN')
      }
    }

    try {
      const result = await fn()
      this.onSuccess()
      return result
    } catch (error) {
      this.onFailure()
      throw error
    }
  }

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenRetries++
      if (this.halfOpenRetries >= this.options.halfOpenRetries) {
        this.state = CircuitState.CLOSED
        this.failureCount = 0
      }
    } else {
      this.failureCount = 0
    }
  }

  private onFailure() {
    this.failureCount++
    this.lastFailureTime = Date.now()

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN
    }
  }
}

export abstract class ServiceClient {
  protected axios: AxiosInstance
  private circuitBreaker: CircuitBreaker
  private retryOptions: RetryOptions

  constructor(
    protected serviceName: string,
    protected baseUrl: string,
    options: ServiceClientOptions = {}
  ) {
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      }
    })

    this.retryOptions = options.retryOptions || {
      maxRetries: options.maxRetries ?? 3,
      baseDelay: 1000,
      maxDelay: 10000
    }

    this.circuitBreaker = new CircuitBreaker(
      options.circuitBreakerOptions || {
        failureThreshold: 5,
        resetTimeout: 60000,
        halfOpenRetries: 3
      }
    )
  }

  protected async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any
  ): Promise<T> {
    const startTime = Date.now()

    try {
      return await this.circuitBreaker.execute(async () => {
        return await this.retryWithBackoff(async () => {
          const response = await this.axios.request<T>({
            method,
            url: endpoint,
            data
          })

          this.logRequest(method, endpoint, Date.now() - startTime, 'success')
          return response.data
        })
      })
    } catch (error) {
      this.logRequest(method, endpoint, Date.now() - startTime, 'error', error)
      throw this.handleError(error)
    }
  }

  private async retryWithBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: any
    
    for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error
        
        if (attempt === this.retryOptions.maxRetries) {
          break
        }

        if (!this.isRetriableError(error)) {
          throw error
        }

        const delay = Math.min(
          this.retryOptions.baseDelay * Math.pow(2, attempt),
          this.retryOptions.maxDelay
        )
        
        console.log(`[${this.serviceName}] Retry attempt ${attempt + 1} after ${delay}ms`)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    throw lastError
  }

  private isRetriableError(error: any): boolean {
    if (error instanceof AxiosError) {
      // Network errors or 5xx errors are retriable
      return !error.response || error.response.status >= 500
    }
    return false
  }

  private handleError(error: any): Error {
    if (error instanceof AxiosError) {
      if (error.response) {
        return new Error(
          `${this.serviceName} error (${error.response.status}): ${
            error.response.data?.message || error.message
          }`
        )
      } else if (error.request) {
        return new Error(`${this.serviceName} network error: No response received`)
      }
    }
    return error instanceof Error ? error : new Error(String(error))
  }

  private logRequest(
    method: string,
    endpoint: string,
    duration: number,
    status: 'success' | 'error',
    error?: any
  ) {
    const logData = {
      service: this.serviceName,
      method,
      endpoint,
      duration,
      status,
      timestamp: new Date().toISOString()
    }

    if (status === 'error') {
      console.error('[ServiceClient]', logData, error)
    } else if (process.env.DEBUG === 'true') {
      console.log('[ServiceClient]', logData)
    }
  }

  async health(): Promise<boolean> {
    try {
      await this.request('GET', '/health')
      return true
    } catch {
      return false
    }
  }
}