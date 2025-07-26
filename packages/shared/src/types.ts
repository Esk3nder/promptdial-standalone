/**
 * PromptDial 3.0 - Shared Types and Contracts
 *
 * Core data models shared across all microservices
 */

// ============= Core Domain Models =============

export interface PromptVariant {
  id: string
  technique: string
  prompt: string // The optimized prompt text
  temperature: number
  est_tokens: number
  cost_usd: number
  model?: string
  model_params?: {
    temperature?: number
    max_tokens?: number
    top_p?: number
  }
  estimated_cost?: number
  estimated_latency_ms?: number
  metadata?: Record<string, any>
}

export interface OptimizationRequest {
  prompt: string
  task_type?: TaskType
  domain?: Domain
  constraints?: {
    max_variants?: number
    cost_cap_usd?: number
    latency_cap_ms?: number
    security_level?: SecurityLevel
  }
  context?: {
    examples?: string[]
    reference_output?: string
    style_guide?: string
  }
  preferences?: Record<string, any>
}

export interface OptimizationResponse {
  trace_id: string
  original_prompt: string
  task_classification: TaskClassification
  variants: PromptVariant[]
  recommended_variant: PromptVariant
  evaluation_results: EvaluationResult[]
  optimization_metadata: {
    total_variants_generated: number
    pareto_frontier_size: number
    techniques_used: string[]
    safety_modifications: boolean
  }
}

// ============= Classification Types =============

export type TaskType =
  | 'math_reasoning'
  | 'code_generation'
  | 'creative_writing'
  | 'data_analysis'
  | 'general_qa'
  | 'summarization'
  | 'translation'
  | 'classification'
  | 'general'

export type Domain = 'academic' | 'business' | 'technical' | 'creative' | 'general'

export type SecurityLevel = 'standard' | 'high' | 'strict'

export interface TaskClassification {
  task_type: TaskType
  domain: Domain
  complexity: number // 0-1 scale
  safety_risk: number // 0-1 scale
  needs_retrieval: boolean
  suggested_techniques: string[]
}

// ============= Technique Types =============

export interface TechniqueStrategy {
  name: string
  description: string
  best_for: TaskType[]
  needs_retrieval: boolean

  generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints,
  ): Promise<PromptVariant[]>
}

export interface BudgetConstraints {
  max_cost_usd: number
  max_latency_ms: number
  max_tokens: number
  remaining_cost_usd: number
  remaining_time_ms: number
}

// ============= Evaluation Types =============

export interface EvaluationResult {
  variant_id: string
  scores: {
    g_eval: number
    chat_eval: number
    self_consistency: number
    role_debate?: number
  }
  final_score: number
  confidence_interval: [number, number]
  calibration_error?: number
}

// ============= Security Types =============

// ============= Telemetry Types =============

export interface TelemetryEvent {
  trace_id: string
  variant_id: string
  ts_utc: string
  event_type:
    | 'optimization_start'
    | 'variant_generated'
    | 'evaluation_complete'
    | 'optimization_end'
  task_type: TaskType
  provider?: string
  total_tokens?: number
  latency_ms?: number
  cost_usd?: number
  score?: number
  safety_verdict?: string
  error?: string
}

export interface PerformanceMetrics {
  p50_latency_ms: number
  p95_latency_ms: number
  p99_latency_ms: number
  success_rate: number
  error_rate: number
  avg_cost_per_request: number
}

// ============= Service Communication =============

export interface ServiceRequest<T = any> {
  trace_id: string
  timestamp: Date
  service: string
  method: string
  payload: T
}

export interface ServiceResponse<T = any> {
  trace_id: string
  timestamp: Date
  service: string
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
    retryable: boolean
  }
}

// ============= Configuration Types =============

export interface LLMProviderConfig {
  provider: 'openai' | 'anthropic' | 'google' | 'cohere'
  api_key: string
  base_url?: string
  default_model?: string
  model?: string
  rate_limit?: {
    requests_per_minute: number
    tokens_per_minute: number
  }
}

// ============= Vector Store Types =============

export interface Document {
  id: string
  content: string
  metadata: Record<string, any>
  embedding?: number[]
}

export interface RetrievalQuery {
  query: string
  top_k: number
  filters?: Record<string, any>
  include_metadata?: boolean
}

export interface RetrievalResult {
  documents: Array<{
    id: string
    content: string
    score: number
    metadata?: Record<string, any>
  }>
  total_results: number
  query_time_ms: number
}
