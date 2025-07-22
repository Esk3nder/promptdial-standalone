import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LLMRunnerService } from '../src/index'
import { 
  createTestPromptVariant,
  createTestServiceRequest,
  createTestLLMConfig
} from '@promptdial/shared'
import type { ServiceRequest, LLMProviderConfig } from '@promptdial/shared'

// Mock all providers
vi.mock('../src/providers/openai', () => ({
  OpenAIProvider: vi.fn().mockImplementation((config) => ({
    call: vi.fn().mockResolvedValue({
      content: 'OpenAI response',
      tokens_used: 100,
      latency_ms: 500,
      provider: 'openai',
      model: config.model
    }),
    isConfigured: () => true,
    getProvider: () => 'openai'
  }))
}))

vi.mock('../src/providers/anthropic', () => ({
  AnthropicProvider: vi.fn().mockImplementation((config) => ({
    call: vi.fn().mockResolvedValue({
      content: 'Anthropic response',
      tokens_used: 120,
      latency_ms: 600,
      provider: 'anthropic',
      model: config.model
    }),
    isConfigured: () => true,
    getProvider: () => 'anthropic'
  }))
}))

vi.mock('../src/providers/google', () => ({
  GoogleAIProvider: vi.fn().mockImplementation((config) => ({
    call: vi.fn().mockResolvedValue({
      content: 'Google response',
      tokens_used: 80,
      latency_ms: 400,
      provider: 'google',
      model: config.model
    }),
    isConfigured: () => true,
    getProvider: () => 'google'
  }))
}))

// Mock shared dependencies
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
      trackEvent: vi.fn(),
      trackMetric: vi.fn(),
      trackError: vi.fn(),
      flush: vi.fn()
    })
  }
})

