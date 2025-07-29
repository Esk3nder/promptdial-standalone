import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment variables from multiple possible locations
const envPaths = [
  resolve(process.cwd(), '../../.env'), // From packages/core
  resolve(process.cwd(), '../../../.env'), // From packages/core/dist
  resolve(process.cwd(), '.env'), // Local .env
  resolve(__dirname, '../../../.env'), // Relative to this file
  resolve(__dirname, '../../../../.env'), // From dist build
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
  hasGoogle: !!process.env.GOOGLE_AI_API_KEY,
})

// Types
export interface OptimizationRequest {
  prompt: string
  targetModel?: string
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
    apiKeyLength: process.env.ANTHROPIC_API_KEY?.length || 0,
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
    const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
    if (codeBlockMatch) {
      try {
        return JSON.parse(codeBlockMatch[1].trim())
      } catch (e) {
        // Continue to other strategies
      }
    }

    // Strategy 3: Find JSON by looking for opening and closing braces
    // This improved regex handles nested objects and arrays better
    let braceCount = 0
    let inString = false
    let escapeNext = false
    let jsonStart = -1
    let jsonEnd = -1

    for (let i = 0; i < text.length; i++) {
      const char = text[i]
      
      if (escapeNext) {
        escapeNext = false
        continue
      }
      
      if (char === '\\') {
        escapeNext = true
        continue
      }
      
      if (char === '"' && !escapeNext) {
        inString = !inString
        continue
      }
      
      if (!inString) {
        if (char === '{') {
          if (jsonStart === -1) jsonStart = i
          braceCount++
        } else if (char === '}') {
          braceCount--
          if (braceCount === 0 && jsonStart !== -1) {
            jsonEnd = i + 1
            break
          }
        }
      }
    }

    if (jsonStart !== -1 && jsonEnd !== -1) {
      const jsonStr = text.substring(jsonStart, jsonEnd)
      try {
        return JSON.parse(jsonStr)
      } catch (e) {
        console.error('Failed to parse extracted JSON:', jsonStr.substring(0, 100))
      }
    }

