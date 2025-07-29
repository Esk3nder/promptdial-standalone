// Types
export interface OptimizationRequest {
  prompt: string
  targetModel?: string
  language?: string
  taskType?: 'creative' | 'analytical' | 'coding' | 'general'
  constraints?: {
    maxLength?: number
    format?: string
    tone?: string
  }
}

export interface OptimizedVariant {
  id: string
  originalPrompt: string
  optimizedPrompt: string
  changes: Array<{
    type: string
    description: string
  }>
  score?: number
  modelSpecificFeatures: string[]
  estimatedTokens: number
  formatted?: {
    markdown: string
    technique_name: string
    technique_category: string
    transformations: string[]
  }
}

export interface ModelStrategy {
  model: string
  features: string[]
  optimizations: string[]
}

// Errors
export class EmptyPromptError extends Error {
  constructor() {
    super('Prompt cannot be empty')
    this.name = 'EmptyPromptError'
  }
}

export class PromptTooLongError extends Error {
  constructor() {
    super('Prompt exceeds maximum length of 10000 characters')
    this.name = 'PromptTooLongError'
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Main class
export class MetaPromptDesigner {
  private optimizationStrategies: Map<string, ModelStrategy>
  private harmfulPatterns: RegExp[]

  constructor() {
    this.optimizationStrategies = this.initializeStrategies()
    this.harmfulPatterns = this.initializeHarmfulPatterns()
  }

  async generateVariants(request: OptimizationRequest): Promise<OptimizedVariant[]> {
    // Validate input
    this.validateInput(request)
    
    // Default to gpt-4 if no model specified
    if (!request.targetModel) {
      request.targetModel = 'gpt-4'
    }

    // Detect task type if not specified
    const taskType = request.taskType || this.detectTaskType(request.prompt)

    // Get model-specific strategy
    const strategy =
      this.optimizationStrategies.get(request.targetModel) || this.getDefaultStrategy()

    // Generate improvements
    const improvements = this.generateImprovements(request.prompt, taskType, strategy)

    // Generate all optimization variants in a single comprehensive process
    const variants: OptimizedVariant[] = []

    // Generate 5 progressively optimized variants
    for (let i = 0; i < 5; i++) {
      const variant = this.createVariant(request.prompt, improvements, strategy, i)
      variant.score = this.calculateInitialScore(variant)
      variants.push(variant)
    }

    // Sort by score
    return variants.sort((a, b) => (b.score || 0) - (a.score || 0))
  }

  private validateInput(request: OptimizationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new EmptyPromptError()
    }

    if (request.prompt.length > 10000) {
      throw new PromptTooLongError()
    }

    // Check for harmful content
    for (const pattern of this.harmfulPatterns) {
      if (pattern.test(request.prompt.toLowerCase())) {
        throw new ValidationError('Prompt contains potentially harmful content')
      }
    }
  }

  private initializeStrategies(): Map<string, ModelStrategy> {
    const strategies = new Map<string, ModelStrategy>()

    strategies.set('gpt-4', {
      model: 'gpt-4',
      features: ['reasoning', 'step-by-step'],
      optimizations: [
        "Let's think step by step",
        'Please provide detailed reasoning',
        'Analyze this systematically',
      ],
    })

    strategies.set('claude-3', {
      model: 'claude-3',
      features: ['constitutional', 'thoughtful'],
      optimizations: [
        'Please provide a thoughtful analysis',
        'Consider the ethical implications',
        'Provide a comprehensive response',
      ],
    })

    strategies.set('gemini-pro', {
      model: 'gemini-pro',
      features: ['multimodal', 'analytical'],
      optimizations: [
        'Analyze the data systematically',
        'Provide evidence-based insights',
        'Include relevant data points',
      ],
    })

    return strategies
  }

  private initializeHarmfulPatterns(): RegExp[] {
    return [
      /\bhack\s*(into|systems?|computers?)\b/i,
      /\b(create|generate|make)\s*(malware|virus|trojan)\b/i,
      /\billegal\s*(content|activities?|substances?)\b/i,
      /\bharm\s*(others?|people|someone)\b/i,
      /\bexploit\s*(vulnerabilities?|systems?|people)\b/i,
    ]
  }

  private detectTaskType(prompt: string): 'creative' | 'analytical' | 'coding' | 'general' {
    const lowerPrompt = prompt.toLowerCase()

    // Check for coding first to avoid false positives from "write a function"
    if (
      /\b(code|function|program|script|implement|algorithm|python|javascript|java|class|method|variable|api|debug|compile)\b/.test(
        lowerPrompt,
      )
    ) {
      return 'coding'
    }

    if (/\b(analyze|analysis|data|metrics|insights?|evaluate|assess)\b/.test(lowerPrompt)) {
      return 'analytical'
    }

    // Make creative detection more specific to avoid catching "write a function"
    if (
      /\b(write|create).*(story|poem|narrative|blog|article|essay|fiction|creative)\b/.test(
        lowerPrompt,
      ) ||
      /\b(story|poem|creative|imagine|narrative)\b/.test(lowerPrompt)
    ) {
      return 'creative'
    }

    return 'general'
  }

  private generateImprovements(
    prompt: string,
    taskType: string,
    strategy: ModelStrategy,
  ): {
    clarity: unknown
    specificity: { taskType?: string; suggestions?: string[] }
    structure: { type: string; suggestion: string }
    context: { type: string; suggestion: string }
    modelOptimization: { type: string; optimizations: string[] }
    taskType: string
  } {
    const improvements = {
      clarity: this.addClarity(prompt),
      specificity: this.addSpecificity(prompt, taskType),
      structure: this.addStructure(prompt),
      context: this.addContext(prompt),
      modelOptimization: this.optimizeForModel(prompt, strategy),
      taskType, // Include taskType for later use
    }

    return improvements
  }

  private addClarity(prompt: string): {
    type: string
    changes: Array<{ term?: string; type?: string; suggestion: string }>
    suggestion: string
  } {
    const vagueTerms = ['something', 'stuff', 'thing', 'whatever', 'somehow']
    const suggestions = []

    for (const term of vagueTerms) {
      if (prompt.toLowerCase().includes(term)) {
        suggestions.push({
          term,
          suggestion: `Replace "${term}" with specific details`,
        })
      }
    }

    // Add explicit task if missing
    if (!this.hasExplicitTask(prompt)) {
      suggestions.push({
        type: 'explicit_task',
        suggestion: 'Add clear action verb at the beginning',
      })
    }

    return {
      type: 'clarity',
      changes: suggestions,
      suggestion:
        suggestions.length > 0
          ? 'Please provide a clear and specific request with explicit instructions.'
          : '',
    }
  }

  private addSpecificity(
    _prompt: string,
    taskType: string,
  ): {
    type: string
    changes: Array<{ suggestion: string }>
    suggestions: string[]
    taskType: string
  } {
    const suggestions = []

    switch (taskType) {
      case 'creative':
        suggestions.push(
          'Specify the desired tone (formal, casual, playful, serious)',
          'Define your target audience',
          'Set length constraints (word count or paragraphs)',
        )
        break
      case 'analytical':
        suggestions.push(
          'Define the scope of analysis',
          'Specify which data sources to consider',
          'Request specific metrics or KPIs',
        )
        break
      case 'coding':
        suggestions.push(
          'Specify the programming language',
          'Define input and output formats',
          'Include error handling requirements',
        )
        break
      default:
        suggestions.push(
          'Provide more context about your goal',
          'Specify the desired output format',
          'Include any constraints or requirements',
        )
    }

    return {
      type: 'specificity',
      changes: suggestions.map((s) => ({ suggestion: s })),
      suggestions,
      taskType,
    }
  }

  private addStructure(prompt: string): { type: string; suggestion: string } {
    const hasStructure = /\d+\.|[\-\*]\s|first|second|then|finally/i.test(prompt)

    return {
      type: 'structure',
      suggestion: hasStructure
        ? ''
        : 'Structure your request with numbered steps or bullet points for clarity.',
    }
  }

  private addContext(_prompt: string): { type: string; suggestion: string } {
    return {
      type: 'context',
      suggestion: 'Provide background information and context for better understanding.',
    }
  }

  private optimizeForModel(
    _prompt: string,
    strategy: ModelStrategy,
  ): { type: string; optimizations: string[] } {
    return {
      type: 'model_optimization',
      optimizations: strategy.optimizations,
    }
  }

  private hasExplicitTask(prompt: string): boolean {
    const taskVerbs = [
      'write',
      'create',
      'explain',
      'analyze',
      'summarize',
      'describe',
      'list',
      'compare',
      'evaluate',
      'design',
      'develop',
      'generate',
    ]

    const lowerPrompt = prompt.toLowerCase()
    return taskVerbs.some(
      (verb) => lowerPrompt.startsWith(verb) || lowerPrompt.includes(` ${verb} `),
    )
  }

  private createVariant(
    originalPrompt: string,
    improvements: {
      clarity: unknown
      specificity: { taskType?: string; suggestions?: string[] }
      taskType?: string
      modelOptimization?: { type: string; optimizations: string[] }
    },
    strategy: ModelStrategy,
    index: number,
  ): OptimizedVariant {
    const changes = []
    let optimizedPrompt = originalPrompt

    // Apply improvements progressively
    // Always apply clarity
    optimizedPrompt = this.applyClarity(optimizedPrompt, improvements.clarity)
    changes.push({
      type: 'clarity',
      description: 'Added specific instructions and removed vague terms',
    })

    // Always apply specificity
    optimizedPrompt = this.applySpecificity(optimizedPrompt, improvements.specificity, improvements)
    changes.push({
      type: 'specificity',
      description: 'Added specific requirements and constraints',
    })

    // Apply structure and context progressively
    if (index === 0) {
      // First variant adds context
      optimizedPrompt = this.applyContext(optimizedPrompt)
      changes.push({
        type: 'context',
        description: 'Added contextual information',
      })
    }

    optimizedPrompt = this.applyStructure(optimizedPrompt)
    changes.push({
      type: 'structure',
      description: 'Organized with numbered steps',
    })

    if (index >= 1) {
      optimizedPrompt = this.applyContext(optimizedPrompt)
      changes.push({
        type: 'context',
        description: 'Added contextual information',
      })
    }

    // Add extra refinements for higher level variants
    if (index >= 2) {
      optimizedPrompt = this.applyExpertRefinements(optimizedPrompt)
      changes.push({
        type: 'expert_refinement',
        description: 'Added advanced optimization techniques',
      })
    }

    if (index >= 3) {
      optimizedPrompt = this.applyOutputFormatting(optimizedPrompt)
      changes.push({
        type: 'output_formatting',
        description: 'Specified detailed output format requirements',
      })
    }

    if (index >= 4) {
      optimizedPrompt = this.applyExampleRequest(optimizedPrompt)
      changes.push({
        type: 'examples',
        description: 'Requested specific examples in response',
      })
    }

    // Always apply model optimization
    if (improvements.modelOptimization) {
      optimizedPrompt = this.applyModelOptimization(
        optimizedPrompt,
        improvements.modelOptimization,
        index,
      )
      changes.push({
        type: 'model_optimization',
        description: `Applied ${strategy.model} specific optimizations`,
      })
    }

    return {
      id: crypto.randomUUID(),
      originalPrompt,
      optimizedPrompt,
      changes,
      modelSpecificFeatures: strategy.features,
      estimatedTokens: this.estimateTokens(optimizedPrompt),
    }
  }

  private applyClarity(prompt: string, _clarity: unknown): string {
    let improved = prompt

    // Make the task explicit
    if (!this.hasExplicitTask(prompt)) {
      improved = `Please ${improved.toLowerCase()}`
    }

    // Replace vague terms
    const replacements = {
      something: 'specific content',
      stuff: 'relevant materials',
      thing: 'particular item',
    }

    for (const [vague, specific] of Object.entries(replacements)) {
      improved = improved.replace(new RegExp(`\\b${vague}\\b`, 'gi'), specific)
    }

    return improved
  }

  private applySpecificity(
    prompt: string,
    specificity: { taskType?: string; suggestions?: string[] },
    improvements?: { taskType?: string },
  ): string {
    // Get taskType from specificity or improvements object
    const taskType = specificity.taskType || improvements?.taskType || this.detectTaskType(prompt)

    if (taskType === 'coding') {
      return `${prompt}. Specify the programming language. Define input and output formats. Include error handling requirements`
    }

    // Handle both suggestions array and string array
    const suggestions = specificity.suggestions || specificity
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      const additions = suggestions.slice(0, 2).join('. ')
      return `${prompt}. ${additions}`
    }

    return prompt
  }