describe('LLMRunnerService', () => {
  let service: LLMRunnerService
  
  beforeEach(() => {
    vi.clearAllMocks()
    service = new LLMRunnerService()
  })

  describe('constructor', () => {
    it('should initialize service', () => {
      expect(service).toBeDefined()
      expect(service.getName()).toBe('LLMRunner')
      expect(service.getVersion()).toBe('2.0.0')
    })
  })

  describe('configure', () => {
    it('should configure single provider', async () => {
      const config = createTestLLMConfig({
        provider: 'openai',
        api_key: 'sk-test'
      })
      
      await service.configure([config])
      
      const health = await service.getHealth()
      expect(health.details?.providers_configured).toContain('openai')
    })

    it('should configure multiple providers', async () => {
      const configs: LLMProviderConfig[] = [
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' },
        { provider: 'anthropic', api_key: 'ant-test', model: 'claude-3-opus' },
        { provider: 'google', api_key: 'goog-test', model: 'gemini-pro' }
      ]
      
      await service.configure(configs)
      
      const health = await service.getHealth()
      expect(health.details?.providers_configured).toHaveLength(3)
      expect(health.details?.providers_configured).toContain('openai')
      expect(health.details?.providers_configured).toContain('anthropic')
      expect(health.details?.providers_configured).toContain('google')
    })

    it('should skip invalid providers', async () => {
      const configs: LLMProviderConfig[] = [
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' },
        { provider: 'unknown' as any, api_key: 'test', model: 'test' }
      ]
      
      await service.configure(configs)
      
      const health = await service.getHealth()
      expect(health.details?.providers_configured).toHaveLength(1)
      expect(health.details?.providers_configured).toContain('openai')
    })
  })

  describe('execute', () => {
    beforeEach(async () => {
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' },
        { provider: 'anthropic', api_key: 'ant-test', model: 'claude-3-opus' }
      ])
    })

    it('should execute prompt with specified provider', async () => {
      const variant = createTestPromptVariant({
        model: 'gpt-4',
        optimized_prompt: 'Test prompt'
      })
      
      const result = await service.execute(variant)
      
      expect(result.content).toBe('OpenAI response')
      expect(result.provider).toBe('openai')
      expect(result.model).toBe('gpt-4')
      expect(result.tokens_used).toBe(100)
    })

    it('should handle provider override in metadata', async () => {
      const variant = createTestPromptVariant({
        model: 'gpt-4',
        metadata: {
          provider_override: 'anthropic'
        }
      })
      
      const result = await service.execute(variant)
      
      expect(result.content).toBe('Anthropic response')
      expect(result.provider).toBe('anthropic')
    })

    it('should handle missing provider', async () => {
      const variant = createTestPromptVariant({
        model: 'unknown-model'
      })
      
      const result = await service.execute(variant)
      
      expect(result.error).toContain('No provider configured')
      expect(result.content).toBe('')
    })

    it('should handle streaming', async () => {
      const variant = createTestPromptVariant()
      const tokens: string[] = []
      
      await service.execute(variant, true, {
        onToken: (token) => tokens.push(token)
      })
      
      // Provider mock doesn't actually stream, but callback should work
      expect(tokens).toEqual([])
    })
  })

  describe('executeSelfConsistency', () => {
    beforeEach(async () => {
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' }
      ])
    })

    it('should execute self-consistency check', async () => {
      const variant = createTestPromptVariant({
        technique: 'self_consistency',
        metadata: {
          num_samples: 3
        }
      })
      
      const result = await service.executeSelfConsistency(variant)
      
      expect(result.final_answer).toBe('OpenAI response')
      expect(result.total_samples).toBeGreaterThanOrEqual(3)
      expect(result.confidence).toBeGreaterThan(0)
    })

    it('should use default samples if not specified', async () => {
      const variant = createTestPromptVariant({
        technique: 'self_consistency'
      })
      
      const result = await service.executeSelfConsistency(variant)
      
      expect(result.total_samples).toBe(5) // Default
      expect(result.final_answer).toBe('OpenAI response')
    })

    it('should handle self-consistency errors', async () => {
      // No providers configured
      const newService = new LLMRunnerService()
      const variant = createTestPromptVariant()
      
      const result = await newService.executeSelfConsistency(variant)
      
      expect(result.final_answer).toBe('')
      expect(result.confidence).toBe(0)
      expect(result.error).toContain('No provider found')
    })
  })

  describe('handleRequest', () => {
    beforeEach(async () => {
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' }
      ])
    })

    it('should handle execute action', async () => {
      const request = createTestServiceRequest({
        action: 'execute',
        variant: createTestPromptVariant()
      })
      
      const response = await service.handleRequest(request as any)
      
      expect(response.success).toBe(true)
      expect(response.data?.content).toBe('OpenAI response')
    })

    it('should handle execute_stream action', async () => {
      const request = createTestServiceRequest({
        action: 'execute_stream',
        variant: createTestPromptVariant()
      })
      
      const response = await service.handleRequest(request as any)
      
      expect(response.success).toBe(true)
      expect(response.data?.content).toBe('OpenAI response')
    })

    it('should handle self_consistency action', async () => {
      const request = createTestServiceRequest({
        action: 'self_consistency',
        variant: createTestPromptVariant()
      })
      
      const response = await service.handleRequest(request as any)
      
      expect(response.success).toBe(true)
      expect(response.data?.final_answer).toBe('OpenAI response')
    })

    it('should handle configure action', async () => {
      const request = createTestServiceRequest({
        action: 'configure',
        providers: [
          { provider: 'anthropic', api_key: 'ant-test', model: 'claude-3' }
        ]
      })
      
      const response = await service.handleRequest(request as any)
      
      expect(response.success).toBe(true)
      expect(response.data?.configured).toContain('anthropic')
    })

    it('should handle invalid action', async () => {
      const request = createTestServiceRequest({
        action: 'invalid_action'
      })
      
      const response = await service.handleRequest(request as any)
      
      expect(response.success).toBe(false)
      expect(response.error?.code).toBe('E003')
    })

    it('should handle missing data', async () => {
      const request = createTestServiceRequest({
        action: 'execute'
        // Missing variant
      })
      
      const response = await service.handleRequest(request as any)
      
      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })
  })

  describe('getHealth', () => {
    it('should report healthy status', async () => {
      const health = await service.getHealth()
      
      expect(health.healthy).toBe(true)
      expect(health.service).toBe('LLMRunner')
      expect(health.version).toBe('2.0.0')
      expect(health.uptime).toBeGreaterThan(0)
    })

    it('should include provider details', async () => {
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' },
        { provider: 'anthropic', api_key: 'ant-test', model: 'claude-3' }
      ])
      
      const health = await service.getHealth()
      
      expect(health.details?.providers_configured).toHaveLength(2)
      expect(health.details?.total_requests).toBe(0)
      expect(health.details?.total_tokens).toBe(0)
    })

    it('should track request metrics', async () => {
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' }
      ])
      
      // Execute some requests
      await service.execute(createTestPromptVariant())
      await service.execute(createTestPromptVariant())
      
      const health = await service.getHealth()
      
      expect(health.details?.total_requests).toBe(2)
      expect(health.details?.total_tokens).toBe(200) // 2 * 100
      expect(health.details?.average_latency_ms).toBe(500)
    })
  })

  describe('provider selection', () => {
    beforeEach(async () => {
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' },
        { provider: 'anthropic', api_key: 'ant-test', model: 'claude-3-opus' },
        { provider: 'google', api_key: 'goog-test', model: 'gemini-pro' }
      ])
    })

    it('should select provider by model prefix', async () => {
      const testCases = [
        { model: 'gpt-4', expectedProvider: 'openai' },
        { model: 'gpt-3.5-turbo', expectedProvider: 'openai' },
        { model: 'claude-3-opus', expectedProvider: 'anthropic' },
        { model: 'claude-3-sonnet', expectedProvider: 'anthropic' },
        { model: 'gemini-pro', expectedProvider: 'google' },
        { model: 'gemini-1.5-flash', expectedProvider: 'google' }
      ]
      
      for (const { model, expectedProvider } of testCases) {
        const variant = createTestPromptVariant({ model })
        const result = await service.execute(variant)
        
        expect(result.provider).toBe(expectedProvider)
      }
    })

    it('should fallback to first available provider', async () => {
      const variant = createTestPromptVariant({
        model: 'unknown-model'
      })
      
      const result = await service.execute(variant)
      
      // Should use first configured provider
      expect(result.provider).toBe('openai')
    })
  })

  describe('error handling', () => {
    it('should handle provider errors gracefully', async () => {
      const { OpenAIProvider } = await import('../src/providers/openai')
      const mockProvider = vi.mocked(OpenAIProvider)
      
      mockProvider.mockImplementationOnce((config) => ({
        call: vi.fn().mockRejectedValue(new Error('API Error')),
        isConfigured: () => true,
        getProvider: () => 'openai'
      } as any))
      
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' }
      ])
      
      const variant = createTestPromptVariant()
      const result = await service.execute(variant)
      
      expect(result.error).toBe('API Error')
      expect(result.content).toBe('')
    })

    it('should handle configuration errors', async () => {
      const response = await service.handleRequest({
        request_id: 'test',
        timestamp: Date.now(),
        source_service: 'test',
        data: {
          action: 'configure',
          providers: null // Invalid
        }
      } as any)
      
      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
    })
  })

  describe('performance', () => {
    it('should handle concurrent requests', async () => {
      await service.configure([
        { provider: 'openai', api_key: 'sk-test', model: 'gpt-4' }
      ])
      
      const variants = Array(10).fill(null).map(() => createTestPromptVariant())
      const promises = variants.map(v => service.execute(v))
      
      const results = await Promise.all(promises)
      
      expect(results).toHaveLength(10)
      results.forEach(result => {
        expect(result.content).toBe('OpenAI response')
      })
    })
  })
})