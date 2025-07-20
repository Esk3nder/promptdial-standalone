/**
 * PromptDial 2.0 - Prompt Sanitizer
 * 
 * Cleans and rewrites prompts for safety
 */

import {
  createLogger
} from '@promptdial/shared'

import {
  SecurityPattern,
  ALL_SECURITY_PATTERNS,
  PATTERN_CATEGORIES,
  PatternCategory
} from './patterns'

const logger = createLogger('sanitizer')

export interface SanitizationResult {
  original: string
  sanitized: string
  modified: boolean
  violations: ViolationDetail[]
  risk_score: number
}

export interface ViolationDetail {
  pattern_id: string
  pattern_name: string
  severity: string
  category: PatternCategory
  action_taken: 'blocked' | 'sanitized' | 'warned'
  match?: string
}

export class PromptSanitizer {
  private patterns: SecurityPattern[]
  private maxPromptLength = 10000
  private enabledCategories: Set<PatternCategory>
  
  constructor(config?: {
    patterns?: SecurityPattern[]
    enabledCategories?: PatternCategory[]
    maxPromptLength?: number
  }) {
    this.patterns = config?.patterns || ALL_SECURITY_PATTERNS
    this.maxPromptLength = config?.maxPromptLength || 10000
    
    // By default, enable all categories
    this.enabledCategories = new Set(
      config?.enabledCategories || Object.keys(PATTERN_CATEGORIES) as PatternCategory[]
    )
  }
  
  /**
   * Sanitize a prompt and return the result
   */
  sanitize(prompt: string): SanitizationResult {
    let sanitized = prompt
    const violations: ViolationDetail[] = []
    let modified = false
    
    // First, check length
    if (prompt.length > this.maxPromptLength) {
      sanitized = prompt.substring(0, this.maxPromptLength) + '... [TRUNCATED]'
      modified = true
      violations.push({
        pattern_id: 'max-length',
        pattern_name: 'Maximum Length Exceeded',
        severity: 'medium',
        category: 'context_manipulation',
        action_taken: 'sanitized'
      })
    }
    
    // Check each pattern
    for (const pattern of this.patterns) {
      const category = this.getPatternCategory(pattern)
      
      // Skip if category is disabled
      if (!this.enabledCategories.has(category)) {
        continue
      }
      
      const violation = this.checkPattern(sanitized, pattern)
      
      if (violation) {
        violations.push({
          ...violation,
          category
        })
        
        // Apply action based on pattern
        switch (pattern.action) {
          case 'block':
            // For blocking patterns, we'll let the caller handle it
            // but we still return the original prompt
            break
            
          case 'sanitize':
            const result = this.applySanitization(sanitized, pattern)
            if (result !== sanitized) {
              sanitized = result
              modified = true
            }
            break
            
          case 'warn':
            // Warnings don't modify the prompt
            break
        }
      }
    }
    
    // Calculate risk score
    const riskScore = this.calculateRiskScore(violations)
    
    return {
      original: prompt,
      sanitized,
      modified,
      violations,
      risk_score: riskScore
    }
  }
  
  /**
   * Check if prompt should be blocked entirely
   */
  shouldBlock(result: SanitizationResult): boolean {
    // Block if any critical violations with block action
    return result.violations.some(v => 
      v.severity === 'critical' && v.action_taken === 'blocked'
    )
  }
  
  /**
   * Get a safe error message for blocked prompts
   */
  getBlockMessage(violations: ViolationDetail[]): string {
    const criticalViolations = violations.filter(v => v.severity === 'critical')
    
    if (criticalViolations.length > 0) {
      return 'Your request contains content that violates our safety guidelines and cannot be processed.'
    }
    
    const highViolations = violations.filter(v => v.severity === 'high')
    if (highViolations.length > 0) {
      return 'Your request contains potentially harmful content. Please rephrase and try again.'
    }
    
    return 'Your request has been flagged for safety review. Please modify and resubmit.'
  }
  
  private checkPattern(text: string, pattern: SecurityPattern): ViolationDetail | null {
    let matches = false
    let matchText: string | undefined
    
    if (pattern.pattern instanceof RegExp) {
      const match = text.match(pattern.pattern)
      if (match) {
        matches = true
        matchText = match[0]
      }
    } else if (typeof pattern.pattern === 'function') {
      matches = pattern.pattern(text)
      if (matches) {
        matchText = text.substring(0, 100) + '...'
      }
    }
    
    if (matches) {
      logger.warn(`Security pattern matched: ${pattern.name}`, {
        pattern_id: pattern.id,
        severity: pattern.severity,
        match: matchText?.substring(0, 50)
      })
      
      return {
        pattern_id: pattern.id,
        pattern_name: pattern.name,
        severity: pattern.severity,
        category: 'prompt_injection', // Will be overridden
        action_taken: pattern.action === 'block' ? 'blocked' : 
                     pattern.action === 'sanitize' ? 'sanitized' : 'warned',
        match: matchText
      }
    }
    
    return null
  }
  
  private applySanitization(text: string, pattern: SecurityPattern): string {
    if (!pattern.replacement) {
      return text
    }
    
    if (pattern.pattern instanceof RegExp) {
      if (typeof pattern.replacement === 'string') {
        return text.replace(pattern.pattern, pattern.replacement)
      } else if (typeof pattern.replacement === 'function') {
        return text.replace(pattern.pattern, pattern.replacement)
      }
    } else if (typeof pattern.pattern === 'function' && typeof pattern.replacement === 'function') {
      // For function patterns with function replacements
      // we apply the replacement to the entire text
      return pattern.replacement(text)
    }
    
    return text
  }
  
  private getPatternCategory(pattern: SecurityPattern): PatternCategory {
    for (const [category, patterns] of Object.entries(PATTERN_CATEGORIES)) {
      if (patterns.includes(pattern)) {
        return category as PatternCategory
      }
    }
    return 'prompt_injection' // Default
  }
  
  private calculateRiskScore(violations: ViolationDetail[]): number {
    if (violations.length === 0) {
      return 0
    }
    
    const severityScores = {
      low: 0.2,
      medium: 0.4,
      high: 0.7,
      critical: 1.0
    }
    
    let totalScore = 0
    let maxScore = 0
    
    for (const violation of violations) {
      const score = severityScores[violation.severity as keyof typeof severityScores] || 0
      totalScore += score
      maxScore = Math.max(maxScore, score)
    }
    
    // Risk score is a combination of max severity and total violations
    const averageScore = totalScore / violations.length
    const riskScore = maxScore * 0.7 + averageScore * 0.3
    
    return Math.min(1, riskScore)
  }
  
  /**
   * Rewrite prompt for additional safety
   */
  rewriteForSafety(prompt: string, context?: {
    task_type?: string
    previous_violations?: ViolationDetail[]
  }): string {
    let rewritten = prompt
    
    // Add safety prefixes for certain task types
    if (context?.task_type === 'code_generation') {
      rewritten = `Please provide safe, secure, and ethical code. ${rewritten}`
    }
    
    // Add clarification if previous violations
    if (context?.previous_violations && context.previous_violations.length > 0) {
      rewritten = `Please note: I can only help with safe and appropriate requests. ${rewritten}`
    }
    
    // Add general safety suffix
    if (!rewritten.includes('safe') && !rewritten.includes('appropriate')) {
      rewritten += '\n\nPlease ensure the response is safe and appropriate.'
    }
    
    return rewritten
  }
}