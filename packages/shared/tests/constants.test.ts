import { describe, it, expect } from 'vitest'
import {
  TECHNIQUES,
  OPTIMIZATION_LEVELS,
  ERROR_CODES,
  STATUS_CODES,
  DEFAULTS,
  EVALUATORS,
  SECURITY_PATTERNS,
  PERFORMANCE_LIMITS,
  PORTS,
} from '../src/constants'

describe('Constants', () => {
  describe('TECHNIQUES', () => {
    it('should define all optimization techniques', () => {
      expect(TECHNIQUES).toHaveProperty('FEW_SHOT_COT')
      expect(TECHNIQUES).toHaveProperty('CHAIN_OF_THOUGHT')
      expect(TECHNIQUES).toHaveProperty('REACT')
      expect(TECHNIQUES).toHaveProperty('TREE_OF_THOUGHT')
      expect(TECHNIQUES).toHaveProperty('SELF_CONSISTENCY')
      expect(TECHNIQUES).toHaveProperty('IR_COT')
      expect(TECHNIQUES).toHaveProperty('DSPY_APE')

      // Check values are unique
      const values = Object.values(TECHNIQUES)
      expect(new Set(values).size).toBe(values.length)
    })
  })

  describe('OPTIMIZATION_LEVELS', () => {
    it('should define all optimization levels', () => {
      expect(OPTIMIZATION_LEVELS).toHaveProperty('BASIC')
      expect(OPTIMIZATION_LEVELS).toHaveProperty('ADVANCED')
      expect(OPTIMIZATION_LEVELS).toHaveProperty('EXPERT')

      expect(OPTIMIZATION_LEVELS.BASIC).toBe('basic')
      expect(OPTIMIZATION_LEVELS.ADVANCED).toBe('advanced')
      expect(OPTIMIZATION_LEVELS.EXPERT).toBe('expert')
    })
  })

  describe('ERROR_CODES', () => {
    it('should define all error codes', () => {
      const expectedCodes = [
        'INVALID_PROMPT',
        'INVALID_MODEL',
        'INVALID_PARAMETERS',
        'TIMEOUT',
        'SERVICE_UNAVAILABLE',
        'RATE_LIMIT_EXCEEDED',
        'INSUFFICIENT_BUDGET',
        'OPTIMIZATION_FAILED',
        'EVALUATION_FAILED',
        'SAFETY_VIOLATION',
      ]

      expectedCodes.forEach((code) => {
        expect(ERROR_CODES).toHaveProperty(code)
      })

      // Check prefixes
      expect(ERROR_CODES.INVALID_PROMPT).toMatch(/^E\d{3}$/)
    })
  })

  describe('STATUS_CODES', () => {
    it('should define standard HTTP status codes', () => {
      expect(STATUS_CODES.OK).toBe(200)
      expect(STATUS_CODES.BAD_REQUEST).toBe(400)
      expect(STATUS_CODES.UNAUTHORIZED).toBe(401)
      expect(STATUS_CODES.FORBIDDEN).toBe(403)
      expect(STATUS_CODES.NOT_FOUND).toBe(404)
      expect(STATUS_CODES.TIMEOUT).toBe(408)
      expect(STATUS_CODES.UNPROCESSABLE_ENTITY).toBe(422)
      expect(STATUS_CODES.TOO_MANY_REQUESTS).toBe(429)
      expect(STATUS_CODES.INTERNAL_ERROR).toBe(500)
      expect(STATUS_CODES.SERVICE_UNAVAILABLE).toBe(503)
    })
  })

  describe('DEFAULTS', () => {
    it('should define default configuration values', () => {
      expect(DEFAULTS.MAX_VARIANTS).toBe(5)
      expect(DEFAULTS.TIMEOUT_MS).toBe(30000)
      expect(DEFAULTS.MAX_RETRIES).toBe(3)
      expect(DEFAULTS.COST_CAP).toBe(1.0)
      expect(DEFAULTS.LATENCY_CAP_MS).toBe(10000)
      expect(DEFAULTS.MIN_QUALITY_SCORE).toBe(0.7)
      expect(DEFAULTS.CONFIDENCE_LEVEL).toBe(0.95)
    })

    it('should have reasonable default values', () => {
      expect(DEFAULTS.MAX_VARIANTS).toBeGreaterThan(0)
      expect(DEFAULTS.TIMEOUT_MS).toBeGreaterThan(1000)
      expect(DEFAULTS.COST_CAP).toBeGreaterThan(0)
      expect(DEFAULTS.MIN_QUALITY_SCORE).toBeGreaterThan(0)
      expect(DEFAULTS.MIN_QUALITY_SCORE).toBeLessThanOrEqual(1)
      expect(DEFAULTS.CONFIDENCE_LEVEL).toBeGreaterThan(0)
      expect(DEFAULTS.CONFIDENCE_LEVEL).toBeLessThan(1)
    })
  })

  describe('EVALUATORS', () => {
    it('should define all evaluator types', () => {
      expect(EVALUATORS).toHaveProperty('G_EVAL')
      expect(EVALUATORS).toHaveProperty('CHAT_EVAL')
      expect(EVALUATORS).toHaveProperty('ROLE_DEBATE')
      expect(EVALUATORS).toHaveProperty('SELF_CONSISTENCY')

      expect(EVALUATORS.G_EVAL).toBe('g_eval')
      expect(EVALUATORS.CHAT_EVAL).toBe('chat_eval')
      expect(EVALUATORS.ROLE_DEBATE).toBe('role_debate')
      expect(EVALUATORS.SELF_CONSISTENCY).toBe('self_consistency')
    })
  })

  describe('SECURITY_PATTERNS', () => {
    it('should define security pattern categories', () => {
      expect(SECURITY_PATTERNS).toHaveProperty('PROMPT_INJECTION')
      expect(SECURITY_PATTERNS).toHaveProperty('JAILBREAK')
      expect(SECURITY_PATTERNS).toHaveProperty('DATA_LEAKAGE')
      expect(SECURITY_PATTERNS).toHaveProperty('HARMFUL_CONTENT')
      expect(SECURITY_PATTERNS).toHaveProperty('PII_EXPOSURE')

      // Check all values are unique
      const values = Object.values(SECURITY_PATTERNS)
      expect(new Set(values).size).toBe(values.length)
    })
  })

  describe('PERFORMANCE_LIMITS', () => {
    it('should define performance constraints', () => {
      expect(PERFORMANCE_LIMITS.MAX_PROMPT_LENGTH).toBe(10000)
      expect(PERFORMANCE_LIMITS.MAX_OUTPUT_LENGTH).toBe(4000)
      expect(PERFORMANCE_LIMITS.MAX_CONCURRENT_REQUESTS).toBe(10)
      expect(PERFORMANCE_LIMITS.MAX_VARIANTS_PER_REQUEST).toBe(10)
      expect(PERFORMANCE_LIMITS.CACHE_TTL_SECONDS).toBe(3600)
    })

    it('should have reasonable limits', () => {
      expect(PERFORMANCE_LIMITS.MAX_PROMPT_LENGTH).toBeGreaterThan(100)
      expect(PERFORMANCE_LIMITS.MAX_OUTPUT_LENGTH).toBeGreaterThan(100)
      expect(PERFORMANCE_LIMITS.MAX_CONCURRENT_REQUESTS).toBeGreaterThan(0)
      expect(PERFORMANCE_LIMITS.MAX_VARIANTS_PER_REQUEST).toBeGreaterThan(0)
      expect(PERFORMANCE_LIMITS.CACHE_TTL_SECONDS).toBeGreaterThan(0)
    })
  })

  describe('PORTS', () => {
    it('should define unique ports for each service', () => {
      const expectedServices = [
        'API_GATEWAY',
        'CLASSIFIER',
        'TELEMETRY',
        'TECHNIQUE_ENGINE',
        'RETRIEVAL_HUB',
        'EVALUATOR',
        'SAFETY_GUARD',
        'OPTIMIZER',
        'LLM_RUNNER_BASE',
      ]

      expectedServices.forEach((service) => {
        expect(PORTS).toHaveProperty(service)
      })

      // Check all ports are unique (except LLM_RUNNER_BASE which is a base port)
      const ports = Object.entries(PORTS)
        .filter(([key]) => key !== 'LLM_RUNNER_BASE')
        .map(([, port]) => port)

      expect(new Set(ports).size).toBe(ports.length)
    })

    it('should use standard port ranges', () => {
      Object.values(PORTS).forEach((port) => {
        expect(port).toBeGreaterThanOrEqual(3000)
        expect(port).toBeLessThan(5000)
      })
    })
  })
})
