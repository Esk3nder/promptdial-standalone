/**
 * PromptDial 2.0 - Pareto Optimizer Service
 * 
 * Multi-objective optimization for prompt variants
 */

import {
  PromptVariant,
  EvaluationResult,
  ServiceRequest,
  ServiceResponse,
  createServiceResponse,
  createServiceError,
  createLogger,
  ERROR_CODES,
  getTelemetryService,
  DEFAULTS
} from '@promptdial/shared'

import {
  ParetoOptimizer
} from './pareto'

import {
  OptimizationRequest,
  OptimizationResult,
  ParetoSolution,
  OptimizationObjective,
  OptimizationPreferences,
  TradeOffAnalysis
} from './types'

const logger = createLogger('optimizer')

// ============= Optimizer Service =============

export class OptimizerService {
  private paretoOptimizer: ParetoOptimizer
  
  constructor() {
    this.paretoOptimizer = new ParetoOptimizer()
  }
  
  /**
   * Optimize variant selection based on multiple objectives
   */
  async optimize(request: OptimizationRequest): Promise<OptimizationResult> {
    const startTime = Date.now()
    
    // Convert variants to Pareto solutions
    const solutions = this.convertToSolutions(request.variants)
    
    // Apply constraints if provided
    let feasibleSolutions = solutions
    if (request.constraints) {
      feasibleSolutions = this.paretoOptimizer.applyConstraints(
        solutions,
        this.normalizeConstraints(request.constraints)
      )
      
      if (feasibleSolutions.length === 0) {
        throw new Error('No variants satisfy the given constraints')
      }
    }
    
    // Find Pareto frontier
    const paretoFrontier = this.paretoOptimizer.findParetoFrontier(feasibleSolutions)
    
    // Select recommended solution
    const recommended = this.selectRecommended(
      paretoFrontier,
      request.preferences,
      request.selection_mode
    )
    
    // Find alternatives
    const alternatives = this.findAlternatives(paretoFrontier, recommended)
    
    // Analyze trade-offs
    const tradeOffs = this.analyzeTradeOffs(recommended, alternatives)
    
    // Log telemetry
    const duration = Date.now() - startTime
    await this.logTelemetry(request, paretoFrontier, recommended, duration)
    
    return {
      pareto_frontier: paretoFrontier,
      recommended,
      alternatives,
      trade_offs: tradeOffs
    }
  }
  
  /**
   * Convert variants to Pareto solutions
   */
  private convertToSolutions(
    variants: Array<{ variant: PromptVariant; evaluation: EvaluationResult }>
  ): ParetoSolution[] {
    return variants.map(({ variant, evaluation }) => {
      const objectives = this.calculateObjectives(variant, evaluation)
      
      return {
        variant_id: variant.id,
        objectives,
        variant,
        evaluation
      }
    })
  }
  
  /**
   * Calculate normalized objectives for a variant
   */
  private calculateObjectives(
    variant: PromptVariant,
    evaluation: EvaluationResult
  ): OptimizationObjective {
    // Quality: use evaluation score directly
    const quality = evaluation.final_score
    
    // Cost: normalize to 0-1 range (assume max cost from defaults)
    const maxCost = DEFAULTS.COST_CAP_USD
    const cost = Math.min(variant.cost_usd / maxCost, 1)
    
    // Latency: normalize to 0-1 range (assume max latency from defaults)
    const maxLatency = DEFAULTS.LATENCY_CAP_MS
    const latency = variant.latency_ms 
      ? Math.min(variant.latency_ms / maxLatency, 1)
      : 0.5 // Default if not measured
    
    return { quality, cost, latency }
  }
  
  /**
   * Normalize constraints to 0-1 range
   */
  private normalizeConstraints(constraints: any): any {
    const normalized: any = {}
    
    if (constraints.min_quality !== undefined) {
      normalized.min_quality = constraints.min_quality
    }
    
    if (constraints.max_cost !== undefined) {
      normalized.max_cost = constraints.max_cost / DEFAULTS.COST_CAP_USD
    }
    
    if (constraints.max_latency !== undefined) {
      normalized.max_latency = constraints.max_latency / DEFAULTS.LATENCY_CAP_MS
    }
    
    return normalized
  }
  
