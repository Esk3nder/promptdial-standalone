/**
 * PromptDial 2.0 - LLM Runner Service
 * 
 * Manages multi-provider LLM execution with streaming support
 */

import {
  PromptVariant,
  LLMProviderConfig,
  ServiceRequest,
  ServiceResponse,
  createServiceResponse,
  createServiceError,
  createLogger,
  ERROR_CODES,
  TECHNIQUES,
  getTelemetryService,
  createTelemetryEvent
} from '@promptdial/shared'

import { 
  BaseLLMProvider, 
  LLMResponse, 
  StreamingCallback 
} from './providers/base'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GoogleAIProvider } from './providers/google'
import { SelfConsistencyHandler, SelfConsistencyResult } from './self-consistency'

const logger = createLogger('llm-runner')

// ============= Provider Registry =============

type ProviderType = 'openai' | 'anthropic' | 'google' | 'cohere'

class ProviderRegistry {
  private providers: Map<ProviderType, BaseLLMProvider> = new Map()
  
  register(config: LLMProviderConfig): void {
    let provider: BaseLLMProvider
    
    switch (config.provider) {
      case 'openai':
        provider = new OpenAIProvider(config)
        break
      case 'anthropic':
        provider = new AnthropicProvider(config)
        break
      case 'google':
        provider = new GoogleAIProvider(config)
        break
      default:
        throw new Error(`Unsupported provider: ${config.provider}`)
    }
    
    if (provider.isConfigured()) {
      this.providers.set(config.provider, provider)
      logger.info(`Registered provider: ${config.provider}`)
    } else {
      logger.warn(`Provider ${config.provider} not configured (missing API key)`)
    }
  }
  
  get(provider: ProviderType): BaseLLMProvider | null {
    return this.providers.get(provider) || null
  }
  
  getConfigured(): BaseLLMProvider[] {
    return Array.from(this.providers.values())
  }
  
  hasProvider(provider: ProviderType): boolean {
    return this.providers.has(provider)
  }
}

// ============= LLM Runner Implementation =============

export class LLMRunner {
  private registry: ProviderRegistry
  private selfConsistencyHandler: SelfConsistencyHandler
  
  constructor() {
    this.registry = new ProviderRegistry()
    this.selfConsistencyHandler = new SelfConsistencyHandler(this)
    
    // Auto-register providers from environment
    this.autoRegisterProviders()
  }
  
  /**
   * Run a single prompt variant
   */
  async runSingle(
    variant: PromptVariant,
    streaming: boolean = false,
    callback?: StreamingCallback,
    traceId?: string
  ): Promise<LLMResponse> {
    const startTime = Date.now()
    
    // Determine provider from variant or model name
    const provider = this.selectProvider(variant)
    if (!provider) {
      throw new Error(`No provider available for model: ${variant.technique}`)
    }
    
    // Log start event
    if (traceId) {
      await this.logEvent('llm_call_start', traceId, variant.id)
    }
    
    try {
      // Execute the call
      const response = await provider.call(variant, streaming, callback)
      
      // Update response with actual cost
      response.cost_usd = provider['calculateCost'](
        response.tokens_used, 
        response.model
      )
      
      // Log completion
      if (traceId) {
        await this.logEvent('llm_call_complete', traceId, variant.id, {
          latency_ms: response.latency_ms,
          tokens_used: response.tokens_used,
          cost_usd: response.cost_usd
        })
      }
      
      return response
    } catch (error) {
      // Log error
      if (traceId) {
        await this.logEvent('llm_call_error', traceId, variant.id, {
          error: (error as Error).message
        })
      }
      
      throw error
    }
  }
  
  /**
   * Run multiple variants in parallel
   */
  async runBatch(
    variants: PromptVariant[],
    traceId?: string
  ): Promise<LLMResponse[]> {
    logger.info(`Running batch of ${variants.length} variants`)
    
    const promises = variants.map(variant => 
      this.runSingle(variant, false, undefined, traceId)
        .catch(error => {
          logger.error(`Variant ${variant.id} failed`, error)
          return this.createErrorResponse(error, variant)
        })
    )
    
    return Promise.all(promises)
  }
  
  /**
   * Run self-consistency sampling
   */
  async runSelfConsistency(
    variant: PromptVariant,
    numSamples?: number,
    traceId?: string
  ): Promise<SelfConsistencyResult> {
    // Check if this is a self-consistency variant
    if (!variant.technique.includes(TECHNIQUES.SELF_CONSISTENCY)) {
      throw new Error('Variant is not configured for self-consistency')
    }
    
    if (traceId) {
      await this.logEvent('self_consistency_start', traceId, variant.id)
    }
    
    const result = await this.selfConsistencyHandler.execute(variant, numSamples)
    
    if (traceId) {
      await this.logEvent('self_consistency_complete', traceId, variant.id, {
        consensus_score: result.consensus_score,
        num_samples: result.all_responses.length
      })
    }
    
    return result
  }
  
  /**
   * Get available providers
   */
  getAvailableProviders(): string[] {
    return this.registry.getConfigured().map(p => p.getProvider())
  }
  
  /**
   * Register a custom provider configuration
   */
  registerProvider(config: LLMProviderConfig): void {
    this.registry.register(config)
  }
  
