import { ServiceClient, ServiceClientOptions } from './base-client'
import { 
  OptimizerRequest,
  OptimizerResponse,
  OptimizationObjective,
  PromptVariant
} from '@promptdial/shared'

export class OptimizerClient extends ServiceClient {
  constructor(baseUrl: string, options?: ServiceClientOptions) {
    super('Optimizer', baseUrl, options)
  }

  async optimize(request: OptimizerRequest): Promise<OptimizerResponse> {
    return this.request<OptimizerResponse>('POST', '/optimize', request)
  }

  async paretoFilter(
    variants: PromptVariant[],
    objectives: OptimizationObjective[] = ['quality', 'cost', 'latency']
  ): Promise<PromptVariant[]> {
    const response = await this.optimize({
      variants,
      objectives,
      strategy: 'pareto'
    })
    
    return response.optimizedVariants
  }

  async rankVariants(
    variants: PromptVariant[],
    weights: Record<OptimizationObjective, number>
  ): Promise<PromptVariant[]> {
    const response = await this.optimize({
      variants,
      objectives: Object.keys(weights) as OptimizationObjective[],
      strategy: 'weighted',
      weights
    })
    
    return response.optimizedVariants
  }

  async getOptimalVariant(
    variants: PromptVariant[],
    budget?: { maxCost?: number; maxLatency?: number }
  ): Promise<PromptVariant | null> {
    const filtered = await this.paretoFilter(variants)
    
    if (budget) {
      const withinBudget = filtered.filter(v => 
        (!budget.maxCost || (v.cost || 0) <= budget.maxCost) &&
        (!budget.maxLatency || (v.latency || 0) <= budget.maxLatency)
      )
      
      return withinBudget.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null
    }
    
    return filtered[0] || null
  }
}