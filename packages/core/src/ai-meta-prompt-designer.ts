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
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null
const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null
const googleAI = process.env.GOOGLE_AI_API_KEY ? new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY) : null

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
        throw new Error(`JSON parsing failed: ${e2 instanceof Error ? e2.message : String(e2)}`)
      }
    }
  }
  
  private systemPrompts = {
    basic: `You are an expert at enhancing prompts to elicit better reasoning and understanding. Your goal is to transform the given prompt to encourage deeper thinking without being prescriptive.

Focus on:
- Clarifying intent without over-specifying
- Encouraging step-by-step reasoning where helpful
- Making the task clear while allowing creative approaches`,
    
    advanced: `You are an expert at applying advanced prompting techniques that enhance AI reasoning capabilities. Transform the given prompt using sophisticated approaches:

Available techniques:
- Few-Shot Chain-of-Thought: Provide examples that show reasoning process
- Self-Consistency: Encourage exploring multiple reasoning paths
- ReAct: Combine reasoning with action steps
- Tree of Thought: Enable exploration of different solution branches

Apply techniques that:
- Guide thinking process, not output format
- Enhance reasoning capability
- Encourage exploration of solutions
- Maintain flexibility in approach`,
    
    expert: `You are an expert at applying state-of-the-art prompting techniques for optimal AI performance. Transform prompts using sophisticated cognitive enhancement approaches.

AVOID these traditional prompt engineering patterns:
- Role assignments ("You are a...")
- Rigid section requirements ("Required sections:...")
- Prescriptive formatting ("Format as:...")
- Detailed step-by-step instructions
- Long lists of requirements

INSTEAD, use these advanced techniques:
- Few-Shot Chain-of-Thought: Show reasoning through examples
- Self-Consistency: Encourage exploration of multiple approaches
- Tree of Thought: Enable branching exploration
- Guided Discovery: Lead to insights without prescribing paths

For writing tasks specifically:
- Provide thinking patterns, not structure templates
- Show reasoning examples, not format requirements
- Enable exploration, not rigid compliance
- Guide discovery, not dictate output`
  }

  private detectTaskTypeAndTechniques(prompt: string): { taskType: string; suggestedTechniques: string[] } {
    const lowerPrompt = prompt.toLowerCase()
    
    // Writing tasks - benefit from examples and structured thinking
    if (lowerPrompt.includes('write') || lowerPrompt.includes('article') || lowerPrompt.includes('essay') || lowerPrompt.includes('story')) {
      return {
        taskType: 'creative_writing',
        suggestedTechniques: ['Few-Shot Examples', 'Guided Exploration', 'Iterative Refinement']
      }
    }
    
    // Analysis tasks - benefit from systematic reasoning
    if (lowerPrompt.includes('analyze') || lowerPrompt.includes('explain') || lowerPrompt.includes('compare')) {
      return {
        taskType: 'analysis',
        suggestedTechniques: ['Chain-of-Thought', 'Self-Consistency', 'Multi-perspective Analysis']
      }
    }
    
    // Problem solving - benefit from exploration
    if (lowerPrompt.includes('solve') || lowerPrompt.includes('calculate') || lowerPrompt.includes('determine')) {
      return {
        taskType: 'problem_solving',
        suggestedTechniques: ['Tree of Thought', 'Step-by-step Reasoning', 'Multiple Solution Paths']
      }
    }
    
    // Code generation - benefit from examples and patterns
    if (lowerPrompt.includes('code') || lowerPrompt.includes('function') || lowerPrompt.includes('implement')) {
      return {
        taskType: 'coding',
        suggestedTechniques: ['Few-Shot Code Examples', 'ReAct Pattern', 'Test-Driven Approach']
      }
    }
    
    // Research tasks - benefit from retrieval and synthesis
    if (lowerPrompt.includes('research') || lowerPrompt.includes('find') || lowerPrompt.includes('discover')) {
      return {
        taskType: 'research',
        suggestedTechniques: ['IR-CoT', 'Evidence-based Reasoning', 'Source Integration']
      }
    }
    
    return {
      taskType: 'general',
      suggestedTechniques: ['Adaptive Reasoning', 'Context-aware Optimization']
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
          if (!anthropic) throw new Error('Anthropic API key not configured')
          // Using Anthropic Claude API for optimization
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
      throw new Error(`Failed to generate AI-optimized variants: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async generateOpenAIVariants(request: OptimizationRequest, count: number): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const systemPrompt = this.systemPrompts[request.optimizationLevel]
    
    // Generate multiple variants
    for (let i = 0; i < count; i++) {
      const variantPrompt = `${systemPrompt}

Original prompt: "${request.prompt}"
Target model: ${request.targetModel}
Task type: ${request.taskType || 'general'}
${request.constraints ? `Constraints: ${JSON.stringify(request.constraints)}` : ''}

Generate an optimized version of this prompt. Return your response in the following JSON format:
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
            { role: 'user', content: variantPrompt }
          ],
          temperature: Math.min(0.7 + (i * 0.1), 1.0), // Cap at 1.0 // Vary temperature for diversity
          max_tokens: 1000,
          response_format: { type: "json_object" }
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
          estimatedTokens: this.estimateTokens(result.optimizedPrompt)
        })
      } catch (error) {
        // Error generating OpenAI variant
      }
    }
    
    return variants
  }

  private async generateClaudeVariants(request: OptimizationRequest, count: number): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const systemPrompt = this.systemPrompts[request.optimizationLevel]
    
    // Detect task type and suggested techniques
    const { taskType, suggestedTechniques } = this.detectTaskTypeAndTechniques(request.prompt)
    // Task type and techniques detected
    
    for (let i = 0; i < count; i++) {
      const userPrompt = `Transform this prompt to enhance reasoning and performance:

"${request.prompt}"

Context:
- Detected task type: ${taskType}
- Optimization level: ${request.optimizationLevel}
- Target model: ${request.targetModel}
- Suggested techniques: ${suggestedTechniques.join(', ')}
${request.constraints ? `- Constraints: ${JSON.stringify(request.constraints)}` : ''}

Transform this prompt by applying the suggested techniques. Here's what we're looking for:

GOOD example (for a writing task):
"Consider different approaches to explaining artificial intelligence. You might explore it through historical development, current applications, or future implications. What connections and insights emerge as you think about this topic?"

BAD example (too prescriptive):
"You are an expert writer. Create an article with these sections: 1) Introduction 2) Definition 3) Applications..."

Apply the techniques to create a prompt that:
- Enhances thinking without constraining approach
- Uses examples or patterns to guide reasoning
- Encourages exploration and discovery
- Avoids rigid requirements or role-playing

Return JSON with:
{
  "optimizedPrompt": "the transformed prompt using appropriate techniques",
  "changes": [
    {"type": "technique_name", "description": "how it enhances reasoning"}
  ],
  "modelSpecificFeatures": ["leveraged capabilities"]
}`

      try {
        // Calling Claude API for variant generation
        const response = await anthropic!.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          temperature: Math.min(0.7 + (i * 0.1), 1.0), // Cap at 1.0
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: userPrompt
          }]
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
          estimatedTokens: this.estimateTokens(result.optimizedPrompt)
        })
        // Successfully created Claude variant
      } catch (error) {
        // Error generating Claude variant
      }
    }
    
    if (variants.length === 0) {
      // Failed to generate any Claude variants
      throw new Error('Failed to generate any Claude variants')
    }
    
    // Claude variants generated successfully
    return variants
  }

  private async generateGeminiVariants(request: OptimizationRequest, count: number): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const model = googleAI!.getGenerativeModel({ model: 'gemini-1.5-flash' })
    
    for (let i = 0; i < count; i++) {
      const prompt = `As an expert prompt engineer, optimize this prompt for ${request.targetModel}:

Original: "${request.prompt}"

Context:
- Task type: ${request.taskType || 'general'}
- Level: ${request.optimizationLevel}
${request.constraints ? `- Constraints: ${JSON.stringify(request.constraints)}` : ''}

Return ONLY a JSON object with this structure:
{
  "optimizedPrompt": "your optimized version",
  "changes": [
    {"type": "category", "description": "what changed"}
  ],
  "modelSpecificFeatures": ["features used"]
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
          estimatedTokens: this.estimateTokens(parsed.optimizedPrompt)
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
      expert: 5
    }
    return counts[level]
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}