  /**
   * Select recommended solution based on mode and preferences
   */
  private selectRecommended(
    frontier: ParetoSolution[],
    preferences?: OptimizationPreferences,
    mode?: 'pareto' | 'utility' | 'balanced'
  ): ParetoSolution {
    if (frontier.length === 1) {
      return frontier[0]
    }
    
    switch (mode) {
      case 'utility':
        // Use preferences directly
        if (!preferences) {
          throw new Error('Preferences required for utility mode')
        }
        return this.paretoOptimizer.selectByPreference(frontier, preferences)
      
      case 'pareto':
        // Find knee point (best compromise)
        return this.paretoOptimizer.findKneePoint(frontier)
      
      case 'balanced':
      default:
        // Use preferences if provided, otherwise find knee point
        if (preferences) {
          return this.paretoOptimizer.selectByPreference(frontier, preferences)
        } else {
          return this.paretoOptimizer.findKneePoint(frontier)
        }
    }
  }
  
  /**
   * Find alternative solutions
   */
  private findAlternatives(
    frontier: ParetoSolution[],
    recommended: ParetoSolution
  ): ParetoSolution[] {
    // Return up to 3 alternatives from the frontier
    return frontier
      .filter(s => s.variant_id !== recommended.variant_id)
      .slice(0, 3)
  }
  
  /**
   * Analyze trade-offs between recommended and alternatives
   */
  private analyzeTradeOffs(
    recommended: ParetoSolution,
    alternatives: ParetoSolution[]
  ): TradeOffAnalysis[] {
    return alternatives.map(alt => 
      this.paretoOptimizer.analyzeTradeOffs(recommended, alt)
    )
  }
  
  /**
   * Log optimization telemetry
   */
  private async logTelemetry(
    request: OptimizationRequest,
    frontier: ParetoSolution[],
    recommended: ParetoSolution,
    duration: number
  ): Promise<void> {
    const telemetry = getTelemetryService()
    
    telemetry.recordLatency('optimization', duration)
    telemetry.recordMetric('pareto_frontier_size', frontier.length)
    telemetry.recordMetric('total_variants', request.variants.length)
    telemetry.recordMetric('recommended_quality', recommended.objectives.quality)
    telemetry.recordMetric('recommended_cost', recommended.objectives.cost)
    telemetry.recordMetric('recommended_latency', recommended.objectives.latency)
    
    logger.info('Optimization complete', {
      variants: request.variants.length,
      frontier_size: frontier.length,
      recommended: recommended.variant_id,
      duration_ms: duration
    })
  }
}

// ============= Service API =============

let serviceInstance: OptimizerService | null = null

export function getOptimizerService(): OptimizerService {
  if (!serviceInstance) {
    serviceInstance = new OptimizerService()
  }
  return serviceInstance
}

export async function handleOptimizeRequest(
  request: ServiceRequest<OptimizationRequest>
): Promise<ServiceResponse<OptimizationResult>> {
  try {
    const result = await getOptimizerService().optimize(request.payload)
    return createServiceResponse(request, result)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      error instanceof Error ? error.message : 'Optimization failed',
      true
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3007
  
  app.use(express.json({ limit: '10mb' }))
  
  // Optimize endpoint
  app.post('/optimize', async (req: any, res: any) => {
    const response = await handleOptimizeRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })
  
  // Health check
  app.get('/health', (_req: any, res: any) => {
    res.json({ 
      status: 'healthy', 
      service: 'optimizer',
      version: '2.0.0'
    })
  })
  
  app.listen(PORT, () => {
    logger.info(`Optimizer service running on port ${PORT}`)
  })
}

// ============= Exports =============

export { ParetoOptimizer } from './pareto'
export * from './types'