/**
 * PromptDial 2.0 - ChatEval Evaluator
 *
 * Multi-turn conversation evaluation
 */

import { BaseEvaluator } from './base'
import { PromptVariant, EvaluationResult, TaskClassification, EVALUATORS } from '@promptdial/shared'
import axios from 'axios'

export class ChatEvalEvaluator extends BaseEvaluator {
  constructor() {
    super({
      name: EVALUATORS.CHAT_EVAL,
      description: 'Multi-turn conversational evaluation',
      requiresReference: false,
      requiresLLM: true,
    })
  }

  async evaluate(
    variant: PromptVariant,
    response: string,
    taskMeta: TaskClassification,
    references?: string[],
  ): Promise<Partial<EvaluationResult>> {
    // Simulate a conversation to probe the response quality
    const probes = this.getProbesForTask(taskMeta.task_type)
    const scores: number[] = []

    for (const probe of probes) {
      const score = await this.evaluateWithProbe(variant.prompt, response, probe, taskMeta)
      scores.push(score)
    }

    // Average probe scores
    const chatEvalScore = scores.reduce((sum, s) => sum + s, 0) / scores.length

    return {
      scores: {
        chat_eval: chatEvalScore,
      },
    }
  }

  private async evaluateWithProbe(
    originalPrompt: string,
    response: string,
    probe: ConversationalProbe,
    taskMeta: TaskClassification,
  ): Promise<number> {
    const probePrompt = this.createProbePrompt(originalPrompt, response, probe)

    const probeVariant: PromptVariant = {
      id: 'chat-eval-probe',
      technique: 'chat-eval',
      prompt: probePrompt,
      temperature: 0.7,
      est_tokens: 300,
      cost_usd: 0.005,
    }

    try {
      // Call LLM Runner service
      const llmRunnerUrl = this.getLLMRunnerUrl()
      const llmResponse = await axios.post(
        `${llmRunnerUrl}/run`,
        {
          variant: probeVariant,
          trace_id: `chat-eval-${Date.now()}`,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      // Evaluate the probe response
      return await this.scoreProbeResponse(llmResponse.data.response, probe, response)
    } catch (error) {
      this.logger.error('ChatEval probe failed', error)
      return 0.5
    }
  }

  private createProbePrompt(
    originalPrompt: string,
    response: string,
    probe: ConversationalProbe,
  ): string {
    return `You are having a conversation about the following topic:

ORIGINAL QUESTION: ${originalPrompt}

INITIAL RESPONSE: ${response}

Now, as a ${probe.role}, ask a follow-up question that ${probe.intent}.

Your follow-up question should:
- Be natural and conversational
- Test ${probe.aspect} of the response
- Be specific and focused

Follow-up question:`
  }

  private async scoreProbeResponse(
    probeQuestion: string,
    probe: ConversationalProbe,
    originalResponse: string,
  ): Promise<number> {
    // Use LLM to judge if the probe reveals issues
    const judgmentPrompt = `Evaluate whether this follow-up question reveals any issues with the original response.

ORIGINAL RESPONSE:
${originalResponse}

FOLLOW-UP QUESTION:
${probeQuestion}

PROBE INTENT: ${probe.intent}
ASPECT TESTED: ${probe.aspect}

Does this follow-up question reveal:
1. Gaps or incompleteness in the original response?
2. Unclear or ambiguous points?
3. Potential errors or inconsistencies?
4. Areas needing more detail?

Rate the original response based on how well it anticipates and addresses such follow-up questions.

RATING SCALE:
- 9-10: Response is so complete that follow-ups are unnecessary
- 7-8: Response is good but has minor gaps the follow-up exposes
- 5-6: Response has moderate issues revealed by the follow-up
- 3-4: Response has significant gaps exposed
- 1-2: Response is severely lacking

RATING: [number 1-10]`

    const judgmentVariant: PromptVariant = {
      id: 'chat-eval-judge',
      technique: 'chat-eval',
      prompt: judgmentPrompt,
      temperature: 0.3,
      est_tokens: 200,
      cost_usd: 0.003,
    }

    try {
      const llmRunnerUrl = this.getLLMRunnerUrl()
      const judgment = await axios.post(
        `${llmRunnerUrl}/run`,
        {
          variant: judgmentVariant,
          trace_id: `chat-eval-judge-${Date.now()}`,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const scoreMatch = judgment.data.response.match(/RATING:\s*(\d+)/i)
      if (scoreMatch) {
        return this.normalizeScore(parseInt(scoreMatch[1]), 1, 10)
      }
    } catch (error) {
      this.logger.error('ChatEval judgment failed', error)
    }

    return 0.7 // Default decent score
  }

  private getProbesForTask(taskType: string): ConversationalProbe[] {
    const baseProbes: ConversationalProbe[] = [
      {
        role: 'curious learner',
        intent: 'seeks clarification on technical terms',
        aspect: 'clarity and accessibility',
      },
      {
        role: 'skeptical reviewer',
        intent: 'questions the assumptions made',
        aspect: 'robustness and completeness',
      },
    ]

    const taskSpecificProbes: Record<string, ConversationalProbe[]> = {
      math_reasoning: [
        {
          role: 'math teacher',
          intent: 'asks about alternative approaches',
          aspect: 'solution completeness',
        },
        {
          role: 'student',
          intent: 'asks why specific steps were taken',
          aspect: 'explanation clarity',
        },
      ],
      code_generation: [
        {
          role: 'code reviewer',
          intent: 'asks about edge cases',
          aspect: 'code robustness',
        },
        {
          role: 'junior developer',
          intent: 'asks about implementation choices',
          aspect: 'code clarity',
        },
      ],
      creative_writing: [
        {
          role: 'editor',
          intent: 'asks about character motivation',
          aspect: 'narrative depth',
        },
        {
          role: 'reader',
          intent: 'asks what happens next',
          aspect: 'story engagement',
        },
      ],
    }

    const specific = taskSpecificProbes[taskType] || []
    return [...baseProbes, ...specific].slice(0, 3) // Limit to 3 probes
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

interface ConversationalProbe {
  role: string
  intent: string
  aspect: string
}
