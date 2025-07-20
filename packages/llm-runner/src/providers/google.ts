/**
 * PromptDial 2.0 - Google AI Provider
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { BaseLLMProvider, LLMResponse, StreamingCallback } from './base'
import { PromptVariant, LLMProviderConfig } from '@promptdial/shared'

export class GoogleAIProvider extends BaseLLMProvider {
  private client: GoogleGenerativeAI | null = null
  
  constructor(config: LLMProviderConfig) {
    super(config)
    
    if (this.isConfigured()) {
      this.client = new GoogleGenerativeAI(config.api_key)
    }
  }
  
  async call(
    variant: PromptVariant,
    streaming: boolean = false,
    callback?: StreamingCallback
  ): Promise<LLMResponse> {
    if (!this.client) {
      throw new Error('Google AI client not configured')
    }
    
    const startTime = Date.now()
    const modelName = this.config.default_model || 'gemini-1.5-flash'
    const model = this.client.getGenerativeModel({ model: modelName })
    
    try {
      await this.checkRateLimit()
      
      // Configure generation settings
      const generationConfig = {
        temperature: variant.temperature,
        maxOutputTokens: Math.min(variant.est_tokens * 2, 4096)
      }
      
      if (streaming && callback) {
        // Streaming mode
        const result = await model.generateContentStream({
          contents: [{ role: 'user', parts: [{ text: variant.prompt }] }],
          generationConfig
        })
        
        let content = ''
        
        for await (const chunk of result.stream) {
          const text = chunk.text()
          if (text) {
            content += text
            callback.onToken?.(text)
          }
        }
        
        const tokensUsed = variant.est_tokens + Math.ceil(content.length / 4)
        const latency = Date.now() - startTime
        
        const response: LLMResponse = {
          content,
          tokens_used: tokensUsed,
          latency_ms: latency,
          provider: 'google',
          model: modelName
        }
        
        callback.onComplete?.(response)
        await this.logTelemetry(variant, response)
        
        return response
      } else {
        // Non-streaming mode
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: variant.prompt }] }],
          generationConfig
        })
        
        const content = result.response.text()
        const tokensUsed = variant.est_tokens + Math.ceil(content.length / 4)
        const latency = Date.now() - startTime
        
        const response: LLMResponse = {
          content,
          tokens_used: tokensUsed,
          latency_ms: latency,
          provider: 'google',
          model: modelName,
          finish_reason: result.response.candidates?.[0]?.finishReason
        }
        
        await this.logTelemetry(variant, response)
        return response
      }
    } catch (error) {
      this.logger.error('Google AI call failed', error)
      return this.createErrorResponse(error as Error, 'google', modelName)
    }
  }
  
  protected extractTokenFromChunk(chunk: any): string | null {
    return chunk.text() || null
  }
}