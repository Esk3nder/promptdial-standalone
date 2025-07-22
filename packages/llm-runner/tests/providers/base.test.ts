import { describe, it, expect, vi, beforeEach } from 'vitest'
import { BaseLLMProvider, LLMResponse, StreamingCallback } from '../../src/providers/base'
import { PromptVariant, LLMProviderConfig } from '@promptdial/shared'
import { createTestPromptVariant, createTestLLMConfig } from '@promptdial/shared'

// Mock implementation for testing
class TestProvider extends BaseLLMProvider {
  async call(
    variant: PromptVariant,
    streaming?: boolean,
    callback?: StreamingCallback
  ): Promise<LLMResponse> {
    await this.checkRateLimit()
    
    const response: LLMResponse = {
      content: `Response to: ${variant.optimized_prompt}`,
      tokens_used: 100,
      latency_ms: 500,
      provider: this.config.provider,
      model: this.config.model || 'test-model'
    }
    
    await this.logTelemetry(variant, response)
    
    if (streaming && callback) {
      callback.onComplete?.(response)
    }
    
    return response
  }
  
  protected extractTokenFromChunk(chunk: any): string | null {
    return chunk.token || null
  }
}

// Mock telemetry
vi.mock('@promptdial/shared', async () => {
  const actual = await vi.importActual('@promptdial/shared')
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    getTelemetryService: () => ({
      incrementCounter: vi.fn(),
      recordLatency: vi.fn(),
      recordMetric: vi.fn(),
      trackEvent: vi.fn(),
      trackError: vi.fn(),
      flush: vi.fn()
    })
  }
})

describe('BaseLLMProvider', () => {
  let provider: TestProvider
  let config: LLMProviderConfig

  beforeEach(() => {
    config = createTestLLMConfig({
      provider: 'test',
      api_key: 'test-key',
      model: 'test-model'
    })
    provider = new TestProvider(config)
  })

  describe('constructor', () => {
    it('should initialize with config', () => {
      expect(provider.getProvider()).toBe('test')
      expect(provider.isConfigured()).toBe(true)
    })
  })

  describe('isConfigured', () => {
    it('should return true with API key', () => {
      expect(provider.isConfigured()).toBe(true)
    })

    it('should return false without API key', () => {
      const noKeyProvider = new TestProvider({
        ...config,
        api_key: ''
      })
      expect(noKeyProvider.isConfigured()).toBe(false)
    })
  })

  describe('call', () => {
    it('should call LLM and return response', async () => {
      const variant = createTestPromptVariant()
      const response = await provider.call(variant)
      
      expect(response.content).toContain('Response to:')
      expect(response.tokens_used).toBe(100)
      expect(response.latency_ms).toBe(500)
      expect(response.provider).toBe('test')
      expect(response.model).toBe('test-model')
    })

    it('should handle streaming callback', async () => {
      const variant = createTestPromptVariant()
      const onComplete = vi.fn()
      
      await provider.call(variant, true, { onComplete })
      
      expect(onComplete).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.any(String),
          tokens_used: 100
        })
      )
    })

    it('should check rate limits', async () => {
      const telemetry = vi.mocked((await import('@promptdial/shared')).getTelemetryService())
      const variant = createTestPromptVariant()
      
      await provider.call(variant)
      
      expect(telemetry.incrementCounter).toHaveBeenCalledWith(
        'llm_requests',
        1,
        { provider: 'test' }
      )
    })

    it('should log telemetry', async () => {
      const telemetry = vi.mocked((await import('@promptdial/shared')).getTelemetryService())
      const variant = createTestPromptVariant()
      
      await provider.call(variant)
      
      expect(telemetry.recordLatency).toHaveBeenCalledWith('test', 500)
      expect(telemetry.incrementCounter).toHaveBeenCalledWith(
        'llm_tokens',
        100,
        { provider: 'test', model: 'test-model' }
      )
      expect(telemetry.recordMetric).toHaveBeenCalledWith(
        'llm_cost_usd',
        expect.any(Number),
        { provider: 'test', model: 'test-model' }
      )
    })
  })

  describe('calculateCost', () => {
    it('should calculate cost for known models', () => {
      const testCases = [
        { model: 'gpt-4', tokens: 1000, expected: 0.03 },
        { model: 'gpt-3.5-turbo', tokens: 1000, expected: 0.002 },
        { model: 'claude-3-opus', tokens: 2000, expected: 0.03 },
        { model: 'gemini-pro', tokens: 5000, expected: 0.005 }
      ]
      
      testCases.forEach(({ model, tokens, expected }) => {
        const cost = (provider as any).calculateCost(tokens, model)
        expect(cost).toBe(expected)
      })
    })

    it('should use default rate for unknown models', () => {
      const cost = (provider as any).calculateCost(1000, 'unknown-model')
      expect(cost).toBe(0.01)
    })
  })

  describe('handleStreaming', () => {
    it('should handle streaming tokens', async () => {
      const chunks = [
        { token: 'Hello' },
        { token: ' ' },
        { token: 'world' },
        { token: '!' }
      ]
      
      async function* generateChunks() {
        for (const chunk of chunks) {
          yield chunk
        }
      }
      
      const onToken = vi.fn()
      const result = await (provider as any).handleStreaming(
        generateChunks(),
        { onToken }
      )
      
      expect(result).toBe('Hello world!')
      expect(onToken).toHaveBeenCalledTimes(4)
      expect(onToken).toHaveBeenCalledWith('Hello')
      expect(onToken).toHaveBeenCalledWith('!')
    })

    it('should handle streaming errors', async () => {
      async function* generateError() {
        yield { token: 'Start' }
        throw new Error('Stream error')
      }
      
      const onError = vi.fn()
      
      await expect(
        (provider as any).handleStreaming(generateError(), { onError })
      ).rejects.toThrow('Stream error')
      
      expect(onError).toHaveBeenCalledWith(expect.any(Error))
    })

    it('should ignore null tokens', async () => {
      async function* generateChunks() {
        yield { token: 'Hello' }
        yield {} // No token
        yield { token: 'world' }
      }
      
      const result = await (provider as any).handleStreaming(generateChunks())
      expect(result).toBe('Helloworld')
    })
  })

  describe('createErrorResponse', () => {
    it('should format error response correctly', () => {
      const error = new Error('Test error')
      const response = (provider as any).createErrorResponse(
        error,
        'test-provider',
        'test-model'
      )
      
      expect(response).toEqual({
        content: '',
        tokens_used: 0,
        latency_ms: 0,
        provider: 'test-provider',
        model: 'test-model',
        error: 'Test error'
      })
    })
  })

  describe('getProvider', () => {
    it('should return provider name', () => {
      expect(provider.getProvider()).toBe('test')
    })
  })
})