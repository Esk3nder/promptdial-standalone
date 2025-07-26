/**
 * PromptDial 3.0 - Optimizer Types
 */

import { PromptVariant, EvaluationResult } from '@promptdial/shared'

export interface OptimizationObjective {
  quality: number // 0-1, higher is better
  cost: number // 0-1, lower is better (normalized)
  latency: number // 0-1, lower is better (normalized)
}

export interface ParetoSolution {
  variant_id: string
  objectives: OptimizationObjective
  variant?: PromptVariant
  evaluation?: EvaluationResult
}

export interface OptimizationPreferences {
  quality: number // Weight for quality (0-1)
  cost: number // Weight for cost (0-1)
  latency: number // Weight for latency (0-1)
}

export interface OptimizationConstraints {
  max_cost?: number // Maximum acceptable cost (USD)
  min_quality?: number // Minimum acceptable quality score
  max_latency?: number // Maximum acceptable latency (ms)
  required_safety?: boolean // Must pass safety checks
}

export interface OptimizationRequest {
  variants: Array<{
    variant: PromptVariant
    evaluation: EvaluationResult
  }>
  preferences?: OptimizationPreferences
  constraints?: OptimizationConstraints
  selection_mode?: 'pareto' | 'utility' | 'balanced'
}

export interface OptimizationResult {
  pareto_frontier: ParetoSolution[]
  recommended: ParetoSolution
  alternatives: ParetoSolution[]
  trade_offs: TradeOffAnalysis[]
}

export interface TradeOffAnalysis {
  from_variant: string
  to_variant: string
  quality_change: number
  cost_change: number
  latency_change: number
  recommendation: string
}
