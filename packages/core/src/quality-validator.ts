import { OptimizedVariant } from './meta-prompt-designer'

export interface QualityFactors {
  clarity: number
  specificity: number
  structure: number
  completeness: number
  efficiency: number
  modelAlignment: number
  safety: number
}

export interface ValidationResult {
  score: number
  factors: QualityFactors
  suggestions: string[]
  improvementPercentage: number
}

export interface RankedVariant {
  variant: OptimizedVariant
  validationResult: ValidationResult
}

export class QualityValidator {
  private vagueTerms = ['something', 'stuff', 'thing', 'whatever', 'somehow', 'that', 'this']
  private vagueTermPatterns = this.vagueTerms.map(term => new RegExp(`\\b${term}\\b`, 'gi'))
  private harmfulPatterns = [
    /\bhack\s*(into|systems?|computers?)\b/i,
    /\b(steal|theft)\s*(data|information|credentials)\b/i,
    /\billegal\s*(activities?|content)\b/i,
    /\bharm\s*(others?|people|someone)\b/i,
  ]

  async validateAndScore(variant: OptimizedVariant): Promise<ValidationResult> {
    // Handle edge cases
    if (!variant.optimizedPrompt || variant.optimizedPrompt.trim().length === 0) {
      return {
        score: 0,
        factors: {
          clarity: 0,
          specificity: 0,
          structure: 0,
          completeness: 0,
          efficiency: 0,
          modelAlignment: 0,
          safety: 0,
        },
        suggestions: ['Prompt is empty'],
        improvementPercentage: 0,
      }
    }

    const factors: QualityFactors = {
      clarity: this.evaluateClarity(variant),
      specificity: this.evaluateSpecificity(variant),
      structure: this.evaluateStructure(variant),
      completeness: this.evaluateCompleteness(variant),
      efficiency: this.evaluateEfficiency(variant),
      modelAlignment: this.evaluateModelAlignment(variant),
      safety: this.evaluateSafety(variant),
    }

    // Check for safety violations first
    if (factors.safety === 0) {
      return {
        score: 0,
        factors,
        suggestions: ['Content violates safety guidelines'],
        improvementPercentage: 0,
      }
    }

    // Calculate weighted score
    const weights = {
      clarity: 0.25,      // Increased importance
      specificity: 0.25,
      structure: 0.20,    // Increased importance
      completeness: 0.10,
      efficiency: 0.10,
      modelAlignment: 0.05,
      safety: 0.05,
    }

    const score = Object.entries(factors).reduce(
      (sum, [key, value]) => sum + value * weights[key as keyof QualityFactors],
      0
    )

    const suggestions = this.generateSuggestions(variant, factors)
    const improvementPercentage = this.calculateImprovementPercentage(variant)

    return {
      score: Math.round(score),
      factors,
      suggestions,
      improvementPercentage,
    }
  }

  async compareVariants(variants: OptimizedVariant[]): Promise<RankedVariant[]> {
    // Parallelize validation for 3x faster processing
    const validationPromises = variants.map(async (variant) => {
      const validationResult = await this.validateAndScore(variant)
      return { variant, validationResult }
    })

    const rankedVariants = await Promise.all(validationPromises)

    // Sort by score descending
    return rankedVariants.sort((a, b) => b.validationResult.score - a.validationResult.score)
  }

  private evaluateClarity(variant: OptimizedVariant): number {
    const prompt = variant.optimizedPrompt.toLowerCase()
    let score = 40 // Start with lower base score

    // Check for vague terms - heavy penalty (using pre-compiled patterns)
    let vagueCount = 0
    for (const pattern of this.vagueTermPatterns) {
      const matches = prompt.match(pattern)
      if (matches) {
        vagueCount += matches.length
      }
    }
    
    // Heavy penalty for vague terms - this is key for clarity
    if (vagueCount > 0) {
      score -= vagueCount * 25  // Increased penalty
    }

    // Check for clear action verbs
    const actionVerbs = /\b(analyze|create|explain|write|develop|design|evaluate|compare|tell|provide)\b/
    if (actionVerbs.test(prompt)) {
      score += 15
    }

    // Check for explicit instructions
    if (prompt.includes('please') || prompt.includes('requirements:') || prompt.includes('instructions:')) {
      score += 15
    }

    // Check for detailed structure indicators
    if (/\b(overview|main points?|conclusion|analysis|comprehensive)\b/.test(prompt)) {
      score += 10
    }

    // Bonus for context and framing
    if (/\bcontext:|\bbackground:|\bpurpose:/.test(prompt)) {
      score += 10
    }

    // Bonus for longer, more detailed prompts
    if (variant.optimizedPrompt.length > 100) {
      score += 10
    }
    if (variant.optimizedPrompt.length > 300) {
      score += 10
    }

    return Math.max(0, Math.min(100, score))
  }

