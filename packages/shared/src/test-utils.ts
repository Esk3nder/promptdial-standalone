/**
 * Shared test utilities for all microservices
 */

import {
  OptimizationRequest,
  OptimizationResponse,
  PromptVariant,
  TaskClassification,
  EvaluationResult,
  ServiceRequest,
  ServiceResponse,
  LLMProviderConfig,
  BudgetConstraints,
  TechniqueStrategy,
  Document,
  RetrievalQuery,
  RetrievalResult,
} from './types'

// Test data generators
export function createTestOptimizationRequest(
  overrides?: Partial<OptimizationRequest>,
): OptimizationRequest {
  return {
    prompt: 'Test prompt for optimization',
    task_type: 'general',
    domain: 'general',
    constraints: {
      max_variants: 3,
      cost_cap_usd: 10,
      latency_cap_ms: 5000,
      security_level: 'standard',
    },
    context: {
      examples: [],
      reference_output: undefined,
      style_guide: undefined,
    },
    preferences: {},
    ...overrides,
  }
}

export function createTestPromptVariant(overrides?: Partial<PromptVariant>): PromptVariant {
  return {
    id: 'variant-' + Math.random().toString(36).substr(2, 9),
    technique: 'chain_of_thought',
    prompt: "Let's think step by step. Test prompt",
    optimized_prompt: "Let's think step by step. Test prompt",
    temperature: 0.7,
    est_tokens: 100,
    cost_usd: 0.002,
    model: 'gpt-4',
    model_params: {
      temperature: 0.7,
      max_tokens: 1000,
      top_p: 0.95,
    },
    estimated_cost: 0.05,
    estimated_latency_ms: 2000,
    metadata: {},
    ...overrides,
  }
}

export function createTestTaskClassification(
  overrides?: Partial<TaskClassification>,
): TaskClassification {
  return {
    task_type: 'general',
    domain: 'general',
    complexity: 0.5,
    safety_risk: 0.1,
    needs_retrieval: false,
    suggested_techniques: ['chain_of_thought', 'few_shot'],
    ...overrides,
  }
}

export function createTestServiceRequest<T = any>(data: T): ServiceRequest<T> {
  return {
    trace_id: 'trace-' + Date.now(),
    timestamp: new Date(),
    service: 'test-service',
    method: 'test-method',
    payload: data,
  }
}

export function createTestServiceResponse<T = any>(
  data?: T,
  error?: {
    code: string
    message: string
    details?: any
    retryable: boolean
  },
): ServiceResponse<T> {
  return {
    trace_id: 'trace-' + Date.now(),
    timestamp: new Date(),
    service: 'test-service',
    success: !error,
    data,
    error,
  }
}

export function createTestEvaluationResult(
  overrides?: Partial<EvaluationResult>,
): EvaluationResult {
  return {
    variant_id: 'variant-test',
    scores: {
      g_eval: 0.85,
      chat_eval: 0.82,
      self_consistency: 0.88,
    },
    final_score: 0.85,
    confidence_interval: [0.8, 0.9],
    calibration_error: 0.02,
    ...overrides,
  }
}

export function createTestLLMConfig(overrides?: Partial<LLMProviderConfig>): LLMProviderConfig {
  return {
    provider: 'openai',
    api_key: 'test-api-key',
    model: 'gpt-4',
    default_model: 'gpt-4',
    rate_limit: {
      requests_per_minute: 60,
      tokens_per_minute: 100000,
    },
    ...overrides,
  }
}

export function createTestBudgetConstraints(
  overrides?: Partial<BudgetConstraints>,
): BudgetConstraints {
  return {
    max_cost_usd: 1.0,
    max_latency_ms: 10000,
    max_tokens: 2000,
    remaining_cost_usd: 0.5,
    remaining_time_ms: 5000,
    ...overrides,
  }
}

export function createTestTechniqueStrategy(
  overrides?: Partial<TechniqueStrategy>,
): TechniqueStrategy {
  return {
    name: 'test_technique',
    description: 'Test technique for unit testing',
    best_for: ['general_qa'],
    needs_retrieval: false,
    generate: async (base_prompt, _meta, _budget) => {
      return [
        createTestPromptVariant({
          id: 'test_technique_0',
          technique: 'test_technique',
          prompt: `Test technique: ${base_prompt}`,
        }),
      ]
    },
    ...overrides,
  }
}

export function createTestOptimizationResponse(
  overrides?: Partial<OptimizationResponse>,
): OptimizationResponse {
  const variants = [
    createTestPromptVariant({ id: 'v1', technique: 'chain_of_thought' }),
    createTestPromptVariant({ id: 'v2', technique: 'few_shot' }),
    createTestPromptVariant({ id: 'v3', technique: 'role_play' }),
  ]

  return {
    trace_id: 'trace-' + Date.now(),
    original_prompt: 'Test prompt for optimization',
    task_classification: createTestTaskClassification(),
    variants,
    recommended_variant: variants[0],
    evaluation_results: [
      createTestEvaluationResult({ variant_id: 'v1' }),
      createTestEvaluationResult({ variant_id: 'v2' }),
      createTestEvaluationResult({ variant_id: 'v3' }),
    ],
    optimization_metadata: {
      total_variants_generated: 3,
      pareto_frontier_size: 3,
      techniques_used: ['chain_of_thought', 'few_shot', 'role_play'],
      safety_modifications: false,
    },
    ...overrides,
  }
}

// Mock factories

export function createTestDocument(overrides?: Partial<Document>): Document {
  return {
    id: 'doc-' + Math.random().toString(36).substr(2, 9),
    content: 'Test document content for retrieval',
    metadata: {
      source: 'test.txt',
      created_at: new Date().toISOString(),
    },
    embedding: Array(384)
      .fill(0)
      .map(() => Math.random()),
    ...overrides,
  }
}

export function createTestRetrievalQuery(overrides?: Partial<RetrievalQuery>): RetrievalQuery {
  return {
    query: 'test retrieval query',
    top_k: 5,
    include_metadata: true,
    filters: {},
    ...overrides,
  }
}

export function createTestRetrievalResult(overrides?: Partial<RetrievalResult>): RetrievalResult {
  const documents = [
    {
      id: 'result-1',
      content: 'First matching document',
      score: 0.95,
      metadata: { source: 'doc1.txt' },
    },
    {
      id: 'result-2',
      content: 'Second matching document',
      score: 0.87,
      metadata: { source: 'doc2.txt' },
    },
  ]

  return {
    documents: documents,
    total_results: documents.length,
    query_time_ms: 50,
    ...overrides,
  }
}

// Test helpers
