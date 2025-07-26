/**
 * PromptDial 3.0 - Service Registry
 */

export interface ServiceConfig {
  name: string
  url: string
  healthEndpoint: string
  timeout: number
  retries: number
}

export const SERVICES: Record<string, ServiceConfig> = {
  classifier: {
    name: 'Task Classifier',
    url: process.env.CLASSIFIER_URL || 'http://localhost:3001',
    healthEndpoint: '/health',
    timeout: 5000,
    retries: 2,
  },
  telemetry: {
    name: 'Telemetry',
    url: process.env.TELEMETRY_URL || 'http://localhost:3002',
    healthEndpoint: '/health',
    timeout: 2000,
    retries: 1,
  },
  technique: {
    name: 'Technique Engine',
    url: process.env.TECHNIQUE_URL || 'http://localhost:3003',
    healthEndpoint: '/health',
    timeout: 5000,
    retries: 2,
  },
  retrieval: {
    name: 'Retrieval Hub',
    url: process.env.RETRIEVAL_URL || 'http://localhost:3004',
    healthEndpoint: '/health',
    timeout: 10000,
    retries: 2,
  },
  evaluator: {
    name: 'Evaluator',
    url: process.env.EVALUATOR_URL || 'http://localhost:3005',
    healthEndpoint: '/health',
    timeout: 30000,
    retries: 1,
  },
  safety: {
    name: 'Safety Guard',
    url: process.env.SAFETY_URL || 'http://localhost:3006',
    healthEndpoint: '/health',
    timeout: 5000,
    retries: 2,
  },
  optimizer: {
    name: 'Optimizer',
    url: process.env.OPTIMIZER_URL || 'http://localhost:3007',
    healthEndpoint: '/health',
    timeout: 10000,
    retries: 2,
  },
  strategyPlanner: {
    name: 'Strategy Planner',
    url: process.env.STRATEGY_PLANNER_URL || 'http://localhost:3008',
    healthEndpoint: '/health',
    timeout: 5000,
    retries: 2,
  },
}

// LLM Runner is configured separately as it may have multiple instances
export const LLM_RUNNER_CONFIG = {
  openai: process.env.OPENAI_RUNNER_URL || 'http://localhost:4001',
  anthropic: process.env.ANTHROPIC_RUNNER_URL || 'http://localhost:4002',
  google: process.env.GOOGLE_RUNNER_URL || 'http://localhost:4003',
}