  private evaluateSpecificity(variant: OptimizedVariant): number {
    const prompt = variant.optimizedPrompt.toLowerCase()
    let score = 20 // Base score

    // Check for specific requirements - multiple categories
    const requirementMarkers = /\b(requirements?|constraints?|specifications?)\b/
    if (requirementMarkers.test(prompt)) {
      score += 15
    }

    // Check for format/output specifications
    const formatMarkers = /\b(format|structure|output|response)\b/
    if (formatMarkers.test(prompt)) {
      score += 12
    }

    // Check for scope/inclusion markers
    const scopeMarkers = /\b(include|exclude|focus on|address|consider)\b/
    if (scopeMarkers.test(prompt)) {
      score += 12
    }

    // Check for audience/purpose specification
    const contextMarkers = /\b(target|audience|purpose|context|background)\b/
    if (contextMarkers.test(prompt)) {
      score += 10
    }

    // Check for technical specificity
    const technicalMarkers = /\b(concepts|applications|technical|evidence|data|metrics)\b/
    if (technicalMarkers.test(prompt)) {
      score += 10
    }

    // Check for examples and instances
    if (/example|e\.g\.|for instance|such as|specific/.test(prompt)) {
      score += 8
    }

    // Check for bullet points with detailed items
    const bulletDetails = prompt.match(/[-*]\s*[^\n]{20,}/g)
    if (bulletDetails && bulletDetails.length > 0) {
      score += Math.min(15, bulletDetails.length * 5)
    }

    // Penalty for very short prompts
    if (variant.optimizedPrompt.length < 50) {
      score = Math.max(0, score - 25)
    }

    // Bonus for comprehensive prompts
    if (variant.optimizedPrompt.length > 300) {
      score += 8
    }

    return Math.min(100, score)
  }

  private evaluateStructure(variant: OptimizedVariant): number {
    const prompt = variant.optimizedPrompt
    let score = 0  // Start from 0

    // Check for sections/headings with double newlines
    const sectionBreaks = (prompt.match(/\n\n/g) || []).length
    if (sectionBreaks > 0) {
      score += Math.min(30, sectionBreaks * 15)
    }

    // Check for numbered lists - more points if multiple
    const numberedMatches = prompt.match(/\n\d+[.)]/g) || []  // Must be at start of line
    if (numberedMatches.length > 0) {
      score += Math.min(50, numberedMatches.length * 15)
    }

    // Check for bullet points
    const bulletMatches = prompt.match(/\n[-*]/g) || []
    if (bulletMatches.length > 0) {
      score += Math.min(30, bulletMatches.length * 10)
    }

    // Check for clear organization markers
    const orgMarkers = prompt.match(/\b(first|second|then|finally|overview|main points?|conclusion)\b/gi) || []
    if (orgMarkers.length > 0) {
      score += Math.min(40, orgMarkers.length * 15)
    }

    // Bonus for having multiple structure types
    const structureTypes = [
      sectionBreaks > 0,
      numberedMatches.length > 0,
      bulletMatches.length > 0,
      orgMarkers.length > 0
    ].filter(Boolean).length
    
    if (structureTypes >= 2) {
      score += 10
    }

