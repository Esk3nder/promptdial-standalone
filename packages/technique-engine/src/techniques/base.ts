/**
 * PromptDial 2.0 - Base Technique Strategy
 * 
 * Abstract base class for all prompt optimization techniques
 */

import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TechniqueStrategy,
  generateVariantId,
  estimateTokens,
  estimateCost
} from '@promptdial/shared'

export abstract class BaseTechnique implements TechniqueStrategy {
  abstract name: string
  abstract description: string
  abstract best_for: TaskClassification['task_type'][]
  abstract needs_retrieval: boolean
  
  /**
   * Generate prompt variants using this technique
   */
  abstract generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints
  ): Promise<PromptVariant[]>
  
  /**
   * Helper to create a prompt variant with common fields
   */
  protected createVariant(
    prompt: string,
    technique: string,
    temperature: number,
    index: number,
    provider: string = 'openai',
    model: string = 'gpt-3.5-turbo'
  ): PromptVariant {
    const tokens = estimateTokens(prompt)
    const cost = estimateCost(tokens, provider, model)
    
    return {
      id: generateVariantId(technique, index),
      technique,
      prompt,
      est_tokens: tokens,
      temperature,
      cost_usd: cost
    }
  }
  
  /**
   * Check if this technique fits within budget constraints
   */
  protected fitsInBudget(
    variant: PromptVariant,
    budget: BudgetConstraints
  ): boolean {
    return (
      variant.cost_usd <= budget.remaining_cost_usd &&
      variant.est_tokens <= budget.max_tokens
    )
  }
  
  /**
   * Format a prompt with a system instruction sandwich for safety
   */
  protected sandwichPrompt(userPrompt: string): string {
    return `<<SYS>>
You are a helpful AI assistant. Follow the user's instructions carefully.
<<USER>>
${userPrompt}
<<END>>`
  }
  
  /**
   * Add step-by-step reasoning instruction
   */
  protected addStepByStep(prompt: string): string {
    return `${prompt}\n\nPlease work through this step-by-step, showing your reasoning at each stage.`
  }
  
  /**
   * Add output format specification
   */
  protected addOutputFormat(prompt: string, format: string): string {
    return `${prompt}\n\nProvide your response in the following format:\n${format}`
  }
}