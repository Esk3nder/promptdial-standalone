/**
 * PromptDial 2.0 - Self-Consistency Handler
 * 
 * Manages multiple LLM calls for self-consistency voting
 */

import {
  PromptVariant,
  createLogger,
  SELF_CONSISTENCY_VOTE_PROMPT
} from '@promptdial/shared'

import { LLMResponse } from './providers/base'
import { LLMRunner } from './index'

const logger = createLogger('self-consistency')

export interface SelfConsistencyResult {
  final_answer: string
  all_responses: LLMResponse[]
  vote_distribution: Record<string, number>
  consensus_score: number
}

export class SelfConsistencyHandler {
  constructor(private runner: LLMRunner) {}
  
  /**
   * Execute self-consistency sampling
   */
  async execute(
    variant: PromptVariant,
    numSamples: number = 3
  ): Promise<SelfConsistencyResult> {
    logger.info(`Running self-consistency with ${numSamples} samples`)
    
    // Extract the number of samples from variant ID if specified
    const sampleMatch = variant.id.match(/_(\d+)samples/)
    if (sampleMatch) {
      numSamples = parseInt(sampleMatch[1])
    }
    
    // Generate multiple responses
    const responses = await this.generateMultipleResponses(variant, numSamples)
    
    // Extract answers from responses
    const answers = responses.map(r => this.extractAnswer(r.content))
    
    // Vote on the most common answer
    const voteResult = await this.performVoting(answers, variant)
    
    // Calculate consensus score
    const consensusScore = this.calculateConsensusScore(voteResult.vote_distribution, numSamples)
    
    return {
      final_answer: voteResult.final_answer,
      all_responses: responses,
      vote_distribution: voteResult.vote_distribution,
      consensus_score: consensusScore
    }
  }
  
  /**
   * Generate multiple responses with different temperatures
   */
  private async generateMultipleResponses(
    variant: PromptVariant,
    numSamples: number
  ): Promise<LLMResponse[]> {
    const responses: LLMResponse[] = []
    const baseTemperature = variant.temperature
    
    // Generate responses in parallel for efficiency
    const promises = []
    
    for (let i = 0; i < numSamples; i++) {
      // Vary temperature slightly for diversity
      const temperature = baseTemperature + (i * 0.1)
      const modifiedVariant = {
        ...variant,
        temperature: Math.min(temperature, 1.5) // Cap at 1.5
      }
      
      promises.push(this.runner.runSingle(modifiedVariant))
    }
    
    try {
      const results = await Promise.all(promises)
      responses.push(...results)
    } catch (error) {
      logger.error('Failed to generate all samples', error as Error)
      // Return whatever we got
    }
    
    return responses
  }
  
  /**
   * Extract the final answer from a response
   */
  private extractAnswer(content: string): string {
    // Look for common answer patterns
    const patterns = [
      /(?:final answer|answer|therefore|thus|conclusion):\s*(.+?)(?:\n|$)/i,
      /(?:the answer is|result is|solution is)\s*(.+?)(?:\n|$)/i,
      /^(?:answer|result|solution):\s*(.+?)(?:\n|$)/im,
      /\*\*(.+?)\*\*/  // Bold text often contains answers
    ]
    
    for (const pattern of patterns) {
      const match = content.match(pattern)
      if (match) {
        return match[1].trim()
      }
    }
    
    // If no pattern matches, try to extract the last line
    const lines = content.trim().split('\n')
    const lastLine = lines[lines.length - 1].trim()
    
    // If last line is short and looks like an answer, use it
    if (lastLine.length < 100 && !lastLine.endsWith('?')) {
      return lastLine
    }
    
    // Otherwise return the full content (voting will handle it)
    return content.trim()
  }
  
  /**
   * Perform voting on the answers
   */
  private async performVoting(
    answers: string[],
    variant: PromptVariant
  ): Promise<{ final_answer: string; vote_distribution: Record<string, number> }> {
    // Count votes for each unique answer
    const voteCount: Record<string, number> = {}
    
    for (const answer of answers) {
      const normalizedAnswer = this.normalizeAnswer(answer)
      voteCount[normalizedAnswer] = (voteCount[normalizedAnswer] || 0) + 1
    }
    
    // Find the most common answer
    let maxVotes = 0
    let mostCommonAnswer = ''
    
    for (const [answer, votes] of Object.entries(voteCount)) {
      if (votes > maxVotes) {
        maxVotes = votes
        mostCommonAnswer = answer
      }
    }
    
    // If there's a tie or low confidence, use LLM to break the tie
    const totalAnswers = answers.length
    const confidenceRatio = maxVotes / totalAnswers
    
    if (confidenceRatio < 0.5 && answers.length > 2) {
      // Use LLM to select the best answer
      const votePrompt = SELF_CONSISTENCY_VOTE_PROMPT.replace(
        '{solutions}',
        answers.map((a, i) => `Solution ${i + 1}: ${a}`).join('\n\n')
      )
      
      const voteVariant: PromptVariant = {
        ...variant,
        prompt: votePrompt,
        temperature: 0 // Deterministic for voting
      }
      
      try {
        const voteResponse = await this.runner.runSingle(voteVariant)
        mostCommonAnswer = this.normalizeAnswer(voteResponse.content)
      } catch (error) {
        logger.error('Vote prompt failed, using simple majority', error as Error)
      }
    }
    
    return {
      final_answer: mostCommonAnswer,
      vote_distribution: voteCount
    }
  }
  
  /**
   * Normalize answer for comparison
   */
  private normalizeAnswer(answer: string): string {
    return answer
      .toLowerCase()
      .trim()
      .replace(/[^\w\s.-]/g, '') // Remove special chars except . and -
      .replace(/\s+/g, ' ') // Normalize whitespace
  }
  
  /**
   * Calculate consensus score (0-1)
   */
  private calculateConsensusScore(
    voteDistribution: Record<string, number>,
    totalSamples: number
  ): number {
    const votes = Object.values(voteDistribution)
    const maxVotes = Math.max(...votes)
    
    // Consensus score is the ratio of the most common answer
    const consensusRatio = maxVotes / totalSamples
    
    // Adjust for the number of unique answers (fewer is better)
    const uniqueAnswers = Object.keys(voteDistribution).length
    const diversityPenalty = (uniqueAnswers - 1) / totalSamples * 0.2
    
    return Math.max(0, consensusRatio - diversityPenalty)
  }
}