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
  private systemPrompts = {
    basic: `You are an expert prompt engineer. Your task is to optimize the given prompt to be clearer and more effective. Make minimal changes while improving clarity and specificity.`,
    
    advanced: `You are a world-class prompt engineering expert. Optimize the given prompt using advanced techniques:
- Add clear structure and formatting
- Include specific instructions and constraints
- Define expected output format
- Add context and examples where helpful
- Use techniques like few-shot learning when appropriate`,
    
    expert: `You are the world's leading prompt engineering expert. Create a highly optimized prompt using all available techniques:
- Chain of thought reasoning
- Role-based prompting
- Clear task decomposition
- Specific output formatting
- Constraint specification
- Few-shot examples
- Meta-prompting techniques
- Model-specific optimizations
- Token efficiency
- Error handling instructions`
  }

  async generateVariants(request: OptimizationRequest): Promise<OptimizedVariant[]> {
    this.validateInput(request)
    
    const variantCount = this.getVariantCount(request.optimizationLevel)
    const variants: OptimizedVariant[] = []
    
    try {
      // Generate variants based on target model
      switch (request.targetModel) {
        case 'gpt-4':
        case 'gpt-3.5-turbo':
          if (!openai) throw new Error('OpenAI API key not configured')
          return await this.generateOpenAIVariants(request, variantCount)
          
        case 'claude-3-opus':
        case 'claude-3-sonnet':
        case 'claude-2':
          if (!anthropic) throw new Error('Anthropic API key not configured')
          return await this.generateClaudeVariants(request, variantCount)
          
        case 'gemini-pro':
          if (!googleAI) throw new Error('Google AI API key not configured')
          return await this.generateGeminiVariants(request, variantCount)
          
        default:
          // Use OpenAI as default if available
          if (openai) {
            return await this.generateOpenAIVariants(request, variantCount)
          }
          throw new Error('No AI API keys configured')
      }
    } catch (error) {
      console.error('AI optimization error:', error)
      // Fallback to basic optimization if AI fails
      return this.generateFallbackVariants(request, variantCount)
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
          temperature: 0.7 + (i * 0.1), // Vary temperature for diversity
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
          estimatedTokens: this.estimateTokens(result.optimizedPrompt),
          score: 85 + Math.random() * 15 // Placeholder scoring
        })
      } catch (error) {
        console.error(`Error generating OpenAI variant ${i}:`, error)
      }
    }
    
    return variants
  }

  private async generateClaudeVariants(request: OptimizationRequest, count: number): Promise<OptimizedVariant[]> {
    const variants: OptimizedVariant[] = []
    const systemPrompt = this.systemPrompts[request.optimizationLevel]
    
    for (let i = 0; i < count; i++) {
      const userPrompt = `Please optimize this prompt for ${request.targetModel}:

"${request.prompt}"

Requirements:
- Task type: ${request.taskType || 'general'}
- Optimization level: ${request.optimizationLevel}
${request.constraints ? `- Constraints: ${JSON.stringify(request.constraints)}` : ''}

Provide your response in this exact JSON format:
{
  "optimizedPrompt": "the optimized prompt",
  "changes": [
    {"type": "change_type", "description": "what was changed"}
  ],
  "modelSpecificFeatures": ["feature1", "feature2"]
}`

      try {
        const response = await anthropic!.messages.create({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1000,
          temperature: 0.7 + (i * 0.1),
          system: systemPrompt,
          messages: [{
            role: 'user',
            content: userPrompt
          }]
        })

        const content = response.content[0]
        if (content.type !== 'text') continue

        // Claude sometimes adds extra text, so extract JSON
        const jsonMatch = content.text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue

        const result = JSON.parse(jsonMatch[0])
        
        variants.push({
          id: `claude-${Date.now()}-${i}`,
          originalPrompt: request.prompt,
          optimizedPrompt: result.optimizedPrompt,
          changes: result.changes || [],
          modelSpecificFeatures: result.modelSpecificFeatures || [],
          estimatedTokens: this.estimateTokens(result.optimizedPrompt),
          score: 85 + Math.random() * 15
        })
      } catch (error) {
        console.error(`Error generating Claude variant ${i}:`, error)
      }
    }
    
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
        
        // Extract JSON from response
        const jsonMatch = text.match(/\{[\s\S]*\}/)
        if (!jsonMatch) continue

        const parsed = JSON.parse(jsonMatch[0])
        
        variants.push({
          id: `gemini-${Date.now()}-${i}`,
          originalPrompt: request.prompt,
          optimizedPrompt: parsed.optimizedPrompt,
          changes: parsed.changes || [],
          modelSpecificFeatures: parsed.modelSpecificFeatures || [],
          estimatedTokens: this.estimateTokens(parsed.optimizedPrompt),
          score: 85 + Math.random() * 15
        })
      } catch (error) {
        console.error(`Error generating Gemini variant ${i}:`, error)
      }
    }
    
    return variants
  }

  private generateFallbackVariants(request: OptimizationRequest, count: number): OptimizedVariant[] {
    // Basic fallback if AI APIs fail
    const variants: OptimizedVariant[] = []
    
    for (let i = 0; i < count; i++) {
      let optimized = request.prompt
      const changes = []
      
      // Add basic improvements
      if (!optimized.endsWith('.') && !optimized.endsWith('?')) {
        optimized += '.'
        changes.push({ type: 'punctuation', description: 'Added proper punctuation' })
      }
      
      if (request.taskType === 'coding') {
        optimized = `${optimized} Please provide code with comments and error handling.`
        changes.push({ type: 'specificity', description: 'Added coding requirements' })
      }
      
      variants.push({
        id: `fallback-${Date.now()}-${i}`,
        originalPrompt: request.prompt,
        optimizedPrompt: optimized,
        changes,
        modelSpecificFeatures: [],
        estimatedTokens: this.estimateTokens(optimized),
        score: 60 + Math.random() * 20
      })
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

  private getVariantCount(level: string): number {
    const counts = {
      basic: 1,
      advanced: 3,
      expert: 5
    }
    return counts[level] || 1
  }

  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4)
  }
}