/**
 * PromptDial 2.0 - Self-Consistency Technique
 *
 * Generates multiple reasoning paths and selects the most consistent answer
 */

import { BaseTechnique } from './base'
import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TECHNIQUES,
} from '@promptdial/shared'

export class SelfConsistencyTechnique extends BaseTechnique {
  name = TECHNIQUES.SELF_CONSISTENCY
  description = 'Multiple reasoning paths with consistency voting'
  best_for = ['math_reasoning', 'data_analysis', 'general_qa'] as const
  needs_retrieval = false

  async generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints,
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = []

    // Calculate how many samples we can afford
    const baseCost = estimateCostForSamples(base_prompt, 1)
    const maxSamples = Math.min(
      Math.floor(budget.remaining_cost_usd / baseCost),
      5, // Cap at 5 samples
    )

    if (maxSamples < 3) {
      // Self-consistency needs at least 3 samples to be effective
      return []
    }

    // Variant 1: Basic self-consistency with 3 samples
    const basicPrompt = this.createBasicSelfConsistency(base_prompt)
    const variant1 = this.createVariant(
      this.sandwichPrompt(basicPrompt),
      `${this.name}_3samples`,
      0.8, // Higher temperature for diversity
      0,
    )
    variant1.cost_usd *= 3 // Account for 3 samples
    variant1.est_tokens *= 3

    if (this.fitsInBudget(variant1, budget)) {
      variants.push(variant1)
    }

    // Variant 2: Enhanced self-consistency with 5 samples
    if (maxSamples >= 5) {
      const enhancedPrompt = this.createEnhancedSelfConsistency(base_prompt, meta)
      const variant2 = this.createVariant(
        this.sandwichPrompt(enhancedPrompt),
        `${this.name}_5samples`,
        0.9, // Even higher temperature
        1,
      )
      variant2.cost_usd *= 5
      variant2.est_tokens *= 5

      if (this.fitsInBudget(variant2, budget)) {
        variants.push(variant2)
      }
    }

    // Variant 3: Self-consistency with guided reasoning
    if (maxSamples >= 3) {
      const guidedPrompt = this.createGuidedSelfConsistency(base_prompt, meta)
      const variant3 = this.createVariant(
        this.sandwichPrompt(guidedPrompt),
        `${this.name}_guided`,
        0.7,
        2,
      )
      variant3.cost_usd *= 3
      variant3.est_tokens *= 3

      if (this.fitsInBudget(variant3, budget)) {
        variants.push(variant3)
      }
    }

    return variants
  }

  private createBasicSelfConsistency(basePrompt: string): string {
    return `${basePrompt}

IMPORTANT: This prompt will be run multiple times with different random seeds to generate diverse reasoning paths. Each run should:
1. Approach the problem independently
2. Show complete step-by-step reasoning
3. Arrive at a final answer

The most common answer across all runs will be selected.

Please solve this problem now, showing your complete reasoning:`
  }

  private createEnhancedSelfConsistency(basePrompt: string, meta: TaskClassification): string {
    const approachHints = this.getApproachHints(meta.task_type)

    return `${basePrompt}

SELF-CONSISTENCY PROTOCOL:
This prompt generates multiple independent solutions. For this run, randomly select ONE of these approaches:
${approachHints}

Show your complete reasoning using your chosen approach, then provide your final answer.

Remember: Each run should explore a different path to the solution.`
  }

  private createGuidedSelfConsistency(basePrompt: string, meta: TaskClassification): string {
    const guidanceByComplexity =
      meta.complexity > 0.7
        ? `For this complex problem:
- Break it into clear sub-problems
- Solve each part methodically
- Combine results carefully
- Verify your answer`
        : `For this problem:
- Identify the key information
- Apply the relevant method
- Check your work`

    return `${basePrompt}

REASONING FRAMEWORK:
${guidanceByComplexity}

This is part of a self-consistency ensemble. Please provide:
1. Your interpretation of the problem
2. Your chosen solution approach
3. Step-by-step working
4. Final answer (clearly marked)

Different reasoning paths may lead to the same answer - that's expected.`
  }

  private getApproachHints(taskType: string): string {
    const hints: Record<string, string> = {
      math_reasoning: `
1. Algebraic approach - Set up equations and solve systematically
2. Logical approach - Work through the problem using logical steps
3. Visual approach - Imagine or sketch the problem if applicable
4. Working backwards - Start from the desired result`,

      code_generation: `
1. Top-down approach - Start with high-level design, then implement details
2. Bottom-up approach - Build small functions first, then combine
3. Test-driven approach - Consider test cases first, then implement
4. Pattern-based approach - Identify similar problems and adapt solutions`,

      data_analysis: `
1. Statistical approach - Focus on statistical measures and tests
2. Visual approach - Consider how to visualize the data
3. Comparative approach - Compare different aspects of the data
4. Trend-based approach - Look for patterns and trends`,

      general_qa: `
1. Analytical approach - Break down the question into components
2. Contextual approach - Consider the broader context
3. Example-based approach - Use concrete examples
4. First principles approach - Start from fundamental concepts`,
    }

    return hints[taskType] || hints.general_qa
  }
}

// Helper function to estimate cost for multiple samples
function estimateCostForSamples(prompt: string, samples: number): number {
  const baseTokens = Math.ceil(prompt.length / 4)
  const responseTokens = 200 // Estimate for response
  const totalTokens = (baseTokens + responseTokens) * samples
  return (totalTokens / 1000) * 0.002 // Rough estimate
}

/**
 * Universal Self-Consistency Vote Prompt
 * Used by the LLM Runner to aggregate self-consistency results
 */
export const SELF_CONSISTENCY_VOTE_PROMPT = `You are given multiple solutions to the same problem. Your task is to:

1. Identify the final answer from each solution
2. Count how many times each unique answer appears
3. Select the most common answer

If there's a tie, analyze which answer has the strongest reasoning support.

Solutions:
{solutions}

Based on the above solutions, what is the most consistent final answer? Provide only the final answer without explanation.`
