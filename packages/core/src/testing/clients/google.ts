import { GoogleProvider } from '@promptdial/llm-runner'
import type { TestResult } from '../types'
import type { PromptVariant, LLMProviderConfig } from '@promptdial/shared'

export async function testGoogle(prompt: string): Promise<TestResult> {
  const apiKey = process.env.GOOGLE_AI_API_KEY

  if (!apiKey) {
    return {
      responseTime: 0,
      tokenCount: 0,
      responseText: '',
      error: 'GOOGLE_AI_API_KEY not found in environment'
    }
  }

  // Create configuration for the Google provider
  const config: LLMProviderConfig = {
    api_key: apiKey,
    model: 'gemini-1.5-flash',
    max_tokens: 500,
    temperature: 0.7
  }

  // Create a PromptVariant from the simple prompt string
  const variant: PromptVariant = {
    id: 'test-variant',
    technique: 'test',
    prompt: prompt,
    temperature: 0.7,
    est_tokens: 100,
    cost_usd: 0.001,
    model: 'gemini-1.5-flash',
    model_params: {
      temperature: 0.7,
      max_tokens: 500
    }
  }

  const startTime = Date.now()
  
  try {
    // Use the consolidated Google provider
    const provider = new GoogleProvider(config)
    const response = await provider.call(variant)
    
    const endTime = Date.now()
    
    // Convert LLMResponse back to TestResult
    return {
      responseTime: endTime - startTime,
      tokenCount: response.tokens_used,
      responseText: response.content,
      error: response.error
    }
  } catch (error) {
    const endTime = Date.now()
    return {
      responseTime: endTime - startTime,
      tokenCount: 0,
      responseText: '',
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}