    // Strategy 4: Try a more lenient regex that handles multiline
    const jsonMatch = text.match(/\{[\s\S]*?\}/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0])
      } catch (e) {
        // Continue to last strategy
      }
    }

    // Strategy 5: Last resort - find anything between first { and last }
    const firstBrace = text.indexOf('{')
    const lastBrace = text.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const possibleJson = text.substring(firstBrace, lastBrace + 1)
      try {
        return JSON.parse(possibleJson)
      } catch (e) {
        console.error('Final parse attempt failed:', e instanceof Error ? e.message : String(e))
      }
    }

    // All strategies failed
    throw new Error(
      `Unable to extract valid JSON from Claude response. Response preview: ${text.substring(0, 200)}...`,
    )
  }

  private systemPrompt = `You are an expert prompt optimizer. Your role is to enhance prompts for specific AI models by applying proven techniques that improve clarity, effectiveness, and task completion.

KEY PRINCIPLES:
1. Match optimization to task type - factual questions need precision, creative tasks need inspiration
2. Apply specific techniques based on what actually works for the task
3. Keep optimizations practical and directly useful
4. Preserve the original intent while enhancing effectiveness
5. Adapt style to the target model's strengths

OPTIMIZATION FOCUS:
- For factual questions: Add precision and context without philosophical tangents
- For analytical tasks: Structure thinking steps clearly
- For creative tasks: Provide inspiration while maintaining focus
- For coding tasks: Include technical specifications and constraints
- For planning tasks: Break down into actionable components

IMPORTANT: Never transform simple questions into philosophical explorations unless that's the actual intent.`

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
          'Clear step-by-step reasoning for complex problems',
          'Comprehensive analysis with structured outputs',
          'Balanced perspectives on nuanced topics',
          'Detailed explanations when needed',
        ],
        structuralPreferences: [
          'Natural language with clear organization',
          'Context and constraints upfront',
          'Specific examples to guide responses',
          'Clear success criteria',
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

    // Simple factual questions
    if (
      (lowerPrompt.includes('what is') || 
       lowerPrompt.includes('who is') ||
       lowerPrompt.includes('where is') ||
       lowerPrompt.includes('when is')) &&
      questionCount === 1 &&
      prompt.length < 50
    ) {
      return {
        taskType: 'factual_query',
        suggestedTechniques: [
          'Direct Answer',
          'Context Addition',
          'Precision Enhancement',
        ],
        cognitiveProfile: 'factual-direct',
      }
    }

    // Creative writing tasks
    if (
      lowerPrompt.includes('write') ||
      lowerPrompt.includes('article') ||
      lowerPrompt.includes('essay') ||
      lowerPrompt.includes('story') ||
      lowerPrompt.includes('narrative') ||
      lowerPrompt.includes('compose')
    ) {
      return {
        taskType: 'creative_writing',
        suggestedTechniques: [
          'Few-Shot Examples',
          'Structure Template',
          'Style Guidelines',
          'Output Format Specification',
        ],
        cognitiveProfile: 'creative-structured',
      }
    }

    // Analysis tasks
    if (
      lowerPrompt.includes('analyze') ||
      lowerPrompt.includes('explain') ||
      lowerPrompt.includes('compare') ||
      lowerPrompt.includes('evaluate') ||
      lowerPrompt.includes('assess')
    ) {
      return {
        taskType: 'analysis',
        suggestedTechniques: [
          'Chain of Thought',
          'Step-by-Step Breakdown',
          'Comparison Framework',
          'Evaluation Criteria',
        ],
        cognitiveProfile: 'analytical-systematic',
      }
    }

    // Problem solving
    if (
      lowerPrompt.includes('solve') ||
      lowerPrompt.includes('calculate') ||
      lowerPrompt.includes('determine') ||
      lowerPrompt.includes('optimize') ||
      lowerPrompt.includes('figure out')
    ) {
      return {
        taskType: 'problem_solving',
        suggestedTechniques: [
          'ReAct Framework',
          'Step-by-Step Solution',
          'Constraint Specification',
          'Solution Verification',
        ],
        cognitiveProfile: 'logical-systematic',
      }
    }

    // Coding tasks
    if (
      lowerPrompt.includes('code') ||
      lowerPrompt.includes('function') ||
      lowerPrompt.includes('implement') ||
      lowerPrompt.includes('program') ||
      lowerPrompt.includes('algorithm')
    ) {
      return {
        taskType: 'coding',
        suggestedTechniques: [
          'Code Structure Template',
          'Input/Output Examples',
          'Language Specification',
          'Error Handling Requirements',
        ],
        cognitiveProfile: 'technical-precise',
      }
    }

    // Research/information gathering
    if (
      lowerPrompt.includes('research') ||
      lowerPrompt.includes('find') ||
      lowerPrompt.includes('list') ||
      lowerPrompt.includes('investigate') ||
      lowerPrompt.includes('gather')
    ) {
      return {
        taskType: 'research',
        suggestedTechniques: [
          'Structured Information Request',
          'Source Requirements',
          'Format Specification',
          'Scope Definition',
        ],
        cognitiveProfile: 'informational-comprehensive',
      }
    }

    // Planning tasks
    if (
      lowerPrompt.includes('plan') ||
      lowerPrompt.includes('strategy') ||
      lowerPrompt.includes('design') ||
      lowerPrompt.includes('architect')
    ) {
      return {
        taskType: 'planning',
        suggestedTechniques: [
          'Goal Specification',
          'Timeline Structure',
          'Resource Constraints',
          'Success Metrics',
        ],
        cognitiveProfile: 'strategic-structured',
      }
    }

    // How-to questions
    if (lowerPrompt.includes('how to') || lowerPrompt.includes('how do')) {
      return {
        taskType: 'instructional',
        suggestedTechniques: [
          'Step-by-Step Instructions',
          'Prerequisites',
          'Common Pitfalls',
          'Success Verification',
        ],
        cognitiveProfile: 'instructional-clear',
      }
    }

    // Default general approach
    return {
      taskType: 'general',
      suggestedTechniques: [
        'Context Enhancement',
        'Clear Objectives',
        'Output Format',
        'Scope Definition',
      ],
      cognitiveProfile: 'general-purpose',
    }
  }

  async generateVariants(request: OptimizationRequest): Promise<OptimizedVariant[]> {
    // Generating variants for optimization request

    this.validateInput(request)
    
    // Auto-detect model if not specified
    if (!request.targetModel) {
      if (getAnthropic()) request.targetModel = 'claude-3-opus'
      else if (getOpenAI()) request.targetModel = 'gpt-4'
      else if (getGoogleAI()) request.targetModel = 'gemini-1.5-pro'
      else throw new Error('No API keys configured')
    }

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
      // const modelStrategies = this.getModelSpecificStrategies(request.targetModel!)
      const { taskType, suggestedTechniques } = this.detectTaskTypeAndTechniques(request.prompt)

      const variantPrompt = `Optimize this prompt for ${request.targetModel!}:

"${request.prompt}"

Task type: ${taskType}
Techniques to apply: ${suggestedTechniques.join(', ')}
${request.constraints ? `Constraints: ${JSON.stringify(request.constraints)}` : ''}

Based on the task type "${taskType}", apply appropriate optimizations:
- Focus on clarity and effectiveness
- Use the suggested techniques where applicable
- Keep the optimization practical and useful
- Don't make it philosophical unless that's the intent

Return JSON with your optimization:
{
  "optimizedPrompt": "the optimized prompt text",
  "changes": [
    {"type": "technique_used", "description": "specific improvement"}
  ],
  "modelSpecificFeatures": ["features leveraged"],
  "reasoning": "brief explanation"
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
      const modelStrategies = this.getModelSpecificStrategies(request.targetModel!)

      const userPrompt = `Optimize this prompt for ${request.targetModel || 'the target model'}:

"${request.prompt}"

Task Analysis:
- Task type: ${taskType}
- Optimization approach: ${cognitiveProfile}
- Suggested techniques: ${suggestedTechniques.join(', ')}
${request.constraints ? `- Constraints: ${JSON.stringify(request.constraints)}` : ''}

MODEL CAPABILITIES for ${request.targetModel}:
- Strengths: ${modelStrategies.strengths.slice(0, 3).join(', ')}
- Best practices: ${modelStrategies.optimizationFocus.slice(0, 2).join('; ')}

OPTIMIZATION GUIDELINES based on task type "${taskType}":

${taskType === 'factual_query' ? `
For factual questions:
- Add minimal context to clarify ambiguity
- Specify desired detail level if needed
- Keep the question direct and focused
- Example: "What is X?" → "What is X? Provide a brief, accurate answer."
` : ''}

${taskType === 'creative_writing' ? `
For creative writing:
- Add structure guidance (e.g., format, length, style)
- Include genre or tone specifications
- Provide clear success criteria
- Example: "Write a story" → "Write a 500-word story in [genre] style about [topic], focusing on [theme]"
` : ''}

${taskType === 'analysis' ? `
For analysis tasks:
- Break down into clear analytical steps
- Specify comparison criteria or frameworks
- Define scope and depth expectations
- Example: "Analyze X" → "Analyze X by examining: 1) [aspect], 2) [aspect], 3) [aspect]. Provide evidence-based conclusions."
` : ''}

${taskType === 'problem_solving' ? `
For problem solving:
- Clarify constraints and requirements
- Request step-by-step approach
- Define success criteria
- Example: "Solve X" → "Solve X step-by-step. Show your reasoning at each step and verify the solution."
` : ''}

${taskType === 'coding' ? `
For coding tasks:
- Specify language and version
- Include input/output examples
- Define error handling needs
- Example: "Write a function" → "Write a [language] function that [does X]. Input: [example]. Expected output: [example]."
` : ''}

${taskType === 'research' ? `
For research tasks:
- Define scope and sources
- Specify format for results
- Clarify depth requirements
- Example: "Research X" → "Research X and provide: 1) Key findings, 2) Main sources, 3) Summary in bullet points"
` : ''}

${taskType === 'planning' ? `
For planning tasks:
- Define timeline and milestones
- Specify constraints/resources
- Request actionable steps
- Example: "Plan X" → "Create a plan for X with: timeline, key milestones, resource requirements, and success metrics"
` : ''}

${taskType === 'instructional' ? `
For how-to instructions:
- Request numbered steps
- Include prerequisites
- Add troubleshooting tips
- Example: "How to X" → "Explain how to X with: 1) Prerequisites, 2) Step-by-step instructions, 3) Common issues and solutions"
` : ''}

Apply the appropriate techniques from: ${suggestedTechniques.join(', ')}

IMPORTANT: 
- Keep the optimization practical and task-focused
- Preserve the original intent
- Don't add philosophical elements unless the task requires them
- Make the prompt clearer and more effective, not longer

Return your response as valid JSON only, with no additional text before or after:
{
  "optimizedPrompt": "the optimized prompt text",
  "changes": [
    {"type": "technique_name", "description": "specific improvement"}
  ],
  "modelSpecificFeatures": ["feature utilized"]
}`

      try {
        // Calling Claude API for variant generation
        const response = await getAnthropic()!.messages.create({
          model: 'claude-3-5-sonnet-20240620',
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
    // const systemPrompt = this.systemPrompt
    // const modelStrategies = this.getModelSpecificStrategies(request.targetModel!)
    const { taskType, suggestedTechniques, cognitiveProfile } = this.detectTaskTypeAndTechniques(
      request.prompt,
    )

    for (let i = 0; i < count; i++) {
      const prompt = `Optimize this prompt for practical use:

Original prompt: "${request.prompt}"

Task Analysis:
- Task type: ${taskType}
- Optimization approach: ${cognitiveProfile}
- Techniques to apply: ${suggestedTechniques.join(', ')}
${request.constraints ? `- Constraints: ${JSON.stringify(request.constraints)}` : ''}

Apply optimizations based on the task type "${taskType}":
1. Make the prompt clearer and more effective
2. Apply the suggested techniques where helpful
3. Keep it practical and focused on the task
4. Preserve the original intent

Return ONLY a JSON object:
{
  "optimizedPrompt": "your optimized version",
  "changes": [
    {"type": "technique_name", "description": "specific improvement"}
  ],
  "modelSpecificFeatures": ["features utilized"]
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
