/**
 * PromptDial 2.0 - G-EVAL Evaluator
 * 
 * LLM-based evaluation using chain-of-thought scoring
 */

import { BaseEvaluator } from './base'
import {
  PromptVariant,
  EvaluationResult,
  TaskClassification,
  EVALUATORS
} from '@promptdial/shared'
import axios from 'axios'

export class GEvalEvaluator extends BaseEvaluator {
  constructor() {
    super({
      name: EVALUATORS.G_EVAL,
      description: 'LLM-based evaluation with CoT scoring',
      requiresReference: false,
      requiresLLM: true
    })
  }
  
  async evaluate(
    variant: PromptVariant,
    response: string,
    taskMeta: TaskClassification,
    references?: string[]
  ): Promise<Partial<EvaluationResult>> {
    const criteria = this.getCriteriaForTask(taskMeta.task_type)
    const scores: Record<string, number> = {}
    
    // Evaluate each criterion
    for (const criterion of criteria) {
      const score = await this.evaluateCriterion(
        variant.prompt,
        response,
        criterion,
        taskMeta
      )
      scores[criterion.name] = score
    }
    
    // Calculate overall score
    const overallScore = Object.values(scores).reduce((sum, s) => sum + s, 0) / criteria.length
    
    return {
      scores: {
        g_eval: overallScore,
        ...scores
      }
    }
  }
  
  private async evaluateCriterion(
    prompt: string,
    response: string,
    criterion: EvaluationCriterion,
    taskMeta: TaskClassification
  ): Promise<number> {
    const evalPrompt = this.createEvaluationPrompt(prompt, response, criterion, taskMeta)
    
    const evalVariant: PromptVariant = {
      id: 'g-eval',
      technique: 'g-eval',
      prompt: evalPrompt,
      temperature: 0.3, // Lower temperature for more consistent evaluation
      est_tokens: 500,
      cost_usd: 0.01
    }
    
    try {
      // Call LLM Runner service
      const llmRunnerUrl = this.getLLMRunnerUrl()
      const response = await axios.post(`${llmRunnerUrl}/run`, {
        variant: evalVariant,
        trace_id: `eval-${Date.now()}`
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      // Extract score from response
      return this.extractScore(response.data.response)
    } catch (error) {
      this.logger.error('G-EVAL failed', error)
      return 0.5 // Default middle score on error
    }
  }
  
  private createEvaluationPrompt(
    prompt: string,
    response: string,
    criterion: EvaluationCriterion,
    taskMeta: TaskClassification
  ): string {
    return `You are an expert evaluator. Rate the following response on ${criterion.name}.

ORIGINAL PROMPT:
${prompt}

RESPONSE TO EVALUATE:
${response}

EVALUATION CRITERION: ${criterion.name}
${criterion.description}

SCORING RUBRIC:
${criterion.rubric}

TASK CONTEXT:
- Task Type: ${taskMeta.task_type}
- Domain: ${taskMeta.domain}
- Complexity: ${taskMeta.complexity}

Please evaluate step-by-step:
1. Analyze how well the response addresses the criterion
2. Identify specific strengths and weaknesses
3. Consider the task context
4. Assign a score from 1-10

Format your response as:
ANALYSIS: [Your step-by-step analysis]
SCORE: [Single number 1-10]
JUSTIFICATION: [Brief explanation of the score]`
  }
  
  private extractScore(response: string): number {
    // Look for score pattern
    const scoreMatch = response.match(/SCORE:\s*(\d+(?:\.\d+)?)/i)
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[1])
      return this.normalizeScore(score, 1, 10)
    }
    
    // Fallback: look for any number 1-10
    const numberMatch = response.match(/\b([1-9]|10)\b/)
    if (numberMatch) {
      const score = parseInt(numberMatch[1])
      return this.normalizeScore(score, 1, 10)
    }
    
    // Default if no score found
    return 0.5
  }
  
  private getCriteriaForTask(taskType: string): EvaluationCriterion[] {
    const baseCriteria: EvaluationCriterion[] = [
      {
        name: 'relevance',
        description: 'How well the response addresses the prompt',
        rubric: `
1-3: Off-topic or barely addresses the prompt
4-6: Partially addresses the prompt with gaps
7-8: Addresses most aspects of the prompt well
9-10: Fully addresses all aspects excellently`
      },
      {
        name: 'coherence',
        description: 'Logical flow and organization',
        rubric: `
1-3: Disorganized, hard to follow
4-6: Some organization but lacks flow
7-8: Well-organized with good flow
9-10: Exceptional organization and clarity`
      },
      {
        name: 'completeness',
        description: 'Thoroughness of the response',
        rubric: `
1-3: Missing major components
4-6: Covers basics but lacks depth
7-8: Comprehensive coverage
9-10: Exhaustive and insightful`
      }
    ]
    
    // Add task-specific criteria
    const taskSpecific: Record<string, EvaluationCriterion[]> = {
      math_reasoning: [{
        name: 'correctness',
        description: 'Mathematical accuracy',
        rubric: `
1-3: Incorrect approach or major errors
4-6: Right approach but computational errors
7-8: Mostly correct with minor issues
9-10: Perfectly correct`
      }],
      code_generation: [{
        name: 'functionality',
        description: 'Code correctness and efficiency',
        rubric: `
1-3: Non-functional or major bugs
4-6: Works but inefficient or edge cases
7-8: Good implementation
9-10: Optimal and robust`
      }],
      creative_writing: [{
        name: 'creativity',
        description: 'Originality and engagement',
        rubric: `
1-3: Generic and uninspiring
4-6: Some creative elements
7-8: Creative and engaging
9-10: Exceptionally original`
      }]
    }
    
    const specific = taskSpecific[taskType] || []
    return [...baseCriteria, ...specific]
  }
  
  private getLLMRunnerUrl(): string {
    // Check which API keys are available
    if (process.env.OPENAI_API_KEY) {
      return process.env.OPENAI_RUNNER_URL || 'http://localhost:4001'
    }
    if (process.env.ANTHROPIC_API_KEY) {
      return process.env.ANTHROPIC_RUNNER_URL || 'http://localhost:4002'
    }
    if (process.env.GOOGLE_AI_API_KEY) {
      return process.env.GOOGLE_RUNNER_URL || 'http://localhost:4003'
    }
    throw new Error('No LLM provider configured')
  }
}

interface EvaluationCriterion {
  name: string
  description: string
  rubric: string
}