import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIProvider } from '../../src/providers/openai'
import { createTestPromptVariant, createTestLLMConfig } from '@promptdial/shared'
import type { LLMProviderConfig } from '@promptdial/shared'

// Mock OpenAI SDK
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            id: 'test-completion',
            choices: [
              {
                message: { content: 'Test response' },
                finish_reason: 'stop',
              },
            ],
            usage: {
              total_tokens: 150,
              prompt_tokens: 50,
              completion_tokens: 100,
            },
          }),
        },
      },
    })),
  }
})

// Mock shared dependencies
vi.mock('@promptdial/shared', async () => {
  const actual = await vi.importActual('@promptdial/shared')
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    getTelemetryService: () => ({
      incrementCounter: vi.fn(),
      recordLatency: vi.fn(),
      recordMetric: vi.fn(),
      trackEvent: vi.fn(),
      trackError: vi.fn(),
      flush: vi.fn(),
    }),
  }
})

describe('OpenAIProvider', () => {
  let provider: OpenAIProvider
  let config: LLMProviderConfig
  let mockOpenAI: any

  beforeEach(() => {
    vi.clearAllMocks()

    config = createTestLLMConfig({
      provider: 'openai',
      api_key: 'sk-test-key',
      model: 'gpt-4',
      temperature: 0.7,
      max_tokens: 1000,
    })

    provider = new OpenAIProvider(config)

    // Get mock instance
    const OpenAI = vi.mocked((provider as any).client.constructor)
    mockOpenAI = (provider as any).client
  })

  describe('constructor', () => {
    it('should initialize OpenAI client', () => {
      expect(provider).toBeDefined()
      expect((provider as any).client).toBeDefined()
    })

    it('should use custom base URL if provided', () => {
      const customConfig = {
        ...config,
        base_url: 'https://custom.openai.com',
      }

      const customProvider = new OpenAIProvider(customConfig)
      expect(customProvider).toBeDefined()
    })
  })

  describe('call', () => {
    it('should make successful API call', async () => {
      const variant = createTestPromptVariant({
        optimized_prompt: 'Test prompt',
      })

      const response = await provider.call(variant)

      expect(response.content).toBe('Test response')
      expect(response.tokens_used).toBe(150)
      expect(response.provider).toBe('openai')
      expect(response.model).toBe('gpt-4')
      expect(response.finish_reason).toBe('stop')

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Test prompt' }],
        temperature: 0.7,
        max_tokens: 1000,
        stream: false,
      })
    })

    it('should handle system prompts', async () => {
      const variant = createTestPromptVariant({
        optimized_prompt: 'User prompt',
        metadata: {
          system_prompt: 'You are a helpful assistant',
        },
      })

      await provider.call(variant)

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            { role: 'system', content: 'You are a helpful assistant' },
            { role: 'user', content: 'User prompt' },
          ],
        }),
      )
    })

    it('should handle optional parameters', async () => {
      const configWithParams = {
        ...config,
        top_p: 0.9,
        frequency_penalty: 0.5,
        presence_penalty: 0.3,
      }

      const paramProvider = new OpenAIProvider(configWithParams)
      const variant = createTestPromptVariant()

      await paramProvider.call(variant)

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          top_p: 0.9,
          frequency_penalty: 0.5,
          presence_penalty: 0.3,
        }),
      )
    })

    it('should handle API errors', async () => {
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(
        new Error('API Error: Rate limit exceeded'),
      )

      const variant = createTestPromptVariant()
      const response = await provider.call(variant)

      expect(response.error).toBe('API Error: Rate limit exceeded')
      expect(response.content).toBe('')
      expect(response.tokens_used).toBe(0)
    })

    it('should handle missing response content', async () => {
      mockOpenAI.chat.completions.create.mockResolvedValueOnce({
        id: 'test',
        choices: [{ message: {}, finish_reason: 'stop' }],
        usage: { total_tokens: 0 },
      })

      const variant = createTestPromptVariant()
      const response = await provider.call(variant)

      expect(response.content).toBe('')
      expect(response.tokens_used).toBe(0)
    })

    it('should track timing', async () => {
      const variant = createTestPromptVariant()
      const response = await provider.call(variant)

      expect(response.latency_ms).toBeGreaterThan(0)
    })
  })

  describe('streaming', () => {
    beforeEach(() => {
      // Mock streaming response
      const mockStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: { content: 'Hello' },
                finish_reason: null,
              },
            ],
          }
          yield {
            choices: [
              {
                delta: { content: ' world' },
                finish_reason: null,
              },
            ],
          }
          yield {
            choices: [
              {
                delta: { content: '!' },
                finish_reason: 'stop',
              },
            ],
          }
        },
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(mockStream)
    })

    it('should handle streaming responses', async () => {
      const variant = createTestPromptVariant()
      const tokens: string[] = []
      let completed = false

      const response = await provider.call(variant, true, {
        onToken: (token) => tokens.push(token),
        onComplete: () => {
          completed = true
        },
      })

      expect(response.content).toBe('Hello world!')
      expect(tokens).toEqual(['Hello', ' world', '!'])
      expect(completed).toBe(true)

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
        }),
      )
    })

    it('should handle streaming errors', async () => {
      const errorStream = {
        async *[Symbol.asyncIterator]() {
          yield {
            choices: [
              {
                delta: { content: 'Start' },
                finish_reason: null,
              },
            ],
          }
          throw new Error('Stream interrupted')
        },
      }

      mockOpenAI.chat.completions.create.mockResolvedValue(errorStream)

      const variant = createTestPromptVariant()
      let errorCaught: Error | null = null

      const response = await provider.call(variant, true, {
        onError: (error) => {
          errorCaught = error
        },
      })

      expect(response.error).toBe('Stream interrupted')
      expect(errorCaught?.message).toBe('Stream interrupted')
    })
  })

  describe('extractTokenFromChunk', () => {
    it('should extract content from delta', () => {
      const chunk = {
        choices: [
          {
            delta: { content: 'Hello' },
          },
        ],
      }

      const token = (provider as any).extractTokenFromChunk(chunk)
      expect(token).toBe('Hello')
    })

    it('should handle missing content', () => {
      const chunk = {
        choices: [
          {
            delta: {},
          },
        ],
      }

      const token = (provider as any).extractTokenFromChunk(chunk)
      expect(token).toBeNull()
    })

    it('should handle missing choices', () => {
      const chunk = {}

      const token = (provider as any).extractTokenFromChunk(chunk)
      expect(token).toBeNull()
    })
  })

  describe('model variants', () => {
    it('should support different GPT models', async () => {
      const models = ['gpt-4', 'gpt-3.5-turbo', 'gpt-4-turbo']

      for (const model of models) {
        const modelConfig = { ...config, model }
        const modelProvider = new OpenAIProvider(modelConfig)
        const variant = createTestPromptVariant()

        await modelProvider.call(variant)

        expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(
          expect.objectContaining({ model }),
        )
      }
    })
  })

  describe('error handling', () => {
    it('should handle network errors', async () => {
      const networkError = new Error('Network error')
      networkError.name = 'NetworkError'
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(networkError)

      const variant = createTestPromptVariant()
      const response = await provider.call(variant)

      expect(response.error).toBe('Network error')
      expect(response.content).toBe('')
    })

    it('should handle timeout errors', async () => {
      const timeoutError = new Error('Request timeout')
      timeoutError.name = 'TimeoutError'
      mockOpenAI.chat.completions.create.mockRejectedValueOnce(timeoutError)

      const variant = createTestPromptVariant()
      const response = await provider.call(variant)

      expect(response.error).toBe('Request timeout')
    })
  })
})
