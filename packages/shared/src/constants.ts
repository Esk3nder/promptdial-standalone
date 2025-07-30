/**
 * PromptDial 3.0 - Shared Constants
 */

// ============= Service Names =============

// ============= Technique Names =============
export const TECHNIQUES = {
  FEW_SHOT_COT: 'FewShot_CoT',
  SELF_CONSISTENCY: 'SelfConsistency',
  REACT: 'ReAct',
  TREE_OF_THOUGHT: 'TreeOfThought',
  CHAIN_OF_THOUGHT: 'ChainOfThought',
  IR_COT: 'IRCoT',
  DSPY_APE: 'DSPy_APE',
  DSPY_GRIPS: 'DSPy_GrIPS',
  AUTO_DICOT: 'AutoDiCoT',
  UNIVERSAL_SELF_PROMPT: 'USP',
} as const

// ============= Evaluation Methods =============
export const EVALUATORS = {
  G_EVAL: 'g_eval',
  CHAT_EVAL: 'chat_eval',
  SELF_CONSISTENCY: 'self_consistency',
  ROLE_DEBATE: 'role_debate',
  AUTO_COT: 'auto_cot',
} as const

// ============= Optimization Levels =============
export const OPTIMIZATION_LEVELS = {
  BASIC: 'basic',
  ADVANCED: 'advanced',
  EXPERT: 'expert',
} as const

// ============= Security Patterns =============
export const SECURITY_PATTERNS = {
  PROMPT_INJECTION: 'PromptInjection',
  JAILBREAK: 'Jailbreak',
  DATA_LEAKAGE: 'DataLeakage',
  HARMFUL_CONTENT: 'HarmfulContent',
  PII_EXPOSURE: 'PIIExposure',
} as const

// ============= Performance Thresholds =============
export const PERFORMANCE_LIMITS = {
  MAX_PROMPT_LENGTH: 10000,
  MAX_OUTPUT_LENGTH: 4000,
  MAX_CONCURRENT_REQUESTS: 10,
  MAX_VARIANTS_PER_REQUEST: 10,
  CACHE_TTL_SECONDS: 3600,
} as const

// ============= HTTP Status Codes =============
export const STATUS_CODES = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TIMEOUT: 408,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const

// ============= Error Codes =============
export const ERROR_CODES = {
  // Client errors
  INVALID_PROMPT: 'E001',
  INVALID_MODEL: 'E002',
  BUDGET_EXCEEDED: 'E003',
  INSUFFICIENT_BUDGET: 'E004',
  RATE_LIMIT_EXCEEDED: 'E005',
  INVALID_PARAMETERS: 'E006',

  // Security errors
  SECURITY_VIOLATION: 'E007',
  SAFETY_VIOLATION: 'E008',
  PROMPT_INJECTION: 'E009',
  CONTENT_POLICY: 'E010',
  SAFETY_CHECK_FAILED: 'E011',

  // System errors
  SERVICE_UNAVAILABLE: 'E012',
  TIMEOUT: 'E013',
  INTERNAL_ERROR: 'E014',
  DEPENDENCY_ERROR: 'E015',
  TECHNIQUE_ENGINE_ERROR: 'E016',
  LLM_RUNNER_ERROR: 'E017',
  EVALUATOR_ERROR: 'E018',
  OPTIMIZATION_FAILED: 'E019',

  // Evaluation errors
  EVALUATION_FAILED: 'E020',
  CALIBRATION_DRIFT: 'E021',

  // Resource errors
  INSUFFICIENT_QUOTA: 'E022',
  MEMORY_LIMIT_EXCEEDED: 'E023',
} as const

// ============= Default Configuration =============
export const DEFAULTS = {
  MAX_VARIANTS: 5,
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
  COST_CAP: 1.0,
  LATENCY_CAP_MS: 10000,
  MIN_QUALITY_SCORE: 0.7,
  CONFIDENCE_LEVEL: 0.95,
} as const

// ============= Telemetry Metrics =============
export const METRICS = {
  // Duration metrics
  REQUEST_DURATION: 'promptdial_request_duration_ms',
  OPTIMIZATION_DURATION: 'promptdial_optimization_duration_ms',
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
  JAILBREAK_ATTEMPTS: 'promptdial_jailbreak_attempts_total',
} as const

// ============= Service Ports =============
export const PORTS = {
  API_GATEWAY: 3000,
  CLASSIFIER: 3001,
  TELEMETRY: 3002,
  TECHNIQUE_ENGINE: 3003,
  RETRIEVAL_HUB: 3004,
  EVALUATOR: 3005,
  SAFETY_GUARD: 3006,
  OPTIMIZER: 3007,
  STRATEGY_PLANNER: 3008,
  LLM_RUNNER_OPENAI: 4001,
  LLM_RUNNER_ANTHROPIC: 4002,
  LLM_RUNNER_GOOGLE: 4003,
  LLM_RUNNER_BASE: 4000,
} as const