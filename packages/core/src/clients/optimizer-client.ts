import { ServiceClient, ServiceClientOptions } from './base-client'
import { 
  OptimizerRequest,
  OptimizerResponse,
  OptimizationObjective,
  PromptVariant
} from '@promptdial/shared'
import { toOptimizationObjective, extractParetoOptimal } from '../adapters/type-adapters'

export class OptimizerClient extends ServiceClient {
  constructor(baseUrl: string, options?: ServiceClientOptions) {
    super('Optimizer', baseUrl, options)
  }

  async optimize(request: OptimizerRequest): Promise<OptimizerResponse> {
    return this.request<OptimizerResponse>('POST', '/optimize', request)
  }

  async paretoFilter(
    variants: PromptVariant[],
    objectives: string[] = ['quality', 'cost', 'latency']
  ): Promise<PromptVariant[]> {
    const response = await this.optimize({
      variants,
      objectives: objectives.map(toOptimizationObjective)
    })
    
    return extractParetoOptimal(response)
  }

  async rankVariants(
    variants: PromptVariant[],
    weights: Record<OptimizationObjective, number>
  ): Promise<PromptVariant[]> {
    const response = await this.optimize({
      variants,
      objectives: Object.keys(weights) as OptimizationObjective[]
    })
    
    return extractParetoOptimal(response)
  }

  async getOptimalVariant(
    variants: PromptVariant[],
    budget?: { maxCost?: number; maxLatency?: number }
  ): Promise<PromptVariant | null> {
    const filtered = await this.paretoFilter(variants)
    
    if (budget) {
      const withinBudget = filtered.filter(v => 
        (!budget.maxCost || v.cost_usd <= budget.maxCost) &&
        (!budget.maxLatency || (v.estimated_latency_ms || 0) <= budget.maxLatency)
      )
      
      // Sort by cost efficiency (lower cost is better)
      return withinBudget.sort((a, b) => a.cost_usd - b.cost_usd)[0] || null
    }
    
    return filtered[0] || null
  }
}