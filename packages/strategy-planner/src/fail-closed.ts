import { StrategyPlannerResponse, Technique, ValidationError, PlannerError } from './types'

/**
 * Fail-closed handler that returns a safe baseline response
 * Per spec axiom #4: any guard or schema error routes to deterministic safe-prompt ≈ v1 baseline
 */
export class FailClosedHandler {
  private readonly baselineResponse: StrategyPlannerResponse = {
    suggested_techniques: [Technique.CHAIN_OF_THOUGHT],
    rationale:
      'Using baseline Chain-of-Thought technique due to validation or processing error. This ensures safe and predictable prompt optimization.',
    confidence: 0.5,
    metadata: {
      processingTimeMs: 0,
      failedValidations: [],
    },
  }

  /**
   * Returns a safe baseline response when any error occurs
   */
  handleError(error: Error, startTime: number): StrategyPlannerResponse {
    const processingTimeMs = Date.now() - startTime

    // Log the error for observability
    console.error('[FailClosed] Handling error:', {
      errorType: error.constructor.name,
      message: error.message,
      processingTimeMs,
    })

    // Prepare failure metadata
    const failureReasons: string[] = []

    if (error instanceof ValidationError) {
      failureReasons.push(`Validation failed: ${error.message}`)
    } else if (error instanceof PlannerError) {
      failureReasons.push(`Planner error: ${error.message}`)
    } else {
      failureReasons.push(`Unexpected error: ${error.message}`)
    }

    // Return baseline with error metadata
    return {
      ...this.baselineResponse,
      metadata: {
        processingTimeMs,
        failedValidations: failureReasons,
        modelUsed: 'baseline',
      },
    }
  }

  /**
   * Wraps an async operation with fail-closed handling
   */
  async wrapOperation<T>(
    operation: () => Promise<T>,
    fallbackHandler: (error: Error) => T,
  ): Promise<T> {
    try {
      return await operation()
    } catch (error) {
      console.error('[FailClosed] Operation failed, using fallback:', error)
      return fallbackHandler(error as Error)
    }
  }

  /**
   * Validates if a response is the baseline (for testing/monitoring)
   */
  isBaselineResponse(response: StrategyPlannerResponse): boolean {
    return (
      response.suggested_techniques.length === 1 &&
      response.suggested_techniques[0] === Technique.CHAIN_OF_THOUGHT &&
      response.confidence === 0.5
    )
  }

  /**
   * Get baseline response directly (for testing)
   */
  getBaselineResponse(): StrategyPlannerResponse {
    return { ...this.baselineResponse }
  }
}
