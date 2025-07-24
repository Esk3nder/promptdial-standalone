/**
 * PromptDial 2.0 - ReAct (Reasoning + Acting) Technique
 *
 * Interleaves reasoning with actions for complex multi-step problems
 */

import { BaseTechnique } from './base'
import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TECHNIQUES,
} from '@promptdial/shared'

export class ReActTechnique extends BaseTechnique {
  name = TECHNIQUES.REACT
  description = 'Reasoning and acting in an interleaved manner'
  best_for = ['code_generation', 'data_analysis', 'general_qa'] as const
  needs_retrieval = false // Can work with retrieval but doesn't require it

  async generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints,
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = []

    // Variant 1: Basic ReAct
    const basicPrompt = this.createBasicReAct(base_prompt, meta)
    const variant1 = this.createVariant(
      this.sandwichPrompt(basicPrompt),
      `${this.name}_basic`,
      0.7,
      0,
    )

    if (this.fitsInBudget(variant1, budget)) {
      variants.push(variant1)
    }

    // Variant 2: ReAct with explicit action space
    const explicitPrompt = this.createExplicitReAct(base_prompt, meta)
    const variant2 = this.createVariant(
      this.sandwichPrompt(explicitPrompt),
      `${this.name}_explicit`,
      0.7,
      1,
    )

    if (this.fitsInBudget(variant2, budget)) {
      variants.push(variant2)
    }

    // Variant 3: ReAct with examples
    if (budget.remaining_cost_usd > variant1.cost_usd * 2) {
      const examplePrompt = this.createExampleReAct(base_prompt, meta)
      const variant3 = this.createVariant(
        this.sandwichPrompt(examplePrompt),
        `${this.name}_examples`,
        0.6,
        2,
      )

      if (this.fitsInBudget(variant3, budget)) {
        variants.push(variant3)
      }
    }

