/**
 * PromptDial - AI Prompt Optimization Engine
 *
 * Transform basic prompts into optimized, model-specific queries
 */

import { MetaPromptDesigner, OptimizationRequest, OptimizedVariant } from './meta-prompt-designer'
import { AIMetaPromptDesigner } from './ai-meta-prompt-designer'
import { QualityValidator, ValidationResult } from './quality-validator'

export interface PromptDialOptions {
  autoValidate?: boolean
  sortByQuality?: boolean
  useAI?: boolean // New option to enable AI-powered optimization
}

export interface OptimizedResult {
  variants: Array<OptimizedVariant & { quality?: ValidationResult }>
  request: OptimizationRequest
  summary: {
    totalVariants: number
    bestScore?: number
    averageScore?: number
  }
}

export class PromptDial {
  private designer: MetaPromptDesigner | AIMetaPromptDesigner
  private validator: QualityValidator
  private options: PromptDialOptions

  constructor(options: PromptDialOptions = {}) {
    this.options = {
      autoValidate: true,
      sortByQuality: true,
      useAI: true, // Default to AI-powered optimization
      ...options,
    }

    // Use AI designer if enabled and API keys are available
    if (this.options.useAI && this.hasAPIKeys()) {
      // AI-powered optimization enabled
      this.designer = new AIMetaPromptDesigner()
    } else {
      // Basic optimization mode
      this.designer = new MetaPromptDesigner()
      if (this.options.useAI) {
        // AI optimization requested but no API keys found. Falling back to basic optimization.
      }
    }

    this.validator = new QualityValidator()
  }

  /**
   * Optimize a prompt for a specific AI model
   */
  async optimize(request: OptimizationRequest): Promise<OptimizedResult> {
    // Generate optimized variants
    const variants = await this.designer.generateVariants(request)

    // Optionally validate quality
    let enhancedVariants = variants
    if (this.options.autoValidate) {
      enhancedVariants = await this.addQualityScores(variants)
    }

    // Sort by quality if enabled
    if (this.options.sortByQuality && this.options.autoValidate) {
      enhancedVariants.sort((a, b) => {
        const aScore = (a as any).quality?.score || 0
        const bScore = (b as any).quality?.score || 0
        return bScore - aScore
      })
    }

    // Calculate summary statistics
    const summary = this.calculateSummary(enhancedVariants)

    return {
      variants: enhancedVariants,
      request,
      summary,
    }
  }

  /**
   * Validate a single variant
   */
  async validateVariant(variant: OptimizedVariant): Promise<ValidationResult> {
    return this.validator.validateAndScore(variant)
  }

  /**
   * Compare multiple variants and rank by quality
   */
  async compareVariants(variants: OptimizedVariant[]) {
    return this.validator.compareVariants(variants)
  }

  private async addQualityScores(
    variants: OptimizedVariant[],
  ): Promise<Array<OptimizedVariant & { quality: ValidationResult }>> {
    return Promise.all(
      variants.map(async (variant) => ({
        ...variant,
        quality: await this.validator.validateAndScore(variant),
      })),
    )
  }

  private calculateSummary(variants: Array<OptimizedVariant & { quality?: ValidationResult }>) {
    const scores = variants
      .map((v) => v.quality?.score)
      .filter((score): score is number => score !== undefined)

    return {
      totalVariants: variants.length,
      bestScore: scores.length > 0 ? Math.max(...scores) : undefined,
      averageScore:
        scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : undefined,
    }
  }

  private hasAPIKeys(): boolean {
    return !!(
      process.env.OPENAI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.GOOGLE_AI_API_KEY
    )
  }

  private getAvailableProviders(): string[] {
    const providers = []
    if (process.env.OPENAI_API_KEY) providers.push('OpenAI')
    if (process.env.ANTHROPIC_API_KEY) providers.push('Anthropic')
    if (process.env.GOOGLE_AI_API_KEY) providers.push('Google AI')
    return providers
  }
}

// Export all types and classes
export { MetaPromptDesigner, OptimizationRequest, OptimizedVariant } from './meta-prompt-designer'
export { QualityValidator, ValidationResult, QualityFactors } from './quality-validator'

// Default export
export default PromptDial
