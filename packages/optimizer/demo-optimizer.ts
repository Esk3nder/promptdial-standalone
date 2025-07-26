/**
 * Demo script for Pareto Optimizer
 */

import { getOptimizerService } from './src/index'
import { OptimizationRequest } from './src/types'
import { PromptVariant, EvaluationResult } from '@promptdial/shared'

// Sample variants with different characteristics
const variants: Array<{ variant: PromptVariant; evaluation: EvaluationResult }> = [
  {
    variant: {
      id: 'gpt4-detailed',
      technique: 'FewShot_CoT',
      prompt: 'High quality detailed prompt with examples...',
      temperature: 0.7,
      est_tokens: 2000,
      cost_usd: 0.06,
      latency_ms: 3000,
    },
    evaluation: {
      variant_id: 'gpt4-detailed',
      scores: { g_eval: 0.95, chat_eval: 0.92 },
      final_score: 0.94,
      confidence_interval: [0.91, 0.97],
    },
  },
  {
    variant: {
      id: 'gpt35-fast',
      technique: 'ReAct',
      prompt: 'Quick and efficient prompt...',
      temperature: 0.5,
      est_tokens: 500,
      cost_usd: 0.002,
      latency_ms: 800,
    },
    evaluation: {
      variant_id: 'gpt35-fast',
      scores: { g_eval: 0.78, chat_eval: 0.75 },
      final_score: 0.77,
      confidence_interval: [0.74, 0.8],
    },
  },
  {
    variant: {
      id: 'claude-balanced',
      technique: 'SelfConsistency',
      prompt: 'Balanced approach with voting...',
      temperature: 0.6,
      est_tokens: 1000,
      cost_usd: 0.015,
      latency_ms: 1500,
    },
    evaluation: {
      variant_id: 'claude-balanced',
      scores: { g_eval: 0.88, self_consistency: 0.91 },
      final_score: 0.89,
      confidence_interval: [0.86, 0.92],
    },
  },
  {
    variant: {
      id: 'mixtral-creative',
      technique: 'TreeOfThought',
      prompt: 'Creative exploration prompt...',
      temperature: 0.9,
      est_tokens: 1500,
      cost_usd: 0.008,
      latency_ms: 2000,
    },
    evaluation: {
      variant_id: 'mixtral-creative',
      scores: { g_eval: 0.82, chat_eval: 0.85 },
      final_score: 0.83,
      confidence_interval: [0.8, 0.86],
    },
  },
  {
    variant: {
      id: 'gemini-efficient',
      technique: 'IRCoT',
      prompt: 'Efficient reasoning prompt...',
      temperature: 0.4,
      est_tokens: 800,
      cost_usd: 0.004,
      latency_ms: 1200,
    },
    evaluation: {
      variant_id: 'gemini-efficient',
      scores: { g_eval: 0.85, chat_eval: 0.83 },
      final_score: 0.84,
      confidence_interval: [0.81, 0.87],
    },
  },
]

async function demonstrateOptimizer() {
  console.log('PromptDial 3.0 - Pareto Optimizer Demo\n')
  console.log('='.repeat(60))

  const optimizer = getOptimizerService()

  // Test 1: Default optimization (balanced)
  console.log('\n1. DEFAULT OPTIMIZATION (Balanced Approach)')
  console.log('-'.repeat(60))

  const defaultRequest: OptimizationRequest = { variants }
  const defaultResult = await optimizer.optimize(defaultRequest)

  console.log(`Pareto Frontier: ${defaultResult.pareto_frontier.length} solutions`)
  defaultResult.pareto_frontier.forEach((sol) => {
    console.log(
      `  - ${sol.variant_id}: Quality=${sol.objectives.quality.toFixed(2)}, Cost=${sol.objectives.cost.toFixed(3)}, Latency=${sol.objectives.latency.toFixed(3)}`,
    )
  })

  console.log(`\nRecommended: ${defaultResult.recommended.variant_id}`)
  console.log(`  Quality: ${defaultResult.recommended.objectives.quality.toFixed(2)}`)
  console.log(`  Cost: $${defaultResult.recommended.variant?.cost_usd}`)
  console.log(`  Latency: ${defaultResult.recommended.variant?.latency_ms}ms`)

  // Test 2: Quality-focused optimization
  console.log('\n2. QUALITY-FOCUSED OPTIMIZATION')
  console.log('-'.repeat(60))

  const qualityRequest: OptimizationRequest = {
    variants,
    preferences: { quality: 0.8, cost: 0.1, latency: 0.1 },
    selection_mode: 'utility',
  }
  const qualityResult = await optimizer.optimize(qualityRequest)

  console.log(`Recommended: ${qualityResult.recommended.variant_id}`)
  console.log(`Trade-offs:`)
  qualityResult.trade_offs.forEach((trade) => {
    console.log(`  vs ${trade.to_variant}: ${trade.recommendation}`)
  })

  // Test 3: Budget-constrained optimization
  console.log('\n3. BUDGET-CONSTRAINED OPTIMIZATION (max $0.01)')
  console.log('-'.repeat(60))

  const budgetRequest: OptimizationRequest = {
    variants,
    constraints: { max_cost: 0.01 },
  }
  const budgetResult = await optimizer.optimize(budgetRequest)

  console.log(`Feasible solutions: ${budgetResult.pareto_frontier.length}`)
  console.log(
    `Recommended: ${budgetResult.recommended.variant_id} (Cost: $${budgetResult.recommended.variant?.cost_usd})`,
  )

  // Test 4: Speed-critical optimization
  console.log('\n4. SPEED-CRITICAL OPTIMIZATION')
  console.log('-'.repeat(60))

  const speedRequest: OptimizationRequest = {
    variants,
    preferences: { quality: 0.2, cost: 0.2, latency: 0.6 },
    constraints: { max_latency: 1500 },
    selection_mode: 'utility',
  }
  const speedResult = await optimizer.optimize(speedRequest)

  console.log(
    `Recommended: ${speedResult.recommended.variant_id} (${speedResult.recommended.variant?.latency_ms}ms)`,
  )
  console.log(`Quality score: ${speedResult.recommended.objectives.quality.toFixed(2)}`)

  // Test 5: Pareto knee point
  console.log('\n5. PARETO KNEE POINT (Best Compromise)')
  console.log('-'.repeat(60))

  const kneeRequest: OptimizationRequest = {
    variants,
    selection_mode: 'pareto',
  }
  const kneeResult = await optimizer.optimize(kneeRequest)

  console.log(`Knee point: ${kneeResult.recommended.variant_id}`)
  console.log(`Reasoning: This variant offers the best compromise between all objectives`)

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('OPTIMIZATION SUMMARY')
  console.log('='.repeat(60))
  console.log('The Pareto Optimizer helps select the best variant based on:')
  console.log('- Quality scores from evaluation')
  console.log('- Cost considerations')
  console.log('- Latency requirements')
  console.log('- User preferences and constraints')
  console.log('\nIt finds non-dominated solutions and recommends the best choice.')
}

// Run demo
demonstrateOptimizer().catch(console.error)
