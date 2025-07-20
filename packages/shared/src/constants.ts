/**
 * PromptDial 2.0 - Shared Constants
 */

// ============= Service Names =============
export const SERVICES = {
  API_GATEWAY: 'api-gateway',
  CLASSIFIER: 'classifier',
  TECHNIQUE_ENGINE: 'technique-engine',
  RETRIEVAL_HUB: 'retrieval-hub',
  SAFETY_GUARD: 'safety-guard',
  LLM_RUNNER: 'llm-runner',
  EVALUATOR: 'evaluator',
  OPTIMIZER: 'optimizer',
  TELEMETRY: 'telemetry'
} as const

// ============= Technique Names =============
export const TECHNIQUES = {
  FEW_SHOT_COT: 'FewShot_CoT',
  SELF_CONSISTENCY: 'SelfConsistency',
  REACT: 'ReAct',
  TREE_OF_THOUGHT: 'TreeOfThought',
  IRCOT: 'IRCoT',
  DSPY_APE: 'DSPy_APE',
  DSPY_GRIPS: 'DSPy_GrIPS',
  AUTO_DICOT: 'AutoDiCoT',
  UNIVERSAL_SELF_PROMPT: 'USP'
} as const

// ============= Evaluation Methods =============
export const EVALUATORS = {
  G_EVAL: 'g_eval',
  CHAT_EVAL: 'chat_eval',
  SELF_CONSISTENCY: 'self_consistency',
  ROLE_DEBATE: 'role_debate',
  AUTO_COT: 'auto_cot'
} as const

// ============= Security Patterns =============
export const FORBIDDEN_PREFIXES = [
  'system:',
  '>>',
  '<|',
  '[[',
  '{{',
  'ignore previous',
  'disregard above',
  'forget all'
] as const

export const JAILBREAK_PATTERNS = [
  /\b(ignore|disregard|forget)\s+(all\s+)?(previous|above|prior)\s+instructions?\b/i,
  /\bsystem\s*:\s*/i,
  /\b(act|pretend|imagine)\s+you('re|r|re| are)\s+(.+)\s+instead\b/i,
  /\bDAN\s+mode\b/i,
  /\bjailbreak\b/i,
  /\b(bypass|override|disable)\s+safety\b/i
]

// ============= Performance Thresholds =============
export const PERFORMANCE_LIMITS = {
  MAX_LATENCY_MS: 10000,
  MAX_TOKENS: 8192,
  MAX_COST_USD: 5.0,
  MIN_SCORE: 0.0,
  MAX_SCORE: 1.0,
  DRIFT_THRESHOLD: 0.05,
  CALIBRATION_TARGET: 0.8
}

// ============= HTTP Status Codes =============
export const STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503
} as const

// ============= Error Codes =============
export const ERROR_CODES = {
  // Client errors
  INVALID_PROMPT: 'INVALID_PROMPT',
  BUDGET_EXCEEDED: 'BUDGET_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_PARAMETERS: 'INVALID_PARAMETERS',
  
  // Security errors
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  PROMPT_INJECTION: 'PROMPT_INJECTION',
  CONTENT_POLICY: 'CONTENT_POLICY',
  SAFETY_CHECK_FAILED: 'SAFETY_CHECK_FAILED',
  
  // System errors
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  TIMEOUT: 'TIMEOUT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  
  // Evaluation errors
  EVALUATION_FAILED: 'EVALUATION_FAILED',
  CALIBRATION_DRIFT: 'CALIBRATION_DRIFT',
  
  // Resource errors
  INSUFFICIENT_QUOTA: 'INSUFFICIENT_QUOTA',
  VECTOR_STORE_ERROR: 'VECTOR_STORE_ERROR'
} as const

// ============= Default Configurations =============
export const DEFAULTS = {
  MAX_VARIANTS: 6,
  COST_CAP_USD: 0.20,
  LATENCY_CAP_MS: 6000,
  SECURITY_LEVEL: 'strict',
  TEMPERATURE: 0.7,
  TOP_K_RETRIEVAL: 5,
  CONFIDENCE_LEVEL: 0.95,
  MIN_EVALUATOR_AGREEMENT: 0.7
} as const

// ============= Monitoring Metrics =============
export const METRICS = {
  // Latency metrics
  REQUEST_DURATION: 'promptdial_request_duration_ms',
  TECHNIQUE_DURATION: 'promptdial_technique_duration_ms',
  EVALUATION_DURATION: 'promptdial_evaluation_duration_ms',
  
  // Count metrics
  REQUEST_COUNT: 'promptdial_request_total',
  ERROR_COUNT: 'promptdial_error_total',
  VARIANT_COUNT: 'promptdial_variant_generated_total',
  
  // Cost metrics
  TOKEN_USAGE: 'promptdial_token_usage_total',
  COST_USD: 'promptdial_cost_usd_total',
  
  // Quality metrics
  EVALUATION_SCORE: 'promptdial_evaluation_score',
  CALIBRATION_ERROR: 'promptdial_calibration_error',
  
  // Security metrics
  SECURITY_VIOLATIONS: 'promptdial_security_violations_total',
  JAILBREAK_ATTEMPTS: 'promptdial_jailbreak_attempts_total'
} as const