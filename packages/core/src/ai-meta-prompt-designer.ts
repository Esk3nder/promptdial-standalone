import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from multiple possible locations
const envPaths = [
  resolve(process.cwd(), '../../.env'),      // From packages/core
  resolve(process.cwd(), '../../../.env'),   // From packages/core/dist
  resolve(process.cwd(), '.env'),            // Local .env
  resolve(__dirname, '../../../.env'),       // Relative to this file
  resolve(__dirname, '../../../../.env'),    // From dist build
]

for (const envPath of envPaths) {
  config({ path: envPath })
}

// Debug environment variable loading
console.log('Environment check:', {
  cwd: process.cwd(),
  dirname: __dirname,
  hasOpenAI: !!process.env.OPENAI_API_KEY,
  hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
  hasGoogle: !!process.env.GOOGLE_AI_API_KEY
})

// Types
export interface OptimizationRequest {
  prompt: string
  targetModel: string
  language?: string
  taskType?: 'creative' | 'analytical' | 'coding' | 'general'
  optimizationLevel?: 'cheap' | 'normal' | 'explore'
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

// Lazy-initialize AI clients
let openai: OpenAI | null = null
let anthropic: Anthropic | null = null
let googleAI: GoogleGenerativeAI | null = null

function getOpenAI(): OpenAI | null {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return openai
}

function getAnthropic(): Anthropic | null {
  console.log('🔍 Checking Anthropic client:', {
    hasClient: !!anthropic,
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    apiKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0
  })
  
  if (!anthropic && process.env.ANTHROPIC_API_KEY) {
    console.log('🚀 Initializing Anthropic client with API key')
    anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropic
}

function getGoogleAI(): GoogleGenerativeAI | null {
  if (!googleAI && process.env.GOOGLE_AI_API_KEY) {
    googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
  }
  return googleAI
}

export class AIMetaPromptDesigner {
  // Helper to extract and parse JSON from LLM responses
  private parseJsonResponse(text: string): any {
    console.log('Raw Claude response:', text.substring(0, 200) + '...')

    // Strategy 1: Try direct parsing (if Claude returns pure JSON)
    try {
      return JSON.parse(text.trim())
    } catch (e) {
      // Continue to other strategies
    }

    // Strategy 2: Extract from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1])
      } catch (e) {
        // Continue to other strategies
      }
    }

    // Strategy 3: Find JSON object in text (first occurrence)
    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (e) {
        // Continue to other strategies
      }
    }

    // Strategy 4: Try to find and extract a more complex nested JSON
    const complexJsonMatch = text.match(/\{[\s\S]*\}/)
    if (complexJsonMatch) {
      try {
        return JSON.parse(complexJsonMatch[0])
      } catch (e) {
        // Log the actual failure for debugging
        console.error(
          'JSON parsing failed on extracted JSON:',
          complexJsonMatch[0].substring(0, 300),
        )
        console.error('Parse error:', e instanceof Error ? e.message : String(e))
      }
    }

