import Anthropic from '@anthropic-ai/sdk'
import type { TestResult } from '../types'

export async function testAnthropic(prompt: string): Promise<TestResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      responseTime: 0,
      tokenCount: 0,
      responseText: '',
      error: 'ANTHROPIC_API_KEY not found in environment'
    }
  }

  const anthropic = new Anthropic({ apiKey })
  
  const startTime = Date.now()
  
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    })
    
    const endTime = Date.now()
    
    const textContent = response.content.find(c => c.type === 'text')
    const responseText = textContent?.type === 'text' ? textContent.text : ''
    
    return {
      responseTime: endTime - startTime,
      tokenCount: response.usage.input_tokens + response.usage.output_tokens,
      responseText
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