/**
 * PromptDial 3.0 - Tree of Thought (ToT) Technique
 *
 * Explores multiple reasoning paths in a tree structure
 */

import { BaseTechnique } from './base'
import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TECHNIQUES,
} from '@promptdial/shared'

export class TreeOfThoughtTechnique extends BaseTechnique {
  name = TECHNIQUES.TREE_OF_THOUGHT
  description = 'Systematic exploration of multiple reasoning paths'
  best_for = ['creative_writing', 'math_reasoning', 'code_generation'] as const
  needs_retrieval = false

  async generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints,
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = []

    // ToT is expensive - check if we have sufficient budget
    const minCost = this.estimateMinCost(base_prompt)
    if (budget.remaining_cost_usd < minCost) {
      return []
    }

    // Variant 1: Basic Tree of Thought
    const basicPrompt = this.createBasicToT(base_prompt, meta)
    const variant1 = this.createVariant(
      this.sandwichPrompt(basicPrompt),
      `${this.name}_basic`,
      0.8,
      0,
    )
    variant1.cost_usd *= 1.5 // ToT requires more tokens

    if (this.fitsInBudget(variant1, budget)) {
      variants.push(variant1)
    }

    // Variant 2: Structured ToT with evaluation
    const structuredPrompt = this.createStructuredToT(base_prompt, meta)
    const variant2 = this.createVariant(
      this.sandwichPrompt(structuredPrompt),
      `${this.name}_structured`,
      0.7,
      1,
    )
    variant2.cost_usd *= 2 // More expensive due to evaluation steps

    if (this.fitsInBudget(variant2, budget)) {
      variants.push(variant2)
    }

    // Variant 3: Guided ToT for complex problems
    if (meta.complexity > 0.7 && budget.remaining_cost_usd > minCost * 3) {
      const guidedPrompt = this.createGuidedToT(base_prompt, meta)
      const variant3 = this.createVariant(
        this.sandwichPrompt(guidedPrompt),
        `${this.name}_guided`,
        0.7,
        2,
      )
      variant3.cost_usd *= 2.5

      if (this.fitsInBudget(variant3, budget)) {
        variants.push(variant3)
      }
    }

    return variants
  }

  private createBasicToT(basePrompt: string, meta: TaskClassification): string {
    const branchingFactor = meta.complexity > 0.6 ? 3 : 2

    return `Solve this problem using Tree of Thought reasoning:

${basePrompt}

INSTRUCTIONS:
1. Generate ${branchingFactor} different initial approaches
2. For each approach, explore 2-3 next steps
3. Evaluate which paths are most promising
4. Continue developing the best path(s)
5. Arrive at the final solution

Format your response as:

ROOT: [Problem statement]
├── Branch 1: [First approach]
│   ├── Step 1.1: [Next step]
│   └── Step 1.2: [Alternative step]
├── Branch 2: [Second approach]
│   ├── Step 2.1: [Next step]
│   └── Step 2.2: [Alternative step]
${branchingFactor > 2 ? '└── Branch 3: [Third approach]\n    ├── Step 3.1: [Next step]\n    └── Step 3.2: [Alternative step]' : ''}

EVALUATION: [Which branches are most promising and why]

SELECTED PATH: [Develop the best branch to completion]

SOLUTION: [Final answer]`
  }

  private createStructuredToT(basePrompt: string, meta: TaskClassification): string {
    const evaluationCriteria = this.getEvaluationCriteria(meta.task_type)

    return `Apply Tree of Thought with systematic evaluation:

PROBLEM: ${basePrompt}

PHASE 1 - THOUGHT GENERATION:
Generate 3 distinct approaches to solving this problem. For each approach:
- Describe the core strategy
- List key advantages
- Note potential challenges

PHASE 2 - THOUGHT EVALUATION:
Rate each approach (1-10) on these criteria:
${evaluationCriteria}

PHASE 3 - DELIBERATION:
For the top-rated approach(es):
- Develop 2-3 concrete next steps
- Evaluate each step's feasibility
- Select the most promising path

PHASE 4 - EXECUTION:
Follow the selected path to completion:
- Show detailed work
- Handle edge cases
- Verify the solution

Present your work clearly with headers for each phase.`
  }

  private createGuidedToT(basePrompt: string, meta: TaskClassification): string {
    const domainGuidance = this.getDomainGuidance(meta.task_type, meta.domain)

    return `Use Tree of Thought reasoning with domain-specific guidance:

PROBLEM: ${basePrompt}

TREE OF THOUGHT PROTOCOL:

Level 1 - Initial Decomposition:
Break the problem into 3-4 key components or subproblems.

Level 2 - Solution Strategies:
For each component, propose 2 different solution strategies.

Level 3 - Integration Paths:
Show how different combinations of strategies could work together.

DOMAIN GUIDANCE for ${meta.task_type}:
${domainGuidance}

TRAVERSAL:
1. Start at the root (original problem)
2. Explore breadth-first to Level 2
3. Evaluate all paths using domain guidance
4. Deep-dive into the most promising branch
5. Backtrack if needed
6. Synthesize final solution

Use clear visual structure (indentation, bullets) to show the tree.`
  }

  private getEvaluationCriteria(taskType: string): string {
    const criteria: Record<string, string> = {
      math_reasoning: `
- Correctness: Will this approach lead to the right answer?
- Efficiency: How many steps are required?
- Clarity: Is the reasoning easy to follow?
- Generality: Does it handle edge cases?`,

      code_generation: `
- Correctness: Will the code work as intended?
- Efficiency: Time and space complexity
- Readability: Is the code clean and maintainable?
- Robustness: Error handling and edge cases`,

      creative_writing: `
- Originality: How unique is this approach?
- Coherence: Does it flow logically?
- Impact: Will it engage the reader?
- Feasibility: Can it be well-executed?`,

      data_analysis: `
- Validity: Are the methods appropriate?
- Completeness: Does it address all aspects?
- Insight: Will it reveal meaningful patterns?
- Actionability: Can results guide decisions?`,

      general_qa: `
- Accuracy: Is the information correct?
- Completeness: Does it fully address the question?
- Clarity: Is it easy to understand?
- Relevance: Does it focus on what matters?`,
    }

    return criteria[taskType] || criteria.general_qa
  }

  private getDomainGuidance(taskType: string, domain: string): string {
    const guidance: Record<string, Record<string, string>> = {
      math_reasoning: {
        academic: 'Consider formal mathematical proofs and rigorous notation',
        technical: 'Focus on computational efficiency and numerical stability',
        general: 'Emphasize clear explanations and practical applications',
      },
      code_generation: {
        technical: 'Prioritize performance, scalability, and best practices',
        business: 'Focus on maintainability, documentation, and business logic',
        general: 'Balance readability with functionality',
      },
      creative_writing: {
        creative: 'Explore unconventional narratives and experimental techniques',
        academic: 'Maintain formal tone with structured arguments',
        general: 'Aim for broad appeal with clear storytelling',
      },
    }

    const taskGuidance = guidance[taskType] || {}
    return taskGuidance[domain] || 'Consider multiple perspectives and aim for clarity'
  }

  private estimateMinCost(prompt: string): number {
    // ToT typically requires 2-3x more tokens than standard prompts
    const baseTokens = Math.ceil(prompt.length / 4)
    return ((baseTokens * 3) / 1000) * 0.002
  }
}
