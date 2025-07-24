/**
 * PromptDial 2.0 - Shared Constants
 */

// ============= Service Names =============

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

// ============= Performance Thresholds =============

// ============= HTTP Status Codes =============

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