  private applyStructure(prompt: string): string {
    return `${prompt}\n\nPlease structure your response with:\n1) Overview\n2) Main points\n3) Conclusion`
  }

  private applyContext(prompt: string): string {
    return `Context: This request is for a professional setting.\n\n${prompt}`
  }

  private applyModelOptimization(
    prompt: string,
    modelOpt: { optimizations: string[] },
    index: number,
  ): string {
    const optimization = modelOpt.optimizations[Math.min(index, modelOpt.optimizations.length - 1)]
    return `${prompt}\n\n${optimization}`
  }

  private applyExpertRefinements(prompt: string): string {
    return `${prompt}\n\nPlease ensure your response is comprehensive, well-researched, and includes relevant examples where appropriate.`
  }

  private applyOutputFormatting(prompt: string): string {
    return `${prompt}\n\nFormat your response with clear headings, subheadings, and use bullet points or numbered lists where appropriate for better readability.`
  }

  private applyExampleRequest(prompt: string): string {
    return `${prompt}\n\nPlease provide concrete examples to illustrate your points.`
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4)
  }

  private calculateInitialScore(variant: OptimizedVariant): number {
    let score = 50 // Base score

    // Bonus for improvements
    score += variant.changes.length * 10

    // Bonus for length (but not too long)
    const lengthRatio = variant.optimizedPrompt.length / variant.originalPrompt.length
    if (lengthRatio > 1.5 && lengthRatio < 4) {
      score += 15
    }

    // Bonus for structure
    if (variant.optimizedPrompt.includes('\n')) {
      score += 5
    }

    // Cap at 95
    return Math.min(score, 95)
  }

  private getDefaultStrategy(): ModelStrategy {
    return {
      model: 'default',
      features: ['general'],
      optimizations: ['Please provide a detailed and comprehensive response.'],
    }
  }
}
