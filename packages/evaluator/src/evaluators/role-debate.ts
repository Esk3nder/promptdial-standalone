/**
 * PromptDial 2.0 - Role Debate Evaluator
 *
 * Multiple AI agents debate the quality of responses
 */

import { BaseEvaluator } from './base'
import { PromptVariant, EvaluationResult, TaskClassification, EVALUATORS } from '@promptdial/shared'
import axios from 'axios'

export class RoleDebateEvaluator extends BaseEvaluator {
  constructor() {
    super({
      name: EVALUATORS.ROLE_DEBATE,
      description: 'Multi-agent debate evaluation',
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
    const roles = this.getRolesForTask(taskMeta.task_type)

    // Stage 1: Initial critiques from each role
    const critiques = await this.gatherCritiques(variant.prompt, response, roles, taskMeta)

    // Stage 2: Rebuttals and counter-arguments
    const debate = await this.conductDebate(variant.prompt, response, critiques, roles)

    // Stage 3: Final consensus
    const consensus = await this.reachConsensus(variant.prompt, response, debate)

    return {
      scores: {
        role_debate: consensus.score,
      },
    }
  }

  private async gatherCritiques(
    prompt: string,
    response: string,
    roles: DebateRole[],
    taskMeta: TaskClassification,
  ): Promise<RoleCritique[]> {
    const critiques: RoleCritique[] = []

    for (const role of roles) {
      const critique = await this.getCritique(prompt, response, role, taskMeta)
      critiques.push(critique)
    }

    return critiques
  }

  private async getCritique(
    prompt: string,
    response: string,
    role: DebateRole,
    taskMeta: TaskClassification,
  ): Promise<RoleCritique> {
    const critiquePrompt = `You are a ${role.name} with expertise in ${role.expertise}.

Evaluate this response from your perspective:

PROMPT: ${prompt}
RESPONSE: ${response}

TASK CONTEXT:
- Type: ${taskMeta.task_type}
- Domain: ${taskMeta.domain}
- Complexity: ${taskMeta.complexity}

Provide your critique focusing on:
1. ${role.focus}
2. Specific strengths from your perspective
3. Specific weaknesses or concerns
4. Suggested improvements

Format as:
STRENGTHS:
- [List key strengths]

WEAKNESSES:
- [List key weaknesses]

SCORE: [1-10 from your perspective]

IMPROVEMENTS:
- [List specific suggestions]`

    const critiqueVariant: PromptVariant = {
      id: `debate-${role.name}`,
      technique: 'role-debate',
      prompt: critiquePrompt,
      temperature: 0.7,
      est_tokens: 400,
      cost_usd: 0.006,
    }

    try {
      const llmRunnerUrl = this.getLLMRunnerUrl()
      const result = await axios.post(
        `${llmRunnerUrl}/run`,
        {
          variant: critiqueVariant,
          trace_id: `role-debate-critique-${Date.now()}`,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      return {
        role,
        content: result.data.response,
        score: this.extractScoreFromCritique(result.data.response),
      }
    } catch (error) {
      this.logger.error(`Role ${role.name} critique failed`, error)
      return {
        role,
        content: 'Failed to generate critique',
        score: 0.5,
      }
    }
  }

  private async conductDebate(
    prompt: string,
    response: string,
    critiques: RoleCritique[],
    roles: DebateRole[],
  ): Promise<DebateRound[]> {
    const rounds: DebateRound[] = []

    // Each role responds to others' critiques
    for (let i = 0; i < roles.length; i++) {
      const defender = roles[i]
      const otherCritiques = critiques.filter((_, idx) => idx !== i)

      const rebuttal = await this.getRebuttal(prompt, response, defender, otherCritiques)

      rounds.push({
        speaker: defender.name,
        type: 'rebuttal',
        content: rebuttal,
      })
    }

    return rounds
  }

  private async getRebuttal(
    prompt: string,
    response: string,
    defender: DebateRole,
    critiques: RoleCritique[],
  ): Promise<string> {
    const critiquesSummary = critiques
      .map((c) => `${c.role.name}: ${this.summarizeCritique(c.content)}`)
      .join('\n\n')

    const rebuttalPrompt = `You are a ${defender.name} defending the response quality.

Other experts have critiqued the response:
${critiquesSummary}

Original prompt: ${prompt}
Response being evaluated: ${response}

Provide a balanced rebuttal that:
1. Acknowledges valid criticisms
2. Defends against unfair criticisms
3. Provides additional context from your ${defender.expertise} perspective
4. Suggests which criticisms are most/least important

Keep your rebuttal focused and professional.`

    const rebuttalVariant: PromptVariant = {
      id: `debate-rebuttal-${defender.name}`,
      technique: 'role-debate',
      prompt: rebuttalPrompt,
      temperature: 0.6,
      est_tokens: 300,
      cost_usd: 0.005,
    }

    try {
      const llmRunnerUrl = this.getLLMRunnerUrl()
      const result = await axios.post(
        `${llmRunnerUrl}/run`,
        {
          variant: rebuttalVariant,
          trace_id: `role-debate-rebuttal-${Date.now()}`,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )
      return result.data.response
    } catch (error) {
      this.logger.error(`Rebuttal from ${defender.name} failed`, error)
      return 'No rebuttal provided'
    }
  }

  private async reachConsensus(
    prompt: string,
    response: string,
    debate: DebateRound[],
  ): Promise<{ score: number; reasoning: string }> {
    const debateSummary = debate
      .map((round) => `${round.speaker} (${round.type}):\n${round.content}`)
      .join('\n\n---\n\n')

    const consensusPrompt = `You are a neutral moderator synthesizing a debate about response quality.

ORIGINAL PROMPT: ${prompt}
RESPONSE: ${response}

DEBATE SUMMARY:
${debateSummary}

Based on all perspectives shared:
1. What are the universally agreed strengths?
2. What are the valid concerns raised?
3. How significant are the weaknesses compared to strengths?
4. What is the overall consensus on quality?

Provide:
CONSENSUS STRENGTHS:
- [List agreed strengths]

CONSENSUS CONCERNS:
- [List valid concerns]

FINAL SCORE: [1-10 based on balanced consensus]

REASONING: [Brief explanation of the consensus score]`

    const consensusVariant: PromptVariant = {
      id: 'debate-consensus',
      technique: 'role-debate',
      prompt: consensusPrompt,
      temperature: 0.3,
      est_tokens: 400,
      cost_usd: 0.006,
    }

    try {
      const llmRunnerUrl = this.getLLMRunnerUrl()
      const result = await axios.post(
        `${llmRunnerUrl}/run`,
        {
          variant: consensusVariant,
          trace_id: `role-debate-consensus-${Date.now()}`,
        },
        {
          timeout: 30000,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      )

      const scoreMatch = result.data.response.match(/FINAL SCORE:\s*(\d+)/i)
      const score = scoreMatch ? this.normalizeScore(parseInt(scoreMatch[1]), 1, 10) : 0.7

      return {
        score,
        reasoning: result.data.response,
      }
    } catch (error) {
      this.logger.error('Consensus generation failed', error)
      return {
        score: 0.7,
        reasoning: 'Failed to reach consensus',
      }
    }
  }

  private getRolesForTask(taskType: string): DebateRole[] {
    const baseRoles: DebateRole[] = [
      {
        name: 'Quality Assurance Expert',
        expertise: 'response quality and completeness',
        focus: 'accuracy, thoroughness, and clarity',
      },
      {
        name: 'User Experience Specialist',
        expertise: 'user satisfaction and engagement',
        focus: 'readability, helpfulness, and user value',
      },
    ]

    const taskSpecificRoles: Record<string, DebateRole[]> = {
      math_reasoning: [
        {
          name: 'Mathematics Professor',
          expertise: 'mathematical rigor and pedagogy',
          focus: 'correctness, methodology, and explanation quality',
        },
      ],
      code_generation: [
        {
          name: 'Senior Software Engineer',
          expertise: 'code quality and best practices',
          focus: 'functionality, efficiency, and maintainability',
        },
      ],
      creative_writing: [
        {
          name: 'Literary Critic',
          expertise: 'narrative structure and style',
          focus: 'creativity, coherence, and engagement',
        },
      ],
      data_analysis: [
        {
          name: 'Data Scientist',
          expertise: 'statistical analysis and insights',
          focus: 'methodology, accuracy, and actionability',
        },
      ],
    }

    const specific = taskSpecificRoles[taskType] || []
    return [...baseRoles, ...specific]
  }

  private extractScoreFromCritique(critique: string): number {
    const scoreMatch = critique.match(/SCORE:\s*(\d+)/i)
    if (scoreMatch) {
      return this.normalizeScore(parseInt(scoreMatch[1]), 1, 10)
    }
    return 0.5
  }

  private summarizeCritique(critique: string): string {
    // Extract key points from critique
    const lines = critique.split('\n').filter((l) => l.trim())
    const weaknessStart = lines.findIndex((l) => /WEAKNESSES?:/i.test(l))

    if (weaknessStart >= 0) {
      const weaknesses = lines
        .slice(weaknessStart + 1, weaknessStart + 4)
        .filter((l) => l.startsWith('-'))
        .join(' ')
      return weaknesses || 'General concerns about quality'
    }

    return critique.slice(0, 200) + '...'
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

interface DebateRole {
  name: string
  expertise: string
  focus: string
}

interface RoleCritique {
  role: DebateRole
  content: string
  score: number
}

interface DebateRound {
  speaker: string
  type: 'critique' | 'rebuttal' | 'synthesis'
  content: string
}
