/**
 * Template Fallback Guard
 * 
 * Detects and blocks terrible template-based "optimizations"
 */

export interface OptimizationResult {
  variants?: Array<{
    optimizedPrompt?: string
    changes?: Array<{ type: string }>
  }>
  metadata?: {
    optimizationMode?: string
    activeProvider?: string
  }
}

const TEMPLATE_FALLBACK_PATTERNS = [
  /Context: This request is for a professional setting/,
  /Provide more context about your goal\. Specify the desired output format/,
  /Please structure your response with:\s*1\) Overview\s*2\) Main points\s*3\) Conclusion/,
  /Please ensure your response is comprehensive, well-researched, and includes relevant examples/,
  /Analyze this systematically/,
  /Let's think step by step/,
  /Please provide detailed reasoning/
]

const TEMPLATE_CHANGE_TYPES = [
  'clarity', 'specificity', 'structure', 'context', 
  'expert_refinement', 'model_optimization', 'output_formatting'
]

export class TemplateFallbackGuard {
  
  /**
   * Check if result looks like template fallback
   */
  static isTemplateFallback(result: OptimizationResult): boolean {
    // Check metadata first
    if (result.metadata?.optimizationMode === 'static-template') {
      return true
    }
    
    if (result.metadata?.activeProvider === 'None') {
      return true
    }

    // Check variants for template patterns
    if (result.variants) {
      for (const variant of result.variants) {
        if (this.isVariantTemplateBased(variant)) {
          return true
        }
      }
    }

    return false
  }

  /**
   * Check if a single variant looks template-based
   */
  private static isVariantTemplateBased(variant: any): boolean {
    const prompt = variant.optimizedPrompt || ''
    
    // Check for template patterns
    let patternMatches = 0
    for (const pattern of TEMPLATE_FALLBACK_PATTERNS) {
      if (pattern.test(prompt)) {
        patternMatches++
      }
    }
    
    // If 3+ template patterns match, it's definitely template-based
    if (patternMatches >= 3) {
      return true
    }

    // Check if all changes are generic template types
    if (variant.changes) {
      const changeTypes = variant.changes.map((c: any) => c.type)
      const templateTypeCount = changeTypes.filter((type: string) => 
        TEMPLATE_CHANGE_TYPES.includes(type)
      ).length
      
      // If all changes are template types, it's template-based
      if (templateTypeCount === changeTypes.length && changeTypes.length > 0) {
        return true
      }
    }

    return false
  }

  /**
   * Get template fallback error message
   */
  static getTemplateFallbackError(): string {
    return `
🚨 TEMPLATE FALLBACK DETECTED

The system is generating terrible template-based "optimizations" instead of real AI enhancement.

CAUSE: No API keys configured - system fell back to static templates
EFFECT: Generic boilerplate added instead of intelligent optimization

TO FIX:
1. Add your API key to packages/core/.env:
   ANTHROPIC_API_KEY=sk-ant-api03-your-key-here

2. Restart the server:
   npm run start:core

3. Verify "DYNAMIC AI MODE" appears in startup logs

This is exactly the "silent fallback" behavior PromptDial 3.0 prevents.
    `.trim()
  }

  /**
   * Validate optimization result and return error object if template fallback
   */
  static validateResult(result: OptimizationResult): { isValid: boolean; error?: string } {
    if (this.isTemplateFallback(result)) {
      return {
        isValid: false,
        error: this.getTemplateFallbackError()
      }
    }
    return { isValid: true }
  }

  /**
   * Check if API keys are real (not placeholders)
   */
  static hasRealAPIKeys(): boolean {
    const keys = [
      process.env.ANTHROPIC_API_KEY,
      process.env.OPENAI_API_KEY, 
      process.env.GOOGLE_AI_API_KEY
    ]

    return keys.some(key => 
      key && 
      key.length > 20 && 
      !key.includes('your-') && 
      !key.includes('api-key-here') &&
      !key.includes('placeholder')
    )
  }

  /**
   * Get user-friendly error message for missing API keys
   */
  static getMissingAPIKeysError(): string {
    return `
🔑 API Keys Required

To use PromptDial's AI optimization, you need to add a real API key to:
/packages/core/.env

Replace the placeholder with your actual key:
ANTHROPIC_API_KEY=sk-ant-api03-[your-actual-key]

Get a free key at: https://console.anthropic.com/

Until then, the system won't generate template garbage - it will just wait for you to add real AI.
    `.trim()
  }
}