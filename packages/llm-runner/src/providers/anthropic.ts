/**
 * PromptDial 2.0 - Anthropic Provider
 */

import Anthropic from '@anthropic-ai/sdk'
import { BaseLLMProvider, LLMResponse, StreamingCallback } from './base'
import { PromptVariant, LLMProviderConfig } from '@promptdial/shared'

export class AnthropicProvider extends BaseLLMProvider {
  private client: Anthropic | null = null
  
  constructor(config: LLMProviderConfig) {
    super(config)
    
    if (this.isConfigured()) {
      this.client = new Anthropic({
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
      throw new Error('Anthropic client not configured')
    }
    
    const startTime = Date.now()
    const model = this.config.default_model || 'claude-3-5-sonnet-20241022'
    
    try {
      await this.checkRateLimit()
      
      if (streaming && callback) {
        // Streaming mode
        const stream = await this.client.messages.create({
          model,
          messages: [{ role: 'user', content: variant.prompt }],
          temperature: variant.temperature,
          max_tokens: Math.min(variant.est_tokens * 2, 4096),
          stream: true
        })
        
        let content = ''
        let inputTokens = 0
        let outputTokens = 0
        
        for await (const event of stream) {
          if (event.type === 'content_block_delta') {
            const token = event.delta.text
            content += token
            callback.onToken?.(token)
          } else if (event.type === 'message_start') {
            inputTokens = event.message.usage?.input_tokens || 0
          } else if (event.type === 'message_delta') {
            outputTokens = event.usage?.output_tokens || 0
          }
        }
        
        const tokensUsed = inputTokens + outputTokens
        const latency = Date.now() - startTime
        
        const response: LLMResponse = {
          content,
          tokens_used: tokensUsed || variant.est_tokens,
          latency_ms: latency,
          provider: 'anthropic',
          model
        }
        
        callback.onComplete?.(response)
        await this.logTelemetry(variant, response)
        
        return response
      } else {
        // Non-streaming mode
        const message = await this.client.messages.create({
          model,
          messages: [{ role: 'user', content: variant.prompt }],
          temperature: variant.temperature,
          max_tokens: Math.min(variant.est_tokens * 2, 4096)
        })
        
        const content = message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n')
        
        const tokensUsed = (message.usage?.input_tokens || 0) + 
                          (message.usage?.output_tokens || 0)
        const latency = Date.now() - startTime
        
        const response: LLMResponse = {
          content,
          tokens_used: tokensUsed || variant.est_tokens,
          latency_ms: latency,
          provider: 'anthropic',
          model,
          finish_reason: message.stop_reason || undefined
        }
        
        await this.logTelemetry(variant, response)
        return response
      }
    } catch (error) {
      this.logger.error('Anthropic call failed', error)
      return this.createErrorResponse(error as Error, 'anthropic', model)
    }
  }
  
  protected extractTokenFromChunk(chunk: any): string | null {
    if (chunk.type === 'content_block_delta') {
      return chunk.delta.text || null
    }
    return null
  }
}