  /**
   * Select provider based on variant
   */
  private selectProvider(variant: PromptVariant): BaseLLMProvider | null {
    // Try to extract provider from technique or model hint
    const providerHints: Record<string, ProviderType> = {
      'gpt': 'openai',
      'claude': 'anthropic',
      'gemini': 'google'
    }
    
    for (const [hint, provider] of Object.entries(providerHints)) {
      if (variant.technique.toLowerCase().includes(hint)) {
        const llmProvider = this.registry.get(provider)
        if (llmProvider) return llmProvider
      }
    }
    
    // Return first available provider
    const providers = this.registry.getConfigured()
    return providers[0] || null
  }
  
  /**
   * Auto-register providers from environment
   */
  private autoRegisterProviders(): void {
    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.registry.register({
        provider: 'openai',
        api_key: process.env.OPENAI_API_KEY,
        default_model: 'gpt-3.5-turbo',
        rate_limit: {
          requests_per_minute: 60,
          tokens_per_minute: 90000
        }
      })
    }
    
    // Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.registry.register({
        provider: 'anthropic',
        api_key: process.env.ANTHROPIC_API_KEY,
        default_model: 'claude-3-5-sonnet-20241022',
        rate_limit: {
          requests_per_minute: 50,
          tokens_per_minute: 100000
        }
      })
    }
    
    // Google AI
    if (process.env.GOOGLE_AI_API_KEY) {
      this.registry.register({
        provider: 'google',
        api_key: process.env.GOOGLE_AI_API_KEY,
        default_model: 'gemini-1.5-flash',
        rate_limit: {
          requests_per_minute: 60,
          tokens_per_minute: 1000000
        }
      })
    }
  }
  
  /**
   * Create error response
   */
  private createErrorResponse(error: Error, variant: PromptVariant): LLMResponse {
    return {
      content: '',
      tokens_used: 0,
      latency_ms: 0,
      provider: 'unknown',
      model: 'unknown',
      error: error.message
    }
  }
  
  /**
   * Log telemetry event
   */
  private async logEvent(
    eventType: string,
    traceId: string,
    variantId: string,
    additionalData?: any
  ): Promise<void> {
    try {
      const event = createTelemetryEvent(
        'variant_generated',
        traceId,
        variantId,
        {
          task_type: 'general_qa',
          ...additionalData
        }
      )
      await getTelemetryService().logEvent(event)
    } catch (error) {
      logger.error('Failed to log telemetry', error as Error)
    }
  }
}

// ============= Service API =============

let runnerInstance: LLMRunner | null = null

export function getLLMRunner(): LLMRunner {
  if (!runnerInstance) {
    runnerInstance = new LLMRunner()
  }
  return runnerInstance
}

export async function handleRunVariantRequest(
  request: ServiceRequest<{
    variant: PromptVariant
    streaming?: boolean
    trace_id?: string
  }>
): Promise<ServiceResponse<LLMResponse>> {
  try {
    const { variant, streaming, trace_id } = request.payload
    const response = await getLLMRunner().runSingle(
      variant,
      streaming || false,
      undefined,
      trace_id
    )
    return createServiceResponse(request, response)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Failed to run variant',
      true
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleRunBatchRequest(
  request: ServiceRequest<{
    variants: PromptVariant[]
    trace_id?: string
  }>
): Promise<ServiceResponse<LLMResponse[]>> {
  try {
    const { variants, trace_id } = request.payload
    const responses = await getLLMRunner().runBatch(variants, trace_id)
    return createServiceResponse(request, responses)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Failed to run batch',
      true
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleSelfConsistencyRequest(
  request: ServiceRequest<{
    variant: PromptVariant
    num_samples?: number
    trace_id?: string
  }>
): Promise<ServiceResponse<SelfConsistencyResult>> {
  try {
    const { variant, num_samples, trace_id } = request.payload
    const result = await getLLMRunner().runSelfConsistency(
      variant,
      num_samples,
      trace_id
    )
    return createServiceResponse(request, result)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Self-consistency failed',
      true
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3004
  
  app.use(express.json({ limit: '10mb' }))
  
  // Run single variant
  app.post('/run', async (req: any, res: any) => {
    const response = await handleRunVariantRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })
  
  // Run batch
  app.post('/run/batch', async (req: any, res: any) => {
    const response = await handleRunBatchRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })
  
  // Self-consistency
  app.post('/run/self-consistency', async (req: any, res: any) => {
    const response = await handleSelfConsistencyRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })
  
  // Streaming endpoint
  app.post('/run/stream', async (req: any, res: any) => {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')
    
    const { variant, trace_id } = req.body
    
    try {
      await getLLMRunner().runSingle(
        variant,
        true,
        {
          onToken: (token: string) => {
            res.write(`data: ${JSON.stringify({ token })}\n\n`)
          },
          onComplete: (response: LLMResponse) => {
            res.write(`data: ${JSON.stringify({ complete: true, response })}\n\n`)
            res.end()
          },
          onError: (error: Error) => {
            res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`)
            res.end()
          }
        },
        trace_id
      )
    } catch (error) {
      res.write(`data: ${JSON.stringify({ error: (error as Error).message })}\n\n`)
      res.end()
    }
  })
  
  // Get available providers
  app.get('/providers', (_req: any, res: any) => {
    const providers = getLLMRunner().getAvailableProviders()
    res.json({ providers })
  })
  
  app.get('/health', (_req: any, res: any) => {
    const providers = getLLMRunner().getAvailableProviders()
    res.json({ 
      status: 'healthy', 
      service: 'llm-runner',
      configured_providers: providers
    })
  })
  
  app.listen(PORT, () => {
    logger.info(`LLM Runner service running on port ${PORT}`)
    logger.info(`Configured providers: ${getLLMRunner().getAvailableProviders().join(', ')}`)
  })
}