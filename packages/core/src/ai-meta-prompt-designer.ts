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
      const result = JSON.parse(text.trim())
      console.log('Strategy 1 SUCCESS: Direct parse')
      return result
    } catch (e) {
      console.log('Strategy 1 FAILED: Direct parse')
    }

    // Strategy 2: Extract from markdown code blocks
    const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/)
    if (codeBlockMatch) {
      console.log('Strategy 2: Found code block match')
      try {
        const result = JSON.parse(codeBlockMatch[1])
        console.log('Strategy 2 SUCCESS: Code block')
        return result
      } catch (e) {
        console.log('Strategy 2 FAILED: Code block parse error')
      }
    } else {
      console.log('Strategy 2: No code block found')
    }

    // Strategy 3: Try to extract from first { to first complete }
    const firstBraceIndex = text.indexOf('{')
    if (firstBraceIndex !== -1) {
      // Find matching closing brace or go to end
      let braceCount = 0
      let endIndex = firstBraceIndex
      
      for (let i = firstBraceIndex; i < text.length; i++) {
        if (text[i] === '{') braceCount++
        else if (text[i] === '}') braceCount--
        
        if (braceCount === 0) {
          endIndex = i + 1
          break
        }
        endIndex = i + 1
      }
      
      const extractedJson = text.substring(firstBraceIndex, endIndex)
      console.log('Strategy 3: Extracted JSON from braces, length:', extractedJson.length)
      console.log('Strategy 3: JSON preview:', extractedJson.substring(0, 100))
      
      try {
        const result = JSON.parse(extractedJson)
        console.log('Strategy 3 SUCCESS: Brace-matched JSON')
        return result
      } catch (e) {
        console.log('Strategy 3 FAILED: Brace-matched JSON, attempting completion')
        
        // Try to complete the JSON
        const completedJson = this.attemptJsonCompletion(extractedJson)
        if (completedJson) {
          try {
            const result = JSON.parse(completedJson)
            console.log('Strategy 3 COMPLETION SUCCESS: JSON completion worked')
            return result
          } catch (e2) {
            console.log('Strategy 3 COMPLETION FAILED:', e2.message)
          }
        }
      }
    } else {
      console.log('Strategy 3: No opening brace found')
    }

    // All strategies failed
    throw new Error(
      `Unable to extract valid JSON from Claude response. Response preview: ${text.substring(0, 200)}...`,
    )
  }

  // Attempt to complete truncated JSON responses
  private attemptJsonCompletion(truncatedJson: string): string | null {
    try {
      let trimmed = truncatedJson.trim()
      
      // Clean up control characters inside JSON strings only
      let inString = false
      let result = ''
      
      for (let i = 0; i < trimmed.length; i++) {
        const char = trimmed[i]
        
        if (char === '"' && (i === 0 || trimmed[i-1] !== '\\')) {
          inString = !inString
          result += char
        } else if (inString) {
          // Inside a string - escape control characters
          switch (char) {
            case '\n': result += '\\n'; break
            case '\r': result += '\\r'; break  
            case '\t': result += '\\t'; break
            case '\b': result += '\\b'; break
            case '\f': result += '\\f'; break
            default: 
              if (char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) {
                // Skip other control characters
              } else {
                result += char
              }
          }
        } else {
          // Outside string - keep as is (including structural newlines)
          result += char
        }
      }
      
      trimmed = result
      
      // First check if JSON is already valid after cleaning
      try {
        JSON.parse(trimmed)
        return null // Already valid, no completion needed
      } catch {
        // Continue with completion logic
      }
      
      let completed = trimmed
      
      // Smart quote handling - find unclosed strings
      let insideString = false
      let lastQuoteIndex = -1
      let needsClosingQuote = false
      
      for (let i = 0; i < completed.length; i++) {
        if (completed[i] === '"' && (i === 0 || completed[i-1] !== '\\')) {
          insideString = !insideString
          lastQuoteIndex = i
        }
      }
      
      // If we ended in a string, we need to close it
      if (insideString) {
        // Check if the string ends abruptly (no closing quote before next structural character)
        const afterLastQuote = completed.substring(lastQuoteIndex + 1)
        if (!afterLastQuote.includes('"')) {
          completed += '"'
          needsClosingQuote = true
        }
      }
      
      // Handle missing commas after property values
      if (!completed.endsWith(',') && !completed.endsWith('}') && !completed.endsWith(']')) {
        // Check if we just closed a string and need a comma
        if (needsClosingQuote || completed.endsWith('"')) {
          // Look ahead to see if there might be more properties
          const remainingBraces = (completed.match(/\{/g) || []).length - (completed.match(/\}/g) || []).length
          if (remainingBraces > 0) {
            // There are unclosed braces, probably more properties coming
            // Don't add comma here, let the missing braces logic handle it
          }
        }
      }
      
      // Count opening and closing braces to balance them
      const openBraces = (completed.match(/\{/g) || []).length
      const closeBraces = (completed.match(/\}/g) || []).length
      const missingBraces = openBraces - closeBraces
      
      if (missingBraces > 0) {
        completed += '}'.repeat(missingBraces)
      }
      
      // Count opening and closing brackets to balance them
      const openBrackets = (completed.match(/\[/g) || []).length
      const closeBrackets = (completed.match(/\]/g) || []).length
      const missingBrackets = openBrackets - closeBrackets
      
      if (missingBrackets > 0) {
        completed += ']'.repeat(missingBrackets)
      }
      
      return completed
    } catch {
      return null
    }
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
      const modelStrategies = this.getModelSpecificStrategies(request.targetModel!)
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
          max_tokens: 2000, // Increased to prevent JSON truncation
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

Return ONLY valid JSON (keep response under 1500 characters to avoid truncation):
{
  "optimizedPrompt": "the optimized prompt text",
  "changes": [
    {"type": "technique_name", "description": "specific improvement"}
  ],
  "modelSpecificFeatures": ["feature utilized"]
}

IMPORTANT: Ensure your response is complete JSON that ends with a closing brace.`

      try {
        // Calling Claude API for variant generation
        const response = await getAnthropic()!.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000, // Increased to prevent JSON truncation
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
    const modelStrategies = this.getModelSpecificStrategies(request.targetModel!)
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
