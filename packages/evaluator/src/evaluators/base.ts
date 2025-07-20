/**
 * PromptDial 2.0 - Base Evaluator
 * 
 * Abstract base class for all evaluation methods
 */

import {
  PromptVariant,
  EvaluationResult,
  TaskClassification,
  createLogger
} from '@promptdial/shared'

export interface EvaluatorConfig {
  name: string
  description: string
  requiresReference?: boolean
  requiresLLM?: boolean
}

export abstract class BaseEvaluator {
  protected logger: any
  
  constructor(protected config: EvaluatorConfig) {
    this.logger = createLogger(`evaluator-${config.name}`)
  }
  
  /**
   * Evaluate a prompt variant
   */
  abstract evaluate(
    variant: PromptVariant,
    response: string,
    taskMeta: TaskClassification,
    references?: string[]
  ): Promise<Partial<EvaluationResult>>
  
  /**
   * Get evaluator name
   */
  getName(): string {
    return this.config.name
  }
  
  /**
   * Check if evaluator needs reference answers
   */
  requiresReference(): boolean {
    return this.config.requiresReference || false
  }
  
  /**
   * Check if evaluator needs LLM calls
   */
  requiresLLM(): boolean {
    return this.config.requiresLLM || false
  }
  
  /**
   * Normalize score to 0-1 range
   */
  protected normalizeScore(score: number, min: number = 0, max: number = 100): number {
    return Math.max(0, Math.min(1, (score - min) / (max - min)))
  }
  
  /**
   * Calculate similarity between two strings
   */
  protected calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim()
    const s2 = str2.toLowerCase().trim()
    
    if (s1 === s2) return 1.0
    
    // Jaccard similarity on word level
    const words1 = new Set(s1.split(/\s+/))
    const words2 = new Set(s2.split(/\s+/))
    
    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])
    
    return intersection.size / union.size
  }
  
  /**
   * Extract key information from response
   */
  protected extractKeyInfo(response: string): {
    hasStructure: boolean
    hasExamples: boolean
    hasReasoning: boolean
    wordCount: number
    sentenceCount: number
  } {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0)
    const words = response.split(/\s+/).filter(w => w.length > 0)
    
    return {
      hasStructure: /\d+[.)]\s|\n[-*]\s|first|second|finally/i.test(response),
      hasExamples: /for example|such as|like|instance/i.test(response),
      hasReasoning: /because|therefore|thus|since|as a result/i.test(response),
      wordCount: words.length,
      sentenceCount: sentences.length
    }
  }
}