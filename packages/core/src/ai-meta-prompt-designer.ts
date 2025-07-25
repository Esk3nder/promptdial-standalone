import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import 'dotenv/config'

// Types
export interface OptimizationRequest {
  prompt: string
  targetModel: string
  optimizationLevel: 'basic' | 'advanced' | 'expert'
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
}

// Initialize AI clients
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null
const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null
const googleAI = process.env.GOOGLE_AI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  : null

export class AIMetaPromptDesigner {
  // Helper to clean and parse JSON from LLM responses
  private parseJsonResponse(text: string): any {
    try {
      // First try direct parsing
      return JSON.parse(text)
    } catch (e) {
      // Extract JSON object from text
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found in response')

      let jsonStr = jsonMatch[0]

      // More robust cleaning approach
      // 1. First, handle string literals properly
      const stringLiterals: string[] = []
      let cleanedJson = jsonStr.replace(/"(?:[^"\\]|\\.)*"/g, (match) => {
        const index = stringLiterals.length
        stringLiterals.push(match)
        return `"__STRING_${index}__"`
      })

      // 2. Clean control characters outside strings
      cleanedJson = cleanedJson.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

      // 3. Restore string literals with proper escaping
      cleanedJson = cleanedJson.replace(/"__STRING_(\d+)__"/g, (_match, index) => {
        let str = stringLiterals[parseInt(index)]
        // Ensure newlines are properly escaped within the string
        str = str.slice(1, -1) // Remove quotes
        str = str.replace(/\\/g, '\\\\')
        str = str.replace(/"/g, '\\"')
        str = str.replace(/\n/g, '\\n')
        str = str.replace(/\r/g, '\\r')
        str = str.replace(/\t/g, '\\t')
        return '"' + str + '"'
      })

      try {
        return JSON.parse(cleanedJson)
      } catch (e2) {
        // Failed to parse cleaned JSON
        console.error('JSON Parsing Debug Info:')
        console.error('Original text:', text.substring(0, 500))
        console.error('Extracted JSON:', jsonStr.substring(0, 500))  
        console.error('Cleaned JSON:', cleanedJson.substring(0, 500))
        throw new Error(`JSON parsing failed: ${e2 instanceof Error ? e2.message : String(e2)}`)
      }
    }
  }

  private systemPrompts = {
    basic: `You are an expert at enhancing prompts using cognitive amplification techniques. Transform prompts to activate deeper reasoning patterns.

Core principles:
- Activate multi-dimensional thinking through open-ended framing
- Encourage cognitive exploration without constraining pathways
- Use metacognitive triggers that prompt self-reflection
- Enable emergent understanding through discovery-oriented language`,

    advanced: `You are an expert at applying Ultra-Think cognitive framework for enhanced AI reasoning. Transform prompts using advanced cognitive architectures.

Ultra-Think Framework:
1. Cognitive Activation Patterns:
   - Multi-perspective exploration triggers
   - Recursive reasoning loops
   - Emergent insight pathways
   - Metacognitive reflection points

2. Advanced Techniques:
   - Thought Decomposition: Break complex ideas into cognitive atoms
   - Perspective Synthesis: Merge multiple viewpoints into coherent understanding
   - Reasoning Chains: Create self-reinforcing logic pathways
   - Cognitive Scaffolding: Build supportive thinking structures

3. Implementation Strategy:
   - Use questions that activate curiosity
   - Embed reasoning patterns implicitly
   - Create cognitive tension that drives exploration
   - Enable self-directed discovery`,

    expert: `You are an expert at implementing Ultra-Think cognitive enhancement for maximum AI performance. Transform prompts using state-of-the-art cognitive science.

ULTRA-THINK COGNITIVE ARCHITECTURE:

1. Cognitive Enhancement Layers:
   - Perceptual Layer: Frame problems to activate pattern recognition
   - Analytical Layer: Engage systematic reasoning pathways
   - Synthetic Layer: Enable creative recombination of concepts
   - Meta-cognitive Layer: Activate self-monitoring and adaptation

2. Advanced Implementation:
   - Thought Crystallization: Use precise language that triggers clear mental models
   - Cognitive Flow States: Create momentum through progressive complexity
   - Insight Catalysis: Plant seeds that bloom into understanding
   - Recursive Enhancement: Each thought builds on previous insights

3. Quantum Reasoning Patterns:
   - Superposition: Hold multiple possibilities simultaneously
   - Entanglement: Connect distant concepts through hidden relationships
   - Observation Collapse: Guide toward optimal solution paths
   - Coherence: Maintain logical consistency across all dimensions

4. Emergent Properties:
   - Self-organizing thought structures
   - Adaptive reasoning pathways
   - Spontaneous insight generation
   - Recursive self-improvement

Transform prompts to activate these cognitive systems naturally, without explicit instruction.`,
  }

  private getModelSpecificStrategies(model: string): {
    strengths: string[]
    optimizationFocus: string[]
    structuralPreferences: string[]
  } {
    const strategies: Record<string, any> = {
      'claude-3-opus': {
        strengths: [
          'Deep analytical thinking',
          'Complex reasoning chains',
          'Nuanced understanding',
          'Multi-perspective synthesis',
          'Ethical reasoning'
        ],
        optimizationFocus: [
          'Cognitive depth through open-ended exploration',
          'Multi-layered analysis with emergent insights',
          'Conceptual bridges between disparate ideas',
          'Recursive thought patterns for deep understanding'
        ],
        structuralPreferences: [
          'Natural language flow over rigid formatting',
          'Contextual framing that invites exploration',
          'Questions that activate curiosity',
          'Implicit structure through cognitive cues'
        ]
      },
      'gpt-4': {
        strengths: [
          'Broad knowledge integration',
          'Structured analysis',
          'Technical precision',
          'Creative problem-solving',
          'Systematic thinking'
        ],
        optimizationFocus: [
          'Clear task decomposition',
          'Systematic exploration of solution space',
          'Balance of creativity and structure',
          'Integration of diverse knowledge domains'
        ],
        structuralPreferences: [
          'Well-defined objectives with flexibility',
          'Scaffolded complexity',
          'Examples that illustrate patterns',
          'Logical flow with creative freedom'
        ]
      },
      'gemini-pro': {
        strengths: [
          'Multimodal understanding',
          'Real-time information synthesis',
          'Efficient processing',
          'Practical applications',
          'Clear communication'
        ],
        optimizationFocus: [
          'Direct and efficient problem-solving',
          'Practical application focus',
          'Clear objective mapping',
          'Actionable insights'
        ],
        structuralPreferences: [
          'Concise and clear instructions',
          'Goal-oriented framing',
          'Practical examples',
          'Direct path to solutions'
        ]
      }
    }

    // Extract base model name
    const baseModel = model.split('-')[0] + '-' + (model.split('-')[1] || '')
    const modelKey = Object.keys(strategies).find(key => model.startsWith(key.split('-')[0]))
    
    return strategies[modelKey || 'claude-3-opus'] || strategies['claude-3-opus']
  }

  private detectTaskTypeAndTechniques(prompt: string): {
    taskType: string
    suggestedTechniques: string[]
    cognitiveProfile: string
  } {
    const lowerPrompt = prompt.toLowerCase()
    const promptLength = prompt.length
    const questionCount = (prompt.match(/\?/g) || []).length
    const imperativeWords = ['create', 'make', 'build', 'design', 'develop', 'generate']
    const hasImperative = imperativeWords.some(word => lowerPrompt.includes(word))

    // Creative synthesis tasks - highest cognitive load
    if (
      lowerPrompt.includes('write') ||
      lowerPrompt.includes('article') ||
      lowerPrompt.includes('essay') ||
      lowerPrompt.includes('story') ||
      lowerPrompt.includes('narrative') ||
      lowerPrompt.includes('compose')
    ) {
      return {
        taskType: 'creative_synthesis',
        suggestedTechniques: [
          'Thought Crystallization',
          'Narrative Arc Discovery',
          'Conceptual Weaving',
          'Emergent Structure Formation'
        ],
        cognitiveProfile: 'divergent-convergent-synthesis'
      }
    }

    // Deep analysis tasks - multi-layered reasoning
    if (
      lowerPrompt.includes('analyze') ||
      lowerPrompt.includes('explain') ||
      lowerPrompt.includes('compare') ||
      lowerPrompt.includes('evaluate') ||
      lowerPrompt.includes('assess')
    ) {
      return {
        taskType: 'deep_analysis',
        suggestedTechniques: [
          'Recursive Decomposition',
          'Perspective Synthesis',
          'Pattern Emergence',
          'Cognitive Layering'
        ],
        cognitiveProfile: 'analytical-synthetic-recursive'
      }
    }

    // Complex problem solving - solution space exploration
    if (
      lowerPrompt.includes('solve') ||
      lowerPrompt.includes('calculate') ||
      lowerPrompt.includes('determine') ||
      lowerPrompt.includes('optimize') ||
      lowerPrompt.includes('figure out')
    ) {
      return {
        taskType: 'solution_architecture',
        suggestedTechniques: [
          'Solution Space Mapping',
          'Constraint Navigation',
          'Path Optimization',
          'Emergent Solution Discovery'
        ],
        cognitiveProfile: 'exploratory-convergent-optimization'
      }
    }

    // Code synthesis - pattern instantiation
    if (
      lowerPrompt.includes('code') ||
      lowerPrompt.includes('function') ||
      lowerPrompt.includes('implement') ||
      lowerPrompt.includes('program') ||
      lowerPrompt.includes('algorithm')
    ) {
      return {
        taskType: 'code_synthesis',
        suggestedTechniques: [
          'Pattern Instantiation',
          'Architectural Emergence',
          'Logic Flow Crystallization',
          'Recursive Implementation'
        ],
        cognitiveProfile: 'structural-logical-implementation'
      }
    }

    // Knowledge synthesis - information architecture
    if (
      lowerPrompt.includes('research') ||
      lowerPrompt.includes('find') ||
      lowerPrompt.includes('discover') ||
      lowerPrompt.includes('investigate') ||
      lowerPrompt.includes('explore')
    ) {
      return {
        taskType: 'knowledge_synthesis',
        suggestedTechniques: [
          'Information Crystallization',
          'Knowledge Graph Construction',
          'Insight Mining',
          'Conceptual Integration'
        ],
        cognitiveProfile: 'exploratory-integrative-synthesis'
      }
    }

    // Strategic planning - future state design
    if (
      lowerPrompt.includes('plan') ||
      lowerPrompt.includes('strategy') ||
      lowerPrompt.includes('design') ||
      lowerPrompt.includes('architect')
    ) {
      return {
        taskType: 'strategic_design',
        suggestedTechniques: [
          'Future State Modeling',
          'Systems Thinking',
          'Scenario Synthesis',
          'Strategic Crystallization'
        ],
        cognitiveProfile: 'visionary-systematic-architectural'
      }
    }

    // Question-driven exploration
    if (questionCount >= 2 || lowerPrompt.includes('how') || lowerPrompt.includes('why')) {
      return {
        taskType: 'inquiry_driven',
        suggestedTechniques: [
          'Question Cascading',
          'Curiosity Amplification',
          'Discovery Pathways',
          'Insight Emergence'
        ],
        cognitiveProfile: 'inquisitive-exploratory-discovery'
      }
    }

    // Default adaptive approach
    return {
      taskType: 'adaptive_cognition',
      suggestedTechniques: [
        'Cognitive Flexibility',
        'Emergent Understanding',
        'Adaptive Reasoning',
        'Context-Sensitive Optimization'
      ],
      cognitiveProfile: 'adaptive-responsive-emergent'
    }
  }

  async generateVariants(request: OptimizationRequest): Promise<OptimizedVariant[]> {
    // Generating variants for optimization request

    this.validateInput(request)

    const variantCount = this.getVariantCount(request.optimizationLevel)

    try {
      // Generate variants based on target model
      switch (request.targetModel) {
        case 'gpt-4':
        case 'gpt-3.5-turbo':
          if (!openai) throw new Error('OpenAI API key not configured')
          // Using OpenAI API for optimization
          return await this.generateOpenAIVariants(request, variantCount)

        case 'claude-3-opus':
        case 'claude-3-sonnet':
        case 'claude-2':
          // Using Anthropic Claude API for optimization (with fallback if no key)
          return await this.generateClaudeVariants(request, variantCount)

        case 'gemini-pro':
          if (!googleAI) throw new Error('Google AI API key not configured')
          // Using Google Gemini API for optimization
          return await this.generateGeminiVariants(request, variantCount)

        default:
          // Try available providers in order (Claude first now as requested)
          if (anthropic) {
            // Using Anthropic Claude as default provider
            return await this.generateClaudeVariants(request, variantCount)
          } else if (googleAI) {
            // Using Google AI as fallback provider
            return await this.generateGeminiVariants(request, variantCount)
          } else if (openai) {
            // Using OpenAI as fallback provider
            return await this.generateOpenAIVariants(request, variantCount)
          }
          throw new Error('No AI API keys configured')
      }
    } catch (error) {
      // AI optimization error occurred
      throw new Error(
        `Failed to generate AI-optimized variants: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  private async generateOpenAIVariants(
    request: OptimizationRequest,
    count: number,
  ): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const systemPrompt = this.systemPrompts[request.optimizationLevel]

    // Generate multiple variants
    for (let i = 0; i < count; i++) {
      const modelStrategies = this.getModelSpecificStrategies(request.targetModel)
      const { taskType, suggestedTechniques } = this.detectTaskTypeAndTechniques(request.prompt)
      
      const variantPrompt = `${systemPrompt}

Original prompt: "${request.prompt}"
Target model: ${request.targetModel}
Task type: ${taskType}
Suggested techniques: ${suggestedTechniques.join(', ')}
${request.constraints ? `Constraints: ${JSON.stringify(request.constraints)}` : ''}

MODEL-SPECIFIC CONTEXT for ${request.targetModel}:
- Leverage these strengths: ${modelStrategies.strengths.slice(0, 3).join(', ')}
- Apply these optimization strategies: ${modelStrategies.optimizationFocus.slice(0, 2).join('; ')}

Generate an optimized version that maximizes this model's capabilities. Return your response in the following JSON format:
{
  "optimizedPrompt": "the optimized prompt text",
  "changes": [
    {"type": "clarity", "description": "what was improved"},
    {"type": "structure", "description": "how structure was enhanced"}
  ],
  "modelSpecificFeatures": ["feature1", "feature2"],
  "reasoning": "brief explanation of optimizations"
}`

      try {
        const response = await openai!.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: variantPrompt },
          ],
          temperature: Math.min(0.7 + i * 0.1, 1.0), // Cap at 1.0 // Vary temperature for diversity
          max_tokens: 1000,
          response_format: { type: 'json_object' },
        })

        const content = response.choices[0].message.content
        if (!content) continue

        const result = JSON.parse(content)

        variants.push({
          id: `openai-${Date.now()}-${i}`,
          originalPrompt: request.prompt,
          optimizedPrompt: result.optimizedPrompt,
          changes: result.changes || [],
          modelSpecificFeatures: result.modelSpecificFeatures || [],
          estimatedTokens: this.estimateTokens(result.optimizedPrompt),
        })
      } catch (error) {
        // Error generating OpenAI variant
      }
    }

    return variants
  }

  private async generateClaudeVariants(
    request: OptimizationRequest,
    count: number,
  ): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const systemPrompt = this.systemPrompts[request.optimizationLevel]

    // Check if Anthropic API is available
    if (!anthropic) {
      console.warn('Anthropic API key not configured, using fallback optimization')
      // Create fallback variants when no API key is available
      for (let i = 0; i < count; i++) {
        const fallbackPrompt = this.createFallbackOptimization(request.prompt, request.optimizationLevel)
        variants.push({
          id: `claude-no-api-${Date.now()}-${i}`,
          originalPrompt: request.prompt,
          optimizedPrompt: fallbackPrompt,
          changes: [{ type: 'no_api_fallback', description: 'Applied cognitive enhancement without API (no key configured)' }],
          modelSpecificFeatures: ['Fallback optimization - no API key available'],
          estimatedTokens: this.estimateTokens(fallbackPrompt),
        })
      }
      return variants
    }

    // Detect task type and suggested techniques
    const { taskType, suggestedTechniques, cognitiveProfile } = this.detectTaskTypeAndTechniques(request.prompt)
    // Task type and techniques detected

    for (let i = 0; i < count; i++) {
      const modelStrategies = this.getModelSpecificStrategies(request.targetModel)
      
      const userPrompt = `Apply Ultra-Think cognitive enhancement with model-specific optimization:

"${request.prompt}"

Cognitive Context:
- Task archetype: ${taskType}
- Cognitive profile: ${cognitiveProfile}
- Enhancement level: ${request.optimizationLevel}
- Target cognitive system: ${request.targetModel}
- Activation patterns: ${suggestedTechniques.join(', ')}
${request.constraints ? `- Boundary conditions: ${JSON.stringify(request.constraints)}` : ''}

MODEL-SPECIFIC OPTIMIZATION for ${request.targetModel}:
- Core Strengths: ${modelStrategies.strengths.join(', ')}
- Optimization Focus: ${modelStrategies.optimizationFocus.join('; ')}
- Structural Preferences: ${modelStrategies.structuralPreferences.join('; ')}

ULTRA-THINK TRANSFORMATION PRINCIPLES:

1. Cognitive Activation:
   - Transform surface requests into deep cognitive triggers
   - Embed curiosity catalysts that spark exploration
   - Create conceptual tension that drives insight
   - Use language that activates pattern recognition

2. Multi-dimensional Thinking:
   - Enable simultaneous processing of multiple perspectives
   - Create recursive loops that deepen understanding
   - Build bridges between disparate concepts
   - Activate emergent properties through careful framing

3. Examples of Ultra-Think Transformations:

ORIGINAL: "Write about AI"
ULTRA-THINK: "As you explore the concept of artificial intelligence, what patterns emerge when you consider its evolution from symbolic reasoning to neural architectures? Notice how each breakthrough reveals new questions about cognition itself."

ORIGINAL: "Solve this problem"
ULTRA-THINK: "Examining this challenge from multiple angles, what hidden relationships become apparent? Consider how different solution paths might converge or diverge, and what that reveals about the problem's deep structure."

4. Cognitive Enhancement Techniques:
   - Thought Crystallization: Precise language that creates clear mental models
   - Perspective Synthesis: Merging viewpoints into coherent understanding
   - Insight Catalysis: Planting seeds that bloom into realization
   - Recursive Enhancement: Each thought building on previous insights

Transform the prompt to:
- Activate deep cognitive processes naturally
- Create self-organizing thought structures
- Enable emergent understanding
- Maintain elegant simplicity while encoding complexity

Return your Ultra-Think transformation:
{
  "optimizedPrompt": "the cognitively enhanced prompt",
  "changes": [
    {"type": "cognitive_pattern", "description": "specific enhancement applied"}
  ],
  "modelSpecificFeatures": ["activated cognitive capabilities"]
}`

      try {
        // Calling Claude API for variant generation
        const response = await anthropic!.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          temperature: Math.min(0.7 + i * 0.1, 1.0), // Cap at 1.0
          system: systemPrompt,
          messages: [
            {
              role: 'user',
              content: userPrompt,
            },
          ],
        })

        const content = response.content[0]
        if (content.type !== 'text') continue

        // Claude API response received
        try {
          // Parse the response using our helper
          const result = this.parseJsonResponse(content.text)
          
          variants.push({
            id: `claude-${Date.now()}-${i}`,
            originalPrompt: request.prompt,
            optimizedPrompt: result.optimizedPrompt,
            changes: result.changes || [],
            modelSpecificFeatures: result.modelSpecificFeatures || [],
            estimatedTokens: this.estimateTokens(result.optimizedPrompt),
          })
          // Successfully created Claude variant
        } catch (parseError) {
          console.error('JSON Parse Error:', parseError)
          // Fallback: create variant with basic optimization if JSON parsing fails
          const fallbackPrompt = this.createFallbackOptimization(request.prompt, request.optimizationLevel)
          variants.push({
            id: `claude-fallback-${Date.now()}-${i}`,
            originalPrompt: request.prompt,
            optimizedPrompt: fallbackPrompt,
            changes: [{ type: 'fallback', description: 'Applied basic cognitive enhancement due to parsing error' }],
            modelSpecificFeatures: ['Fallback optimization applied'],
            estimatedTokens: this.estimateTokens(fallbackPrompt),
          })
          console.log('Created fallback variant due to JSON parsing error')
        }
      } catch (error) {
        console.error('Claude API Error:', error)
        // Create fallback variant even when API call fails
        const fallbackPrompt = this.createFallbackOptimization(request.prompt, request.optimizationLevel)
        variants.push({
          id: `claude-api-fallback-${Date.now()}-${i}`,
          originalPrompt: request.prompt,
          optimizedPrompt: fallbackPrompt,
          changes: [{ type: 'fallback', description: 'Applied fallback cognitive enhancement due to API error' }],
          modelSpecificFeatures: ['Fallback optimization applied due to API failure'],
          estimatedTokens: this.estimateTokens(fallbackPrompt),
        })
        console.log('Created API fallback variant due to Claude API error')
      }
    }

    if (variants.length === 0) {
      // Last resort fallback - create at least one variant
      console.warn('All Claude variant generation attempts failed, creating emergency fallback')
      const emergencyPrompt = this.createFallbackOptimization(request.prompt, request.optimizationLevel)
      variants.push({
        id: `claude-emergency-${Date.now()}`,
        originalPrompt: request.prompt,
        optimizedPrompt: emergencyPrompt,
        changes: [{ type: 'emergency_fallback', description: 'Emergency cognitive enhancement applied' }],
        modelSpecificFeatures: ['Emergency fallback optimization'],
        estimatedTokens: this.estimateTokens(emergencyPrompt),
      })
    }

    // Claude variants generated successfully
    return variants
  }

  private async generateGeminiVariants(
    request: OptimizationRequest,
    count: number,
  ): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const model = googleAI!.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const systemPrompt = this.systemPrompts[request.optimizationLevel]
    const modelStrategies = this.getModelSpecificStrategies(request.targetModel)
    const { taskType, suggestedTechniques, cognitiveProfile } = this.detectTaskTypeAndTechniques(request.prompt)

    for (let i = 0; i < count; i++) {
      const prompt = `${systemPrompt}

Apply cognitive enhancement optimized for ${request.targetModel}:

Original prompt: "${request.prompt}"

Cognitive Analysis:
- Task type: ${taskType}
- Cognitive profile: ${cognitiveProfile}
- Enhancement level: ${request.optimizationLevel}
- Suggested techniques: ${suggestedTechniques.join(', ')}
${request.constraints ? `- Constraints: ${JSON.stringify(request.constraints)}` : ''}

MODEL-SPECIFIC OPTIMIZATION for ${request.targetModel}:
- Core Strengths: ${modelStrategies.strengths.join(', ')}
- Optimization Focus: ${modelStrategies.optimizationFocus.join('; ')}
- Structural Preferences: ${modelStrategies.structuralPreferences.join('; ')}

Transform this prompt to:
1. Leverage the model's specific strengths
2. Apply cognitive enhancement techniques
3. Maintain clarity while adding depth
4. Enable emergent insights

Return ONLY a JSON object:
{
  "optimizedPrompt": "your cognitively enhanced version",
  "changes": [
    {"type": "enhancement_type", "description": "specific improvement"}
  ],
  "modelSpecificFeatures": ["leveraged capabilities"]
}`

      try {
        const result = await model.generateContent(prompt)
        const text = result.response.text()

        // Parse the response using our helper
        const parsed = this.parseJsonResponse(text)

        variants.push({
          id: `gemini-${Date.now()}-${i}`,
          originalPrompt: request.prompt,
          optimizedPrompt: parsed.optimizedPrompt,
          changes: parsed.changes || [],
          modelSpecificFeatures: parsed.modelSpecificFeatures || [],
          estimatedTokens: this.estimateTokens(parsed.optimizedPrompt),
        })
      } catch (error) {
        // Error generating Gemini variant
      }
    }

    return variants
  }

  private validateInput(request: OptimizationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt cannot be empty')
    }
    if (request.prompt.length > 10000) {
      throw new Error('Prompt exceeds maximum length of 10,000 characters')
    }
  }

  private getVariantCount(level: 'basic' | 'advanced' | 'expert'): number {
    const counts = {
      basic: 1,
      advanced: 3,
      expert: 5,
    }
    return counts[level]
  }

  private createFallbackOptimization(prompt: string, level: OptimizationLevel): string {
    // Basic cognitive enhancement patterns when JSON parsing fails
    const enhancements = {
      basic: [
        'Consider the deeper implications of',
        'Explore the multifaceted nature of',
        'Reflect on the interconnected aspects of'
      ],
      advanced: [
        'Apply systematic cognitive analysis to understand the complex dynamics underlying',
        'Engage in meta-cognitive reflection while examining the layered dimensions of',
        'Synthesize multiple perspectives to develop comprehensive insights about'
      ],
      expert: [
        'Deploy advanced analytical frameworks to deconstruct and reconstruct the cognitive architecture surrounding',
        'Establish recursive feedback loops between analytical and intuitive processing to illuminate the emergent properties of',
        'Integrate cross-domain pattern recognition with recursive self-reflection to unveil the underlying principles governing'
      ]
    }

    const patterns = enhancements[level]
    const selectedPattern = patterns[Math.floor(Math.random() * patterns.length)]
    
    return `${selectedPattern} ${prompt}. What insights emerge from this deeper cognitive engagement?`
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}
