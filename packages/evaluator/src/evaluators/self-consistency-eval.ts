/**
 * PromptDial 3.0 - Self-Consistency Evaluator
 *
 * Evaluates response consistency and reliability
 */

import { BaseEvaluator } from './base'
import { PromptVariant, EvaluationResult, TaskClassification, EVALUATORS } from '@promptdial/shared'

export class SelfConsistencyEvaluator extends BaseEvaluator {
  constructor() {
    super({
      name: EVALUATORS.SELF_CONSISTENCY,
      description: 'Evaluates internal consistency and reliability',
      requiresReference: false,
      requiresLLM: false,
    })
  }

  async evaluate(
    variant: PromptVariant,
    response: string,
    taskMeta: TaskClassification,
    references?: string[],
  ): Promise<Partial<EvaluationResult>> {
    // For self-consistency variants, we expect the response to include voting info
    const isConsistencyVariant = variant.technique.includes('consistency')

    if (isConsistencyVariant && response.includes('consensus')) {
      // Extract consensus score if available
      const consensusMatch = response.match(/consensus[:\s]+(\d+\.?\d*)/i)
      if (consensusMatch) {
        const consensusScore = parseFloat(consensusMatch[1])
        return {
          scores: {
            self_consistency: Math.min(1, consensusScore),
          },
        }
      }
    }

    // Otherwise, evaluate internal consistency of the response
    const consistencyScore = this.evaluateInternalConsistency(response, taskMeta)

    return {
      scores: {
        self_consistency: consistencyScore,
      },
    }
  }

  private evaluateInternalConsistency(response: string, taskMeta: TaskClassification): number {
    const factors = {
      logicalConsistency: this.checkLogicalConsistency(response),
      factualConsistency: this.checkFactualConsistency(response),
      structuralConsistency: this.checkStructuralConsistency(response),
      terminologyConsistency: this.checkTerminologyConsistency(response),
    }

    // Weight factors based on task type
    const weights = this.getWeightsForTask(taskMeta.task_type)

    let weightedSum = 0
    let totalWeight = 0

    for (const [factor, score] of Object.entries(factors)) {
      const weight = weights[factor] || 0.25
      weightedSum += score * weight
      totalWeight += weight
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0.5
  }

  private checkLogicalConsistency(response: string): number {
    const sentences = response.split(/[.!?]+/).filter((s) => s.trim())
    if (sentences.length < 2) return 1.0

    let consistencyScore = 1.0

    // Check for contradictory statements
    const contradictionPatterns = [
      /but\s+(?:also|then)\s+(?:not|no)/i,
      /however.*opposite/i,
      /on\s+the\s+other\s+hand.*different/i,
    ]

    for (const pattern of contradictionPatterns) {
      if (pattern.test(response)) {
        consistencyScore -= 0.1
      }
    }

    // Check for consistent use of quantifiers
    const hasAlways = /always|every|all/i.test(response)
    const hasNever = /never|none|no/i.test(response)
    const hasSometimes = /sometimes|some|occasionally/i.test(response)

    if ((hasAlways && hasNever) || (hasAlways && hasSometimes)) {
      consistencyScore -= 0.15
    }

    return Math.max(0, consistencyScore)
  }

  private checkFactualConsistency(response: string): number {
    let score = 1.0

    // Check for consistent numerical values
    const numbers = Array.from(response.matchAll(/\b(\d+(?:\.\d+)?)\b/g))
    const numberMap = new Map<string, Set<string>>()

    // Group numbers by their context (previous 3 words)
    for (const match of numbers) {
      const index = match.index!
      const contextStart = Math.max(0, response.lastIndexOf(' ', index - 20))
      const context = response.slice(contextStart, index).trim()

      if (!numberMap.has(context)) {
        numberMap.set(context, new Set())
      }
      numberMap.get(context)!.add(match[1])
    }

    // Penalize if same context has different numbers
    for (const [context, nums] of numberMap) {
      if (nums.size > 1) {
        score -= 0.2
      }
    }

    // Check for consistent dates/times
    const dates = Array.from(response.matchAll(/\b(\d{4}|\d{1,2}\/\d{1,2}\/\d{2,4})\b/g))
    if (dates.length > 1) {
      const uniqueDates = new Set(dates.map((d) => d[1]))
      if (uniqueDates.size > 1) {
        // Multiple different dates might be intentional, small penalty
        score -= 0.05
      }
    }

    return Math.max(0, score)
  }

  private checkStructuralConsistency(response: string): number {
    const info = this.extractKeyInfo(response)
    let score = 1.0

    // Check if structure is maintained throughout
    if (info.hasStructure) {
      // Count structure markers
      const bulletPoints = (response.match(/^\s*[-*•]/gm) || []).length
      const numberedPoints = (response.match(/^\s*\d+[.)]/gm) || []).length

      // Penalize mixed structures
      if (bulletPoints > 0 && numberedPoints > 0) {
        score -= 0.1
      }

      // Check for incomplete lists
      const listStarters = response.match(/:\s*\n/g) || []
      const listItems = bulletPoints + numberedPoints

      if (listStarters.length > 0 && listItems === 0) {
        score -= 0.2 // Promise of list but no items
      }
    }

    // Check paragraph consistency
    const paragraphs = response.split(/\n\n+/).filter((p) => p.trim())
    if (paragraphs.length > 1) {
      const paragraphLengths = paragraphs.map((p) => p.length)
      const avgLength = paragraphLengths.reduce((a, b) => a + b) / paragraphs.length
      const variance =
        paragraphLengths.reduce((sum, len) => sum + Math.pow(len - avgLength, 2), 0) /
        paragraphs.length

      // High variance in paragraph lengths indicates inconsistency
      if (variance > avgLength * avgLength) {
        score -= 0.1
      }
    }

    return Math.max(0, score)
  }

