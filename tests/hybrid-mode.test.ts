import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PromptDial } from '../packages/core/src/index'
import { ConfigManager } from '../packages/core/src/config'

describe('Hybrid Mode Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Monolithic Mode', () => {
    it('should use internal implementation when mode is monolithic', async () => {
      const promptDial = new PromptDial({
        config: {
          mode: 'monolithic',
          services: {},
          features: {},
          fallbackToMonolithic: false
        }
      })

      const result = await promptDial.optimize({
        prompt: 'What is the capital of France?',
        targetModel: 'gpt-4',
        level: 'basic'
      })

      expect(result.variants.length).toBeGreaterThan(0)
      expect(result.variants[0].optimizedPrompt).toContain('capital')
    })
  })

  describe('Microservices Mode', () => {
    it('should initialize service clients when mode is microservices', () => {
      const promptDial = new PromptDial({
        config: {
          mode: 'microservices',
          services: {
            techniqueEngine: 'http://localhost:3003',
            evaluator: 'http://localhost:3005',
            retrievalHub: 'http://localhost:3004',
            optimizer: 'http://localhost:3007'
          },
          features: {
            useTechniqueEngine: true,
            useEvaluator: true,
            useRetrieval: true,
            useParetoFilter: true
          }
        }
      })

      // Service clients should be initialized
      expect((promptDial as any).techniqueClient).toBeDefined()
      expect((promptDial as any).evaluatorClient).toBeDefined()
      expect((promptDial as any).retrievalClient).toBeDefined()
      expect((promptDial as any).optimizerClient).toBeDefined()
    })

    it('should fall back to monolithic when services are unavailable', async () => {
      const promptDial = new PromptDial({
        config: {
          mode: 'microservices',
          services: {
            techniqueEngine: 'http://localhost:9999' // Non-existent service
          },
          features: {
            useTechniqueEngine: true
          },
          fallbackToMonolithic: true,
          serviceTimeout: 1000, // Short timeout for tests
          maxRetries: 0 // No retries for tests
        }
      })

      // This should not throw, but fall back to monolithic
      const result = await promptDial.optimize({
        prompt: 'Explain quantum computing',
        targetModel: 'gpt-4',
        level: 'advanced'
      })

      expect(result.variants.length).toBeGreaterThan(0)
    })
  })

  describe('Configuration Management', () => {
    it('should load configuration from environment variables', () => {
      process.env.PROMPTDIAL_MODE = 'microservices'
      process.env.TECHNIQUE_ENGINE_URL = 'http://custom-technique:3003'
      
      const config = ConfigManager.getInstance().getConfig()
      
      expect(config.mode).toBe('microservices')
      expect(config.services?.techniqueEngine).toBe('http://custom-technique:3003')
      
      // Clean up
      delete process.env.PROMPTDIAL_MODE
      delete process.env.TECHNIQUE_ENGINE_URL
    })

    it('should respect feature flags', () => {
      const promptDial = new PromptDial({
        config: {
          mode: 'microservices',
          services: {
            techniqueEngine: 'http://localhost:3003',
            evaluator: 'http://localhost:3005'
          },
          features: {
            useTechniqueEngine: true,
            useEvaluator: false // Disabled
          }
        }
      })

      // Only technique client should be initialized
      expect((promptDial as any).techniqueClient).toBeDefined()
      expect((promptDial as any).evaluatorClient).toBeUndefined()
    })
  })

  describe('Progressive Enhancement', () => {
    it('should enhance prompts with retrieval when needed', async () => {
      const promptDial = new PromptDial({
        config: {
          mode: 'monolithic' // Start simple
        }
      })

      const result = await promptDial.optimize({
        prompt: 'What are the main components of a nuclear reactor?',
        targetModel: 'gpt-4',
        level: 'expert'
      })

      // Should still work without services
      expect(result.variants.length).toBeGreaterThan(0)
      expect(result.summary.totalVariants).toBe(result.variants.length)
    })
  })
})