import { describe, it, expect } from 'vitest'
import type {
  OptimizationRequest,
  PromptVariant,
  TaskClassification,
  EvaluationResult,
  ServiceRequest,
  ServiceResponse,
  TelemetryEvent,
  BudgetConstraints,
  LLMProviderConfig
} from '../src/types'

// Type guard tests
describe('Types', () => {
  describe('Type structure validation', () => {
    it('should create valid OptimizationRequest', () => {
      const request: OptimizationRequest = {
        id: 'test-id',
        prompt: 'Test prompt',
        target_models: ['gpt-4'],
        optimization_level: 'basic',
        budget_constraints: {
          max_cost_per_variant: 0.1,
          max_total_cost: 1.0,
          max_tokens: 1000,
          max_latency_ms: 5000
        }
      }
      
      expect(request).toBeDefined()
      expect(request.id).toBe('test-id')
    })

    it('should create valid PromptVariant', () => {
      const variant: PromptVariant = {
        id: 'variant-id',
        original_prompt: 'Original',
        optimized_prompt: 'Optimized',
        technique: 'few_shot_cot',
        model: 'gpt-4',
        estimated_cost: 0.05,
        estimated_tokens: 500,
        estimated_latency_ms: 2000,
        quality_score: 0.85,
        metadata: {}
      }
      
      expect(variant).toBeDefined()
      expect(variant.technique).toBe('few_shot_cot')
    })

    it('should create valid TaskClassification', () => {
      const classification: TaskClassification = {
        task_type: 'code_generation',
        domain: 'software',
        complexity: 'high',
        requires_reasoning: true,
        requires_creativity: false,
        requires_factual_knowledge: true,
        confidence_scores: {
          task_type: 0.9,
          domain: 0.85,
          complexity: 0.8
        },
        detected_languages: ['en'],
        recommended_techniques: ['few_shot_cot']
      }
      
      expect(classification).toBeDefined()
      expect(classification.task_type).toBe('code_generation')
    })

    it('should create valid EvaluationResult', () => {
      const result: EvaluationResult = {
        variant_id: 'variant-id',
        evaluator: 'g_eval',
        score: 0.85,
        details: {
          coherence: 0.9,
          relevance: 0.85
        },
        confidence: 0.9,
        timestamp: Date.now()
      }
      
      expect(result).toBeDefined()
      expect(result.evaluator).toBe('g_eval')
    })

    it('should create valid ServiceRequest', () => {
      const request: ServiceRequest<{ data: string }> = {
        trace_id: 'trace-123',
        timestamp: new Date(),
        service: 'api-gateway',
        method: 'optimize',
        payload: { data: 'test' }
      }
      
      expect(request).toBeDefined()
      expect(request.payload.data).toBe('test')
    })

    it('should create valid ServiceResponse', () => {
      const response: ServiceResponse<{ result: number }> = {
        trace_id: 'trace-123',
        timestamp: new Date(),
        service: 'classifier',
        success: true,
        data: { result: 42 }
      }
      
      expect(response).toBeDefined()
      expect(response.success).toBe(true)
      expect(response.data?.result).toBe(42)
    })

    it('should create valid error ServiceResponse', () => {
      const response: ServiceResponse<any> = {
        trace_id: 'trace-123',
        timestamp: new Date(),
        service: 'service',
        success: false,
        error: {
          code: 'E001',
          message: 'Error occurred',
          retryable: true
        }
      }
      
      expect(response).toBeDefined()
      expect(response.success).toBe(false)
      expect(response.error?.code).toBe('E001')
    })

    it('should create valid TelemetryEvent', () => {
      const event: TelemetryEvent = {
        trace_id: 'trace-123',
        variant_id: 'variant-456',
        ts_utc: new Date().toISOString(),
        event_type: 'optimization_started',
        task_type: 'general_qa'
      }
      
      expect(event).toBeDefined()
      expect(event.event_type).toBe('optimization_started')
    })

    it('should create valid BudgetConstraints', () => {
      const budget: BudgetConstraints = {
        max_cost_per_variant: 0.1,
        max_total_cost: 1.0,
        max_tokens: 1000,
        max_latency_ms: 5000
      }
      
      expect(budget).toBeDefined()
      expect(budget.max_cost_per_variant).toBe(0.1)
    })

    it('should create valid LLMProviderConfig', () => {
      const config: LLMProviderConfig = {
        provider: 'openai',
        api_key: 'sk-test',
        model: 'gpt-4',
        temperature: 0.7,
        max_tokens: 1000,
        top_p: 0.9,
        frequency_penalty: 0.1,
        presence_penalty: 0.1
      }
      
      expect(config).toBeDefined()
      expect(config.provider).toBe('openai')
      expect(config.temperature).toBe(0.7)
    })
  })

  describe('Optional fields', () => {
    it('should handle optional fields in OptimizationRequest', () => {
      const minimal: OptimizationRequest = {
        id: 'id',
        prompt: 'prompt',
        target_models: ['model'],
        optimization_level: 'basic'
      }
      
      expect(minimal.budget_constraints).toBeUndefined()
      expect(minimal.task_type).toBeUndefined()
      expect(minimal.custom_techniques).toBeUndefined()
    })

    it('should handle optional fields in PromptVariant', () => {
      const variant: PromptVariant = {
        id: 'id',
        original_prompt: 'original',
        optimized_prompt: 'optimized',
        technique: 'cot',
        model: 'gpt-4',
        estimated_cost: 0.01,
        estimated_tokens: 100,
        estimated_latency_ms: 1000
      }
      
      expect(variant.quality_score).toBeUndefined()
      expect(variant.evaluation_results).toBeUndefined()
      expect(variant.safety_score).toBeUndefined()
    })

    it('should handle optional fields in EvaluationResult', () => {
      const result: EvaluationResult = {
        variant_id: 'id',
        evaluator: 'g_eval',
        score: 0.8,
        timestamp: Date.now()
      }
      
      expect(result.details).toBeUndefined()
      expect(result.confidence).toBeUndefined()
      expect(result.calibration_offset).toBeUndefined()
    })
  })

  describe('Union types', () => {
    it('should handle task_type union', () => {
      const validTypes = [
        'general_qa',
        'code_generation',
        'math_reasoning',
        'creative_writing',
        'summarization',
        'translation',
        'data_analysis'
      ]
      
      validTypes.forEach(type => {
        const classification: TaskClassification = {
          task_type: type as any,
          domain: 'general',
          complexity: 'medium',
          requires_reasoning: false,
          requires_creativity: false,
          requires_factual_knowledge: false,
          confidence_scores: {
            task_type: 0.9,
            domain: 0.9,
            complexity: 0.9
          },
          detected_languages: ['en'],
          recommended_techniques: []
        }
        
        expect(classification.task_type).toBe(type)
      })
    })

    it('should handle complexity levels', () => {
      const levels = ['low', 'medium', 'high']
      
      levels.forEach(level => {
        const classification: TaskClassification = {
          task_type: 'general_qa',
          domain: 'general',
          complexity: level as 'low' | 'medium' | 'high',
          requires_reasoning: false,
          requires_creativity: false,
          requires_factual_knowledge: false,
          confidence_scores: {
            task_type: 0.9,
            domain: 0.9,
            complexity: 0.9
          },
          detected_languages: ['en'],
          recommended_techniques: []
        }
        
        expect(classification.complexity).toBe(level)
      })
    })

    it('should handle provider types', () => {
      const providers = ['openai', 'anthropic', 'google', 'cohere']
      
      providers.forEach(provider => {
        const config: LLMProviderConfig = {
          provider: provider as any,
          api_key: 'key',
          model: 'model'
        }
        
        expect(config.provider).toBe(provider)
      })
    })
  })
})