    return variants
  }

  private createBasicReAct(basePrompt: string, meta: TaskClassification): string {
    return `Solve this problem using the ReAct framework:

${basePrompt}

Use this format for your response:

Thought 1: [Your reasoning about what to do next]
Action 1: [The action you want to take]
Observation 1: [What you observe/learn from the action]

Thought 2: [Your next reasoning step based on the observation]
Action 2: [Your next action]
Observation 2: [What you observe]

Continue this pattern until you reach a solution.

Available actions:
- Think: Reason about the problem
- Calculate: Perform calculations
- Analyze: Analyze data or information
- Plan: Create a plan or strategy
- Verify: Check your work
- Conclude: State your final answer

Begin your reasoning now:`
  }

  private createExplicitReAct(basePrompt: string, meta: TaskClassification): string {
    const actionSpace = this.getActionSpace(meta.task_type)

    return `Use the ReAct (Reasoning + Acting) framework to solve:

${basePrompt}

INSTRUCTIONS:
1. Alternate between Thought (reasoning) and Action (doing)
2. After each Action, provide an Observation
3. Continue until you have a complete solution

ACTION SPACE for ${meta.task_type}:
${actionSpace}

FORMAT:
Thought [N]: <your reasoning>
Action [N]: <action_type>: <action_details>
Observation [N]: <what you learned>

Start with Thought 1:`
  }

  private createExampleReAct(basePrompt: string, meta: TaskClassification): string {
    const example = this.getExampleForTask(meta.task_type)

    return `Here's an example of using ReAct to solve a problem:

${example}

Now use the same ReAct approach for this problem:

${basePrompt}

Remember to:
1. Think before acting
2. Be specific in your actions
3. Learn from each observation
4. Build towards the solution step by step

Begin:`
  }

  private getActionSpace(taskType: string): string {
    const actionSpaces: Record<string, string> = {
      math_reasoning: `
- Calculate[expression]: Perform mathematical calculations
- Define[variable]: Define a variable or unknown
- Apply[formula]: Apply a mathematical formula
- Simplify[expression]: Simplify an expression
- Verify[result]: Verify a calculation`,

      code_generation: `
- Design[component]: Design a code component
- Implement[function]: Write code implementation
- Test[code]: Test the code with examples
- Debug[issue]: Debug problems in the code
- Optimize[code]: Improve code efficiency
- Document[code]: Add documentation`,

      data_analysis: `
- Examine[data]: Look at data characteristics
- Calculate[statistic]: Compute statistical measures
- Compare[items]: Compare different data points
- Visualize[data]: Describe data visualization
- Interpret[result]: Interpret findings
- Conclude[insight]: Draw conclusions`,

      general_qa: `
- Research[topic]: Gather information about a topic
- Define[term]: Define key terms
- Compare[concepts]: Compare different concepts
- Analyze[aspect]: Analyze specific aspects
- Synthesize[information]: Combine information
- Conclude[answer]: Provide final answer`,
    }

    return actionSpaces[taskType] || actionSpaces.general_qa
  }

  private getExampleForTask(taskType: string): string {
    const examples: Record<string, string> = {
      math_reasoning: `
EXAMPLE: "A car travels 150 miles in 3 hours, then 100 miles in 2 hours. What is its average speed?"

Thought 1: I need to find the total distance and total time, then calculate average speed.
Action 1: Calculate[total distance]: 150 + 100
Observation 1: Total distance = 250 miles

Thought 2: Now I need the total time.
Action 2: Calculate[total time]: 3 + 2
Observation 2: Total time = 5 hours

Thought 3: Average speed is total distance divided by total time.
Action 3: Calculate[average speed]: 250 / 5
Observation 3: Average speed = 50 miles per hour

Thought 4: I should verify this makes sense.
Action 4: Verify[result]: First leg: 150/3 = 50 mph, Second leg: 100/2 = 50 mph
Observation 4: Both legs had the same speed, so average is also 50 mph ✓

Thought 5: The answer is confirmed.
Action 5: Conclude[answer]: 50 miles per hour
Observation 5: Problem solved successfully.`,

      code_generation: `
EXAMPLE: "Write a function to check if a string is a palindrome"

Thought 1: A palindrome reads the same forwards and backwards. I need to design the approach.
Action 1: Design[algorithm]: Compare string with its reverse
Observation 1: Simple approach identified - reverse and compare

Thought 2: I'll implement this in Python.
Action 2: Implement[function]:
def is_palindrome(s):
    return s == s[::-1]
Observation 2: Basic implementation complete

Thought 3: This doesn't handle case sensitivity or spaces. Let me improve it.
Action 3: Implement[improved function]:
def is_palindrome(s):
    cleaned = ''.join(s.lower().split())
    return cleaned == cleaned[::-1]
Observation 3: Now handles case and spaces

Thought 4: I should test this.
Action 4: Test[code]: is_palindrome("A man a plan a canal Panama")
Observation 4: Returns True ✓

Thought 5: The solution is complete.
Action 5: Document[code]: Add docstring explaining the function
Observation 5: Function is ready for use.`,

      general_qa: `
EXAMPLE: "Why do leaves change color in autumn?"

Thought 1: This is about the biological process in trees during fall. I should explain the science.
Action 1: Research[chlorophyll]: What role does chlorophyll play?
Observation 1: Chlorophyll gives leaves their green color and is essential for photosynthesis

Thought 2: Something must happen to chlorophyll in autumn.
Action 2: Analyze[autumn changes]: What happens to chlorophyll in fall?
Observation 2: Chlorophyll breaks down as days get shorter and temperatures drop

Thought 3: If chlorophyll disappears, other colors must be revealed.
Action 3: Research[other pigments]: What other pigments exist in leaves?
Observation 3: Carotenoids (yellow/orange) and anthocyanins (red/purple) are also present

Thought 4: I should explain why trees do this.
Action 4: Analyze[purpose]: Why do trees stop producing chlorophyll?
Observation 4: Trees reabsorb nutrients from leaves before dropping them to conserve energy for winter

Thought 5: I can now provide a complete answer.
Action 5: Synthesize[explanation]: Combine all observations
Observation 5: Complete explanation ready`,
    }

    return examples[taskType] || examples.general_qa
  }
}