  private checkTerminologyConsistency(response: string): number {
    let score = 1.0
    const words = response.toLowerCase().split(/\s+/)

    // Common synonym groups to check
    const synonymGroups = [
      ['use', 'utilize', 'employ'],
      ['make', 'create', 'build', 'construct'],
      ['show', 'demonstrate', 'display', 'present'],
      ['important', 'significant', 'crucial', 'vital'],
      ['method', 'approach', 'technique', 'strategy'],
    ]

    for (const group of synonymGroups) {
      const usedSynonyms = group.filter((word) => words.includes(word))
      if (usedSynonyms.length > 1) {
        // Multiple synonyms used - slight inconsistency
        score -= 0.05 * (usedSynonyms.length - 1)
      }
    }

    // Check for consistent technical term usage
    const technicalTerms = response.match(/[A-Z][a-zA-Z]*(?:[A-Z][a-zA-Z]*)*/g) || []
    const termVariants = new Map<string, Set<string>>()

    for (const term of technicalTerms) {
      const normalized = term.toLowerCase()
      if (!termVariants.has(normalized)) {
        termVariants.set(normalized, new Set())
      }
      termVariants.get(normalized)!.add(term)
    }

    // Penalize inconsistent capitalization
    for (const [_, variants] of termVariants) {
      if (variants.size > 1) {
        score -= 0.05
      }
    }

    return Math.max(0, score)
  }

  private getWeightsForTask(taskType: string): Record<string, number> {
    const weights: Record<string, Record<string, number>> = {
      math_reasoning: {
        logicalConsistency: 0.4,
        factualConsistency: 0.4,
        structuralConsistency: 0.1,
        terminologyConsistency: 0.1,
      },
      code_generation: {
        logicalConsistency: 0.3,
        factualConsistency: 0.2,
        structuralConsistency: 0.3,
        terminologyConsistency: 0.2,
      },
      creative_writing: {
        logicalConsistency: 0.2,
        factualConsistency: 0.1,
        structuralConsistency: 0.2,
        terminologyConsistency: 0.5,
      },
      data_analysis: {
        logicalConsistency: 0.3,
        factualConsistency: 0.4,
        structuralConsistency: 0.2,
        terminologyConsistency: 0.1,
      },
    }

    return (
      weights[taskType] || {
        logicalConsistency: 0.25,
        factualConsistency: 0.25,
        structuralConsistency: 0.25,
        terminologyConsistency: 0.25,
      }
    )
  }
}
