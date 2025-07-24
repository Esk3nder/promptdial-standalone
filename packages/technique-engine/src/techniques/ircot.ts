/**
 * PromptDial 2.0 - IRCoT (Interleaved Retrieval Chain of Thought) Technique
 *
 * Combines retrieval-augmented generation with chain-of-thought reasoning
 */

import { BaseTechnique } from './base'
import {
  PromptVariant,
  TaskClassification,
  BudgetConstraints,
  TECHNIQUES,
} from '@promptdial/shared'

export class IRCoTTechnique extends BaseTechnique {
  name = TECHNIQUES.IRCOT
  description = 'Interleaved retrieval with chain-of-thought reasoning'
  best_for = ['data_analysis', 'general_qa', 'summarization'] as const
  needs_retrieval = true // This technique requires retrieval

  async generate(
    base_prompt: string,
    meta: TaskClassification,
    budget: BudgetConstraints,
  ): Promise<PromptVariant[]> {
    const variants: PromptVariant[] = []

    // IRCoT requires retrieval infrastructure
    if (!meta.needs_retrieval) {
      // If the task doesn't naturally need retrieval, skip this technique
      return []
    }

    // Variant 1: Basic IRCoT
    const basicPrompt = this.createBasicIRCoT(base_prompt, meta)
    const variant1 = this.createVariant(
      this.sandwichPrompt(basicPrompt),
      `${this.name}_basic`,
      0.7,
      0,
    )

    if (this.fitsInBudget(variant1, budget)) {
      variants.push(variant1)
    }

    // Variant 2: Structured IRCoT with explicit retrieval steps
    const structuredPrompt = this.createStructuredIRCoT(base_prompt, meta)
    const variant2 = this.createVariant(
      this.sandwichPrompt(structuredPrompt),
      `${this.name}_structured`,
      0.6,
      1,
    )

    if (this.fitsInBudget(variant2, budget)) {
      variants.push(variant2)
    }

    // Variant 3: Multi-hop IRCoT for complex queries
    if (meta.complexity > 0.6) {
      const multiHopPrompt = this.createMultiHopIRCoT(base_prompt, meta)
      const variant3 = this.createVariant(
        this.sandwichPrompt(multiHopPrompt),
        `${this.name}_multihop`,
        0.7,
        2,
      )
      variant3.cost_usd *= 1.5 // Multi-hop is more expensive

      if (this.fitsInBudget(variant3, budget)) {
        variants.push(variant3)
      }
    }

    return variants
  }

  private createBasicIRCoT(basePrompt: string, meta: TaskClassification): string {
    return `Answer this question using Interleaved Retrieval Chain of Thought:

${basePrompt}

PROCESS:
1. Identify what information you need to retrieve
2. [RETRIEVE: query] - System will provide relevant documents
3. Reason through the retrieved information step by step
4. If you need more information, repeat steps 2-3
5. Synthesize your findings into a final answer

Begin by identifying what information would help answer this question.

Note: When you write [RETRIEVE: your query here], the system will search for and provide relevant information.`
  }

  private createStructuredIRCoT(basePrompt: string, meta: TaskClassification): string {
    const retrievalStrategy = this.getRetrievalStrategy(meta.task_type)

    return `Use Structured IRCoT to solve:

${basePrompt}

RETRIEVAL STRATEGY for ${meta.task_type}:
${retrievalStrategy}

FORMAT YOUR RESPONSE:

INITIAL ANALYSIS:
- Key concepts to research: [list them]
- Information gaps: [what you need to know]

RETRIEVAL ROUND 1:
Query: [RETRIEVE: your first search query]
Retrieved Information: [system will fill this]
Analysis: [what you learned]

REASONING STEP 1:
[Use the retrieved information to reason about the problem]

RETRIEVAL ROUND 2 (if needed):
Query: [RETRIEVE: refined search based on Round 1]
Retrieved Information: [system will fill this]
Analysis: [new insights]

REASONING STEP 2:
[Integrate new information with previous reasoning]

SYNTHESIS:
[Combine all retrieved information and reasoning into a comprehensive answer]

FINAL ANSWER:
[Your conclusion based on retrieved evidence]`
  }

  private createMultiHopIRCoT(basePrompt: string, meta: TaskClassification): string {
    return `Solve this complex query using Multi-Hop IRCoT:

${basePrompt}

MULTI-HOP REASONING PROTOCOL:

Step 1 - Decompose the Question:
Break down the question into sub-questions that each require different information.

Step 2 - Initial Retrieval:
[RETRIEVE: broad query about the main topic]
Analyze what you found and identify follow-up questions.

Step 3 - Targeted Retrieval:
Based on initial findings, perform targeted searches:
[RETRIEVE: specific aspect 1]
[RETRIEVE: specific aspect 2]

Step 4 - Connect the Dots:
Show how the different pieces of retrieved information relate to each other.

Step 5 - Deep Dive (if needed):
If connections reveal new questions:
[RETRIEVE: follow-up query based on connections]

Step 6 - Comprehensive Synthesis:
Integrate all retrieved information through step-by-step reasoning.

Remember:
- Each retrieval should build on previous findings
- Show clear reasoning between retrieval steps
- Cite which retrieved information supports each conclusion`
  }

  private getRetrievalStrategy(taskType: string): string {
    const strategies: Record<string, string> = {
      data_analysis: `
1. First retrieve: Dataset descriptions and metadata
2. Second retrieve: Analysis methods and best practices
3. Third retrieve: Similar analyses or benchmarks
4. Focus on: Statistical validity and interpretation`,

      general_qa: `
1. First retrieve: Core concepts and definitions
2. Second retrieve: Current research or authoritative sources
3. Third retrieve: Examples and applications
4. Focus on: Accuracy and comprehensiveness`,

      summarization: `
1. First retrieve: Full source documents
2. Second retrieve: Context and background
3. Third retrieve: Related summaries or analyses
4. Focus on: Key points and coherent narrative`,

      creative_writing: `
1. First retrieve: Genre conventions and examples
2. Second retrieve: Thematic elements and techniques
3. Third retrieve: Inspiration and references
4. Focus on: Originality within conventions`,

      math_reasoning: `
1. First retrieve: Relevant formulas and theorems
2. Second retrieve: Similar solved problems
3. Third retrieve: Mathematical proofs or derivations
4. Focus on: Correct application of principles`,

      code_generation: `
1. First retrieve: API documentation and examples
2. Second retrieve: Best practices and patterns
3. Third retrieve: Similar implementations
4. Focus on: Correctness and efficiency`,
    }

    return strategies[taskType] || strategies.general_qa
  }
}

/**
 * Helper prompt for the Retrieval Hub to understand IRCoT queries
 */
export const IRCOT_RETRIEVAL_INSTRUCTION = `
You are supporting an IRCoT (Interleaved Retrieval Chain of Thought) process.

When you see [RETRIEVE: query], you should:
1. Search for information relevant to the query
2. Return the most relevant passages
3. Include source citations when available
4. Prioritize factual, authoritative sources

The model will use your retrieved information to continue its reasoning process.
`
