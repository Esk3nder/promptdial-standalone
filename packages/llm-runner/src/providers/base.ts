/**
 * PromptDial 2.0 - Base LLM Provider
 *
 * Abstract base class for all LLM providers
 */

import {
  PromptVariant,
  LLMProviderConfig,
  createLogger,
  estimateTokens,
  getTelemetryService,
} from '@promptdial/shared'

export interface LLMResponse {
  content: string
  tokens_used: number
  latency_ms: number
  provider: string
  model: string
  finish_reason?: string
  error?: string
}

export interface StreamingCallback {
  onToken?: (token: string) => void
  onComplete?: (response: LLMResponse) => void
  onError?: (error: Error) => void
}

export abstract class BaseLLMProvider {
  protected config: LLMProviderConfig
  protected logger: any

  constructor(config: LLMProviderConfig) {
    this.config = config
    this.logger = createLogger(`llm-${config.provider}`)
  }

  /**
   * Call the LLM with a prompt variant
   */
  abstract call(
    variant: PromptVariant,
    streaming?: boolean,
    callback?: StreamingCallback,
  ): Promise<LLMResponse>

  /**
   * Check if the provider is properly configured
   */
  isConfigured(): boolean {
    return !!this.config.api_key
  }

  /**
   * Get provider name
   */
  getProvider(): string {
    return this.config.provider
  }

  /**
   * Check rate limits
   */
  protected async checkRateLimit(): Promise<void> {
    // TODO: Implement rate limiting
    const telemetry = getTelemetryService()
    telemetry.incrementCounter('llm_requests', 1, {
      provider: this.config.provider,
    })
  }

  /**
   * Log telemetry for the call
   */
  protected async logTelemetry(
    variant: PromptVariant,
    response: LLMResponse,
    traceId?: string,
  ): Promise<void> {
    const telemetry = getTelemetryService()

    // Record latency
    telemetry.recordLatency(this.config.provider, response.latency_ms)

    // Record token usage
    telemetry.incrementCounter('llm_tokens', response.tokens_used, {
      provider: this.config.provider,
      model: response.model,
    })

    // Record cost
    const costUsd = this.calculateCost(response.tokens_used, response.model)
    telemetry.recordMetric('llm_cost_usd', costUsd, {
      provider: this.config.provider,
      model: response.model,
    })
  }

  /**
   * Calculate cost for token usage
   */
  protected calculateCost(tokens: number, model: string): number {
    // Provider-specific pricing
    const pricing: Record<string, number> = {
      'gpt-4': 0.03,
      'gpt-3.5-turbo': 0.002,
      'claude-3-opus': 0.015,
      'claude-3-sonnet': 0.003,
      'claude-3-5-sonnet': 0.003,
      'gemini-pro': 0.001,
      'gemini-1.5-flash': 0.0005,
    }

    const rate = pricing[model] || 0.01
    return (tokens / 1000) * rate
  }

  /**
   * Handle streaming response
   */
  protected async handleStreaming(
    stream: AsyncIterable<any>,
    callback?: StreamingCallback,
  ): Promise<string> {
    let fullContent = ''

    try {
      for await (const chunk of stream) {
        const token = this.extractTokenFromChunk(chunk)
        if (token) {
          fullContent += token
          callback?.onToken?.(token)
        }
      }

      return fullContent
    } catch (error) {
      callback?.onError?.(error as Error)
      throw error
    }
  }

  /**
   * Extract token from streaming chunk (provider-specific)
   */
  protected abstract extractTokenFromChunk(chunk: any): string | null

  /**
   * Format error response
   */
  protected createErrorResponse(error: Error, provider: string, model: string): LLMResponse {
    return {
      content: '',
      tokens_used: 0,
      latency_ms: 0,
      provider,
      model,
      error: error.message,
    }
  }
}
