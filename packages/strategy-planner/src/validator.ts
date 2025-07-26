import { z } from 'zod'
import Ajv from 'ajv'
import {
  StrategyPlannerResponse,
  StrategyPlannerResponseSchema,
  Technique,
  TECHNIQUE_ALLOW_LIST,
  ValidationError,
} from './types'

const ajv = new Ajv({ strict: true, allErrors: true })

// JSON Schema for additional validation
const strategyPlannerResponseJsonSchema = {
  type: 'object',
  properties: {
    suggested_techniques: {
      type: 'array',
      items: { type: 'string' },
      maxItems: 3,
      minItems: 0,
    },
    rationale: {
      type: 'string',
      minLength: 10,
      maxLength: 500,
    },
    confidence: {
      type: 'number',
      minimum: 0,
      maximum: 1,
    },
    metadata: {
      type: 'object',
      properties: {
        processingTimeMs: { type: 'number' },
        modelUsed: { type: 'string' },
        failedValidations: {
          type: 'array',
          items: { type: 'string' },
        },
      },
      required: ['processingTimeMs'],
    },
  },
  required: ['suggested_techniques', 'rationale', 'confidence'],
  additionalProperties: false,
}

const validateJsonSchema = ajv.compile(strategyPlannerResponseJsonSchema)

export class Validator {
  private readonly maxValidationTimeMs = 100 // From spec: <100ms

  /**
   * Validates planner response against schema and allow-list
   * Must complete in <100ms per spec
   */
  async validate(response: unknown): Promise<StrategyPlannerResponse> {
    const startTime = Date.now()

    try {
      // Step 1: JSON schema validation
      if (!validateJsonSchema(response)) {
        throw new ValidationError('JSON schema validation failed', {
          errors: validateJsonSchema.errors,
        })
      }

      // Step 2: Zod schema validation (more strict typing)
      const parsed = StrategyPlannerResponseSchema.parse(response)

      // Step 3: Allow-list validation
      this.validateTechniquesAgainstAllowList(parsed.suggested_techniques)

      // Step 4: Business logic validation
      this.validateBusinessRules(parsed)

      // Ensure we're under time limit
      const elapsedMs = Date.now() - startTime
      if (elapsedMs > this.maxValidationTimeMs) {
        console.warn(
          `Validation took ${elapsedMs}ms, exceeding ${this.maxValidationTimeMs}ms limit`,
        )
      }

      return parsed
    } catch (error) {
      // Log validation time even on error
      const elapsedMs = Date.now() - startTime
      console.error(`Validation failed after ${elapsedMs}ms`, error)

      if (error instanceof z.ZodError) {
        throw new ValidationError('Schema validation failed', {
          errors: error.errors,
        })
      }

      throw error
    }
  }

  /**
   * Validates that all suggested techniques are in the allow-list
   */
  private validateTechniquesAgainstAllowList(techniques: Technique[]): void {
    const invalidTechniques = techniques.filter((tech) => !TECHNIQUE_ALLOW_LIST[tech])

    if (invalidTechniques.length > 0) {
      throw new ValidationError(`Techniques not in allow-list: ${invalidTechniques.join(', ')}`, {
        invalidTechniques,
      })
    }
  }

  /**
   * Additional business rule validations
   */
  private validateBusinessRules(response: StrategyPlannerResponse): void {
    const { suggested_techniques, confidence } = response

    // Rule 1: Max 3 techniques (already enforced by schema, but double-check)
    if (suggested_techniques.length > 3) {
      throw new ValidationError(
        `Too many techniques suggested: ${suggested_techniques.length} (max 3)`,
      )
    }

    // Rule 2: Check for incompatible technique combinations
    for (let i = 0; i < suggested_techniques.length; i++) {
      const tech = suggested_techniques[i]
      const metadata = TECHNIQUE_ALLOW_LIST[tech]

      if (metadata.incompatibleWith) {
        const conflicts = suggested_techniques.filter((t) => metadata.incompatibleWith?.includes(t))

        if (conflicts.length > 0) {
          throw new ValidationError(
            `Incompatible techniques: ${tech} cannot be used with ${conflicts.join(', ')}`,
          )
        }
      }
    }

    // Rule 3: Guard helpers should be included for most cases
    const hasGuardHelper = suggested_techniques.some(
      (tech) => TECHNIQUE_ALLOW_LIST[tech].category === 'guard_helpers',
    )

    if (!hasGuardHelper && confidence > 0.7) {
      console.warn('High confidence response without guard helpers')
    }

    // Rule 4: Confidence bounds check
    if (confidence < 0 || confidence > 1) {
      throw new ValidationError(`Invalid confidence value: ${confidence} (must be between 0 and 1)`)
    }
  }

  /**
   * Quick validation for fail-fast scenarios
   */
  quickValidate(techniques: string[]): boolean {
    try {
      // Check if all techniques are strings and in allow-list
      return techniques.every((tech) => typeof tech === 'string' && tech in TECHNIQUE_ALLOW_LIST)
    } catch {
      return false
    }
  }
}