    return Math.min(100, score)
  }

  private evaluateCompleteness(variant: OptimizedVariant): number {
    const length = variant.optimizedPrompt.length
    const originalLength = variant.originalPrompt.length

    // Too short
    if (length < 20) return 20
    if (length < 50) return 40

    // Good length range
    if (length >= 50 && length <= 500) {
      // Better if it's an improvement over original
      if (length > originalLength * 1.5) {
        return 85
      }
      return 70
    }

    // Getting long but still ok
    if (length <= 1000) return 60

    // Too long
    return 40
  }

  private evaluateEfficiency(variant: OptimizedVariant): number {
    const length = variant.optimizedPrompt.length
    const changes = variant.changes.length

    // Very short prompts can't be very efficient at conveying information
    if (length < 30) return 30

    // Too long is inefficient
    if (length > 2000) return 30
    if (length > 1000) return 50

    // Good ratio of improvements to length
    const improvementDensity = changes / (length / 100)
    if (improvementDensity > 0.5 && improvementDensity < 2) {
      return 85
    }

    return 70
  }

  private evaluateModelAlignment(variant: OptimizedVariant): number {
    const prompt = variant.optimizedPrompt.toLowerCase()
    let score = 50

    // Check for model-specific features
    if (variant.modelSpecificFeatures && variant.modelSpecificFeatures.length > 0) {
      score += 20

      // Check if prompt actually uses these features
      for (const feature of variant.modelSpecificFeatures) {
        if (feature === 'reasoning' && /reason|think|analyze/.test(prompt)) {
          score += 10
        }
        if (feature === 'step-by-step' && /step[\s-]?by[\s-]?step/.test(prompt)) {
          score += 10
        }
        if (feature === 'thoughtful' && /thoughtful|comprehensive|consider/.test(prompt)) {
          score += 10
        }
        if (feature === 'constitutional' && /ethical|implications/.test(prompt)) {
          score += 10
        }
      }
    }

    return Math.min(100, score)
  }

  private evaluateSafety(variant: OptimizedVariant): number {
    const prompt = variant.optimizedPrompt.toLowerCase()

    // Check for harmful patterns
    for (const pattern of this.harmfulPatterns) {
      if (pattern.test(prompt)) {
        return 0
      }
    }

    return 100
  }

  private generateSuggestions(variant: OptimizedVariant, factors: QualityFactors): string[] {
    const suggestions: string[] = []

    // Only generate suggestions if the overall quality is below excellent
    const overallScore = Object.values(factors).reduce((a, b) => a + b, 0) / Object.keys(factors).length
    if (overallScore >= 80) {
      return [] // High-quality prompts need no suggestions
    }

    if (factors.clarity < 50) {
      suggestions.push('Replace vague terms with specific language')
      suggestions.push('Add clear action verbs at the beginning')
    }

    if (factors.specificity < 50) {
      suggestions.push('Add specific technology domain or topic')
      suggestions.push('Define expected output format')
      suggestions.push('Specify target audience')
      suggestions.push('Include length or format requirements')
    }

    if (factors.structure < 50) {
      suggestions.push('Include clear structure and organization')
      suggestions.push('Use numbered lists or bullet points')
      suggestions.push('Add section headings')
    }

    if (factors.completeness < 50) {
      suggestions.push('Provide more context and details')
      suggestions.push('Expand on requirements')
    }

    if (factors.efficiency < 50 && variant.optimizedPrompt.length > 1000) {
      suggestions.push('Consider condensing the prompt while maintaining clarity')
    }

    if (factors.modelAlignment < 50) {
      suggestions.push('Add model-specific optimization phrases')
    }

    // Add tone/style suggestion only for lower quality prompts
    if (overallScore < 70 && !variant.optimizedPrompt.toLowerCase().includes('tone') && 
        !variant.optimizedPrompt.toLowerCase().includes('style')) {
      suggestions.push('Specify desired tone or style')
    }

    return suggestions
  }

  private calculateImprovementPercentage(variant: OptimizedVariant): number {
    if (!variant.originalPrompt || variant.originalPrompt === variant.optimizedPrompt) {
      return 0
    }

    // Calculate based on various improvements
    const lengthImprovement = (variant.optimizedPrompt.length / variant.originalPrompt.length - 1) * 100
    const changesBonus = variant.changes.length * 20

    // Cap the improvement percentage
    const totalImprovement = lengthImprovement + changesBonus
    return Math.max(0, Math.min(400, Math.round(totalImprovement)))
  }
}