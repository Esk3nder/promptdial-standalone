/**
 * PromptDial 2.0 - OpenAI Provider
 */

import OpenAI from 'openai'
import { BaseLLMProvider, LLMResponse, StreamingCallback } from './base'
import { PromptVariant, LLMProviderConfig } from '@promptdial/shared'

export class OpenAIProvider extends BaseLLMProvider {
  private client: OpenAI | null = null
  
  constructor(config: LLMProviderConfig) {
    super(config)
    
    if (this.isConfigured()) {
      this.client = new OpenAI({
        apiKey: config.api_key,
        baseURL: config.base_url
      })
    }
  }
  
  async call(
    variant: PromptVariant,
    streaming: boolean = false,
    callback?: StreamingCallback
  ): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('OpenAI client not configured')
    }
    
    const startTime = Date.now()
    const model = this.config.default_model || 'gpt-3.5-turbo'
    
    try {
      await this.checkRateLimit()
      
      if (streaming && callback) {
        // Streaming mode
        const stream = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: variant.prompt }],
          temperature: variant.temperature,
          max_tokens: Math.min(variant.est_tokens * 2, 4096),
          stream: true
        })
        
        const content = await this.handleStreaming(stream, callback)
        const tokensUsed = variant.est_tokens + Math.ceil(content.length / 4)
        const latency = Date.now() - startTime
        
        const response: LLMResponse = {
          content,
          tokens_used: tokensUsed,
          latency_ms: latency,
          provider: 'openai',
          model
        }
        
        callback.onComplete?.(response)
        await this.logTelemetry(variant, response)
        
        return response
      } else {
        // Non-streaming mode
        const completion = await this.client.chat.completions.create({
          model,
          messages: [{ role: 'user', content: variant.prompt }],
          temperature: variant.temperature,
          max_tokens: Math.min(variant.est_tokens * 2, 4096)
        })
        
        const content = completion.choices[0]?.message?.content || ''
        const tokensUsed = completion.usage?.total_tokens || variant.est_tokens
        const latency = Date.now() - startTime
        
        const response: LLMResponse = {
          content,
          tokens_used: tokensUsed,
          latency_ms: latency,
          provider: 'openai',
          model,
          finish_reason: completion.choices[0]?.finish_reason
        }
        
        await this.logTelemetry(variant, response)
        return response
      }
    } catch (error) {
      this.logger.error('OpenAI call failed', error)
      return this.createErrorResponse(error as Error, 'openai', model)
    }
  }
  
  protected extractTokenFromChunk(chunk: any): string | null {
    return chunk.choices[0]?.delta?.content || null
  }
}