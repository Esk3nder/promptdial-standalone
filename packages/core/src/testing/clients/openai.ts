import OpenAI from 'openai'
import type { TestResult } from '../types'

export async function testOpenAI(prompt: string): Promise<TestResult> {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey) {
    return {
      responseTime: 0,
      tokenCount: 0,
      responseText: '',
      error: 'OPENAI_API_KEY not found in environment'
    }
  }

  const openai = new OpenAI({ apiKey })
  
  const startTime = Date.now()
  
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 500,
      temperature: 0.7
    })
    
    const endTime = Date.now()
    
    return {
      responseTime: endTime - startTime,
      tokenCount: response.usage?.total_tokens || 0,
      responseText: response.choices[0]?.message?.content || ''
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