    // All strategies failed
    throw new Error(
      `Unable to extract valid JSON from Claude response. Response preview: ${text.substring(0, 200)}...`,
    )
  }

  private systemPrompt = `You are an expert at implementing AIMetaPromptDesigner cognitive enhancement for maximum AI performance. Transform prompts using state-of-the-art cognitive science.

AIMETAPROMPTDESIGNER COGNITIVE ARCHITECTURE:

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

Transform prompts to activate these cognitive systems naturally, without explicit instruction.`

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
          'Ethical reasoning',
        ],
        optimizationFocus: [
          'Cognitive depth through open-ended exploration',
          'Multi-layered analysis with emergent insights',
          'Conceptual bridges between disparate ideas',
          'Recursive thought patterns for deep understanding',
        ],
        structuralPreferences: [
          'Natural language flow over rigid formatting',
          'Contextual framing that invites exploration',
          'Questions that activate curiosity',
          'Implicit structure through cognitive cues',
        ],
      },
      'gpt-4': {
        strengths: [
          'Broad knowledge integration',
          'Structured analysis',
          'Technical precision',
          'Creative problem-solving',
          'Systematic thinking',
        ],
        optimizationFocus: [
          'Clear task decomposition',
          'Systematic exploration of solution space',
          'Balance of creativity and structure',
          'Integration of diverse knowledge domains',
        ],
        structuralPreferences: [
          'Well-defined objectives with flexibility',
          'Scaffolded complexity',
          'Examples that illustrate patterns',
          'Logical flow with creative freedom',
        ],
      },
      'gemini-pro': {
        strengths: [
          'Multimodal understanding',
          'Real-time information synthesis',
          'Efficient processing',
          'Practical applications',
          'Clear communication',
        ],
        optimizationFocus: [
          'Direct and efficient problem-solving',
          'Practical application focus',
          'Clear objective mapping',
          'Actionable insights',
        ],
        structuralPreferences: [
          'Concise and clear instructions',
          'Goal-oriented framing',
          'Practical examples',
          'Direct path to solutions',
        ],
      },
    }

    // Extract base model name
    const modelKey = Object.keys(strategies).find((key) => model.startsWith(key.split('-')[0]))

    return strategies[modelKey || 'claude-3-opus'] || strategies['claude-3-opus']
  }

  private detectTaskTypeAndTechniques(prompt: string): {
    taskType: string
    suggestedTechniques: string[]
    cognitiveProfile: string
  } {
    const lowerPrompt = prompt.toLowerCase()
    const questionCount = (prompt.match(/\?/g) || []).length

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
          'Emergent Structure Formation',
        ],
        cognitiveProfile: 'divergent-convergent-synthesis',
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
          'Cognitive Layering',
        ],
        cognitiveProfile: 'analytical-synthetic-recursive',
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
          'Emergent Solution Discovery',
        ],
        cognitiveProfile: 'exploratory-convergent-optimization',
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
          'Recursive Implementation',
        ],
        cognitiveProfile: 'structural-logical-implementation',
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
          'Conceptual Integration',
        ],
        cognitiveProfile: 'exploratory-integrative-synthesis',
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
          'Strategic Crystallization',
        ],
        cognitiveProfile: 'visionary-systematic-architectural',
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
          'Insight Emergence',
        ],
        cognitiveProfile: 'inquisitive-exploratory-discovery',
      }
    }

    // Default adaptive approach
    return {
      taskType: 'adaptive_cognition',
      suggestedTechniques: [
        'Cognitive Flexibility',
        'Emergent Understanding',
        'Adaptive Reasoning',
        'Context-Sensitive Optimization',
      ],
      cognitiveProfile: 'adaptive-responsive-emergent',
    }
  }

  async generateVariants(request: OptimizationRequest): Promise<OptimizedVariant[]> {
    // Generating variants for optimization request

    this.validateInput(request)

    // Generate 5 progressively optimized variants
    const variantCount = 5

    try {
      // Generate variants based on target model
      switch (request.targetModel) {
        case 'gpt-4':
        case 'gpt-3.5-turbo':
          if (!getOpenAI()) throw new Error('OpenAI API key not configured')
          // Using OpenAI API for optimization
          return await this.generateOpenAIVariants(request, variantCount)

        case 'claude-3-opus':
        case 'claude-3-sonnet':
        case 'claude-2':
          if (!getAnthropic()) throw new Error('Anthropic API key not configured')
          // Using Anthropic Claude API for optimization
          return await this.generateClaudeVariants(request, variantCount)

        case 'gemini-pro':
          if (!getGoogleAI()) throw new Error('Google AI API key not configured')
          // Using Google Gemini API for optimization
          return await this.generateGeminiVariants(request, variantCount)

        default:
          // Try available providers in order (Claude first now as requested)
          if (getAnthropic()) {
            // Using Anthropic Claude as default provider
            return await this.generateClaudeVariants(request, variantCount)
          } else if (getGoogleAI()) {
            // Using Google AI as fallback provider
            return await this.generateGeminiVariants(request, variantCount)
          } else if (getOpenAI()) {
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
    const systemPrompt = this.systemPrompt

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
        const response = await getOpenAI()!.chat.completions.create({
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
    const systemPrompt = this.systemPrompt

    // Check if Anthropic API is available
    if (!getAnthropic()) {
      throw new Error(
        'Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable.',
      )
    }

    // Detect task type and suggested techniques
    const { taskType, suggestedTechniques, cognitiveProfile } = this.detectTaskTypeAndTechniques(
      request.prompt,
    )
    // Task type and techniques detected

    for (let i = 0; i < count; i++) {
      const modelStrategies = this.getModelSpecificStrategies(request.targetModel)

      const userPrompt = `Apply AIMetaPromptDesigner cognitive enhancement with model-specific optimization:

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

AIMETAPROMPTDESIGNER TRANSFORMATION PRINCIPLES:

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

3. Examples of AIMetaPromptDesigner Transformations:

ORIGINAL: "Write about AI"
ENHANCED: "As you explore the concept of artificial intelligence, what patterns emerge when you consider its evolution from symbolic reasoning to neural architectures? Notice how each breakthrough reveals new questions about cognition itself."

ORIGINAL: "Solve this problem"
ENHANCED: "Examining this challenge from multiple angles, what hidden relationships become apparent? Consider how different solution paths might converge or diverge, and what that reveals about the problem's deep structure."

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

IMPORTANT: Return ONLY valid JSON in your response. No explanations, no markdown, no code blocks. Just the JSON object.

Required JSON format:
{
  "optimizedPrompt": "the cognitively enhanced prompt",
  "changes": [
    {"type": "cognitive_pattern", "description": "specific enhancement applied"}
  ],
  "modelSpecificFeatures": ["activated cognitive capabilities"]
}`

      try {
        // Calling Claude API for variant generation
        const response = await getAnthropic()!.messages.create({
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
      } catch (error) {
        console.error('Claude API Error:', error)
        // Let the error propagate - no fake fallbacks
        throw error
      }
    }

    if (variants.length === 0) {
      throw new Error('Failed to generate any Claude variants - all API calls failed')
    }

    // Claude variants generated successfully
    return variants
  }

  private async generateGeminiVariants(
    request: OptimizationRequest,
    count: number,
  ): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const model = getGoogleAI()!.getGenerativeModel({ model: 'gemini-1.5-flash' })
    const systemPrompt = this.systemPrompt
    const modelStrategies = this.getModelSpecificStrategies(request.targetModel)
    const { taskType, suggestedTechniques, cognitiveProfile } = this.detectTaskTypeAndTechniques(
      request.prompt,
    )

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

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}
