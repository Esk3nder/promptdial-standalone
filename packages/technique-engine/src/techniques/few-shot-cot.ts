/**
 * PromptDial 2.0 - Few-Shot Chain-of-Thought Technique
 * 
 * Combines few-shot learning with step-by-step reasoning
 */

import { BaseTechnique } from './base'
import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TECHNIQUES
} from '@promptdial/shared'

interface Example {
  question: string
  reasoning: string
  answer: string
}

export class FewShotCoTTechnique extends BaseTechnique {
  name = TECHNIQUES.FEW_SHOT_COT
  description = 'Few-shot learning with chain-of-thought reasoning'
  best_for = ['math_reasoning', 'code_generation', 'data_analysis'] as const
  needs_retrieval = false
  
  private examples: Record<string, Example[]> = {
    math_reasoning: [
      {
        question: 'If a train travels 120 miles in 2 hours, what is its average speed?',
        reasoning: `Let me solve this step by step:
1. Distance traveled = 120 miles
2. Time taken = 2 hours
3. Average speed = Distance ÷ Time
4. Average speed = 120 miles ÷ 2 hours = 60 miles/hour`,
        answer: '60 miles per hour'
      },
      {
        question: 'A rectangle has a length of 8 cm and width of 5 cm. What is its area?',
        reasoning: `Let me calculate the area step by step:
1. Length of rectangle = 8 cm
2. Width of rectangle = 5 cm
3. Area of rectangle = Length × Width
4. Area = 8 cm × 5 cm = 40 cm²`,
        answer: '40 square centimeters'
      },
      {
        question: 'If x + 7 = 15, what is the value of x?',
        reasoning: `Let me solve for x step by step:
1. Starting equation: x + 7 = 15
2. Subtract 7 from both sides: x + 7 - 7 = 15 - 7
3. Simplify: x = 8
4. Verify: 8 + 7 = 15 ✓`,
        answer: 'x = 8'
      }
    ],
    code_generation: [
      {
        question: 'Write a function to check if a number is prime',
        reasoning: `Let me think through this step by step:
1. A prime number is only divisible by 1 and itself
2. We need to check if any number from 2 to sqrt(n) divides n
3. Special cases: numbers less than 2 are not prime
4. We can optimize by only checking up to sqrt(n)`,
        answer: `def is_prime(n):
    if n < 2:
        return False
    for i in range(2, int(n**0.5) + 1):
        if n % i == 0:
            return False
    return True`
      },
      {
        question: 'Create a function to reverse a string',
        reasoning: `Let me approach this step by step:
1. We need to reverse the order of characters
2. Python provides slicing with negative step
3. Alternative: convert to list, reverse, join back
4. The simplest approach is string slicing`,
        answer: `def reverse_string(s):
    return s[::-1]
    
# Alternative approach:
def reverse_string_alt(s):
    return ''.join(reversed(s))`
      }
    ],
    general_qa: [
      {
        question: 'What causes the seasons on Earth?',
        reasoning: `Let me explain this step by step:
1. Earth orbits the Sun in an elliptical path
2. Earth's axis is tilted at about 23.5 degrees
3. This tilt remains constant as Earth orbits
4. Different parts receive different amounts of direct sunlight
5. More direct sunlight = warmer temperatures = summer
6. Less direct sunlight = cooler temperatures = winter`,
        answer: `The seasons are caused by Earth's axial tilt of 23.5 degrees combined with its orbit around the Sun. This tilt causes different parts of Earth to receive varying amounts of direct sunlight throughout the year, creating seasonal temperature variations.`
      }
    ]
  }
  
  async generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = []
    
    // Get relevant examples for the task type
    const taskExamples = this.getExamplesForTask(meta.task_type)
    
    // Variant 1: Basic Few-Shot CoT
    const basicPrompt = this.createBasicFewShotCoT(base_prompt, taskExamples)
    const variant1 = this.createVariant(
      this.sandwichPrompt(basicPrompt),
      `${this.name}_basic`,
      0.7,
      0
    )
    
    if (this.fitsInBudget(variant1, budget)) {
      variants.push(variant1)
    }
    
    // Variant 2: Extended Few-Shot CoT with more examples
    if (budget.remaining_cost_usd > variant1.cost_usd * 2) {
      const extendedPrompt = this.createExtendedFewShotCoT(
        base_prompt, 
        taskExamples,
        meta.complexity
      )
      const variant2 = this.createVariant(
        this.sandwichPrompt(extendedPrompt),
        `${this.name}_extended`,
        0.7,
        1
      )
      
      if (this.fitsInBudget(variant2, budget)) {
        variants.push(variant2)
      }
    }
    
    // Variant 3: Few-Shot CoT with explicit format
    if (budget.remaining_cost_usd > variant1.cost_usd * 1.5) {
      const formattedPrompt = this.createFormattedFewShotCoT(
        base_prompt,
        taskExamples
      )
      const variant3 = this.createVariant(
        this.sandwichPrompt(formattedPrompt),
        `${this.name}_formatted`,
        0.5, // Lower temperature for structured output
        2
      )
      
      if (this.fitsInBudget(variant3, budget)) {
        variants.push(variant3)
      }
    }
    
    return variants
  }
  
  private getExamplesForTask(taskType: string): Example[] {
    // Return task-specific examples or general ones as fallback
    return this.examples[taskType] || this.examples.general_qa || []
  }
  
  private createBasicFewShotCoT(
    basePrompt: string,
    examples: Example[]
  ): string {
    const exampleSection = examples
      .slice(0, 2) // Use 2 examples for basic variant
      .map(ex => `Q: ${ex.question}\nA: Let's think step by step.\n${ex.reasoning}\nTherefore, ${ex.answer}`)
      .join('\n\n')
    
    return `Here are some examples of solving problems step by step:

${exampleSection}

Now, please solve this problem following the same approach:

Q: ${basePrompt}
A: Let's think step by step.`
  }
  
  private createExtendedFewShotCoT(
    basePrompt: string,
    examples: Example[],
    complexity: number
  ): string {
    // Use more examples for complex tasks
    const numExamples = complexity > 0.7 ? 3 : 2
    
    const exampleSection = examples
      .slice(0, numExamples)
      .map((ex, i) => `Example ${i + 1}:
Q: ${ex.question}
Step-by-step reasoning:
${ex.reasoning}
Final answer: ${ex.answer}`)
      .join('\n\n')
    
    const complexityHint = complexity > 0.7
      ? '\nThis appears to be a complex problem, so please be especially thorough in your reasoning.'
      : ''
    
    return `I'll help you solve this problem using detailed step-by-step reasoning.

${exampleSection}

Now for your question:
Q: ${basePrompt}

Please provide:
1. Step-by-step reasoning (be thorough)
2. Clear explanation of each step
3. Final answer${complexityHint}`
  }
  
  private createFormattedFewShotCoT(
    basePrompt: string,
    examples: Example[]
  ): string {
    const exampleSection = examples
      .slice(0, 1) // One detailed example
      .map(ex => `Question: ${ex.question}

REASONING:
${ex.reasoning}

ANSWER: ${ex.answer}`)
      .join('\n\n---\n\n')
    
    return `Please solve the following problem using this structured format:

${exampleSection}

---

Now solve this problem using the same format:

Question: ${basePrompt}

REASONING:
[Provide step-by-step reasoning here]

ANSWER:
[Provide the final answer here]`
  }
}