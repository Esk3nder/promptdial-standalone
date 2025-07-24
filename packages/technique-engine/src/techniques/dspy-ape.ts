/**
 * PromptDial 2.0 - DSPy APE (Automatic Prompt Engineering) Technique
 *
 * Automatically discovers effective prompts through optimization
 */

import { BaseTechnique } from './base'
import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TECHNIQUES,
} from '@promptdial/shared'

export class DSPyAPETechnique extends BaseTechnique {
  name = TECHNIQUES.DSPY_APE
  description = 'Automatic prompt engineering through iterative optimization'
  best_for = ['code_generation', 'math_reasoning', 'general_qa'] as const
  needs_retrieval = false

  async generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints,
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = []

    // APE is computationally expensive
    if (budget.remaining_cost_usd < 0.1) {
      return []
    }

    // Variant 1: Basic APE - Instruction Induction
    const instructionPrompt = this.createInstructionInduction(base_prompt, meta)
    const variant1 = this.createVariant(
      this.sandwichPrompt(instructionPrompt),
      `${this.name}_instruction`,
      0.8,
      0,
    )
    variant1.cost_usd *= 2 // APE requires multiple iterations

    if (this.fitsInBudget(variant1, budget)) {
      variants.push(variant1)
    }

    // Variant 2: APE with Forward Generation
    const forwardPrompt = this.createForwardGeneration(base_prompt, meta)
    const variant2 = this.createVariant(
      this.sandwichPrompt(forwardPrompt),
      `${this.name}_forward`,
      0.7,
      1,
    )
    variant2.cost_usd *= 2.5

    if (this.fitsInBudget(variant2, budget)) {
      variants.push(variant2)
    }

    // Variant 3: APE with Prompt Scoring
    if (budget.remaining_cost_usd > 0.15) {
      const scoringPrompt = this.createPromptScoring(base_prompt, meta)
      const variant3 = this.createVariant(
        this.sandwichPrompt(scoringPrompt),
        `${this.name}_scoring`,
        0.7,
        2,
      )
      variant3.cost_usd *= 3 // Most expensive variant

      if (this.fitsInBudget(variant3, budget)) {
        variants.push(variant3)
      }
    }

    return variants
  }

  private createInstructionInduction(basePrompt: string, meta: TaskClassification): string {
    return `Use Automatic Prompt Engineering to optimize this task:

ORIGINAL TASK: ${basePrompt}

INSTRUCTION INDUCTION PROTOCOL:

Step 1 - Generate Candidate Instructions:
Create 3 different instruction sets that could help solve this task:

Instruction Set A: [Focus on clarity and directness]
Instruction Set B: [Focus on step-by-step decomposition]
Instruction Set C: [Focus on examples and patterns]

Step 2 - Test Each Instruction Set:
For each instruction set, show how it would guide solving the original task.

Step 3 - Analyze Effectiveness:
- Which instruction set produces the clearest reasoning?
- Which handles edge cases best?
- Which is most efficient?

Step 4 - Synthesize Optimal Prompt:
Combine the best elements from each instruction set into an optimized prompt.

Step 5 - Apply Optimized Prompt:
Use your optimized prompt to solve the original task.

FINAL ANSWER:
[Solution using the optimized prompt]`
  }

  private createForwardGeneration(basePrompt: string, meta: TaskClassification): string {
    const taskContext = this.getTaskContext(meta.task_type)

    return `Apply DSPy Forward Generation for prompt optimization:

TASK: ${basePrompt}
TASK TYPE: ${meta.task_type}

FORWARD GENERATION PROCESS:

Phase 1 - Prompt Hypothesis:
Generate 3 prompt templates that should work well for ${meta.task_type}:

Template 1: [Basic template]
${taskContext.template1}

Template 2: [Enhanced template]
${taskContext.template2}

Template 3: [Advanced template]
${taskContext.template3}

Phase 2 - Forward Pass:
For each template, generate what an ideal response would look like.

Phase 3 - Backward Analysis:
Given the ideal responses, refine each template to better elicit such responses.

Phase 4 - Cross-Validation:
Test refined templates on the original task.

Phase 5 - Meta-Learning:
What patterns make prompts effective for this type of task?

OPTIMIZED SOLUTION:
[Apply the best-performing template to solve the original task]`
  }

  private createPromptScoring(basePrompt: string, meta: TaskClassification): string {
    return `Use APE with Prompt Scoring optimization:

TASK: ${basePrompt}

PROMPT SCORING PROTOCOL:

Stage 1 - Candidate Generation:
Generate 5 diverse prompt formulations for this task:

Prompt 1 (Minimal): [Bare essentials]
Prompt 2 (Descriptive): [Rich context]
Prompt 3 (Structured): [Clear format]
Prompt 4 (Example-driven): [With demonstrations]
Prompt 5 (Constraint-based): [With explicit constraints]

Stage 2 - Scoring Criteria:
Rate each prompt (1-10) on:
- Clarity: How unambiguous is the instruction?
- Completeness: Does it cover all aspects?
- Efficiency: Token usage vs information content
- Robustness: Handles edge cases?
- Task-fit: Matches the specific task needs?

Stage 3 - Score Table:
| Prompt | Clarity | Complete | Efficient | Robust | Task-fit | TOTAL |
|--------|---------|----------|-----------|---------|----------|--------|
| P1     |         |          |           |         |          |        |
| P2     |         |          |           |         |          |        |
| P3     |         |          |           |         |          |        |
| P4     |         |          |           |         |          |        |
| P5     |         |          |           |         |          |        |

Stage 4 - Prompt Fusion:
Combine high-scoring elements into a super-prompt.

Stage 5 - Execution:
Apply the optimized prompt to solve the task.

SOLUTION:
[Final answer using the optimized prompt]`
  }

  private getTaskContext(taskType: string): {
    template1: string
    template2: string
    template3: string
  } {
    const contexts = {
      math_reasoning: {
        template1: 'Solve this math problem: {task}',
        template2: 'Problem: {task}\nShow your work step by step and verify your answer.',
        template3:
          'Mathematical Task: {task}\n\nApproach:\n1. Identify given information\n2. Determine what to find\n3. Select appropriate method\n4. Execute calculations\n5. Verify result\n\nSolution:',
      },
      code_generation: {
        template1: 'Write code to: {task}',
        template2:
          'Task: {task}\n\nRequirements:\n- Clean, readable code\n- Handle edge cases\n- Include comments\n\nImplementation:',
        template3:
          'Coding Challenge: {task}\n\nConsiderations:\n- Algorithm choice\n- Time/space complexity\n- Error handling\n- Test cases\n\nSolution with explanation:',
      },
      general_qa: {
        template1: 'Answer: {task}',
        template2: 'Question: {task}\n\nProvide a comprehensive answer with supporting details.',
        template3:
          'Query: {task}\n\nStructured Response:\n- Direct answer\n- Explanation\n- Examples\n- Additional context\n\nAnswer:',
      },
    }

    return contexts[taskType] || contexts.general_qa
  }
}
