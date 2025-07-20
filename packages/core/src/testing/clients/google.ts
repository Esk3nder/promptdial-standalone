import { GoogleGenerativeAI } from '@google/generative-ai'
import type { TestResult } from '../types'

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

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  
  const startTime = Date.now()
  
  try {
    const result = await model.generateContent(prompt)
    const response = result.response
    
    const endTime = Date.now()
    
    const text = response.text()
    
    // Google doesn't provide token count directly, estimate it
    const estimatedTokens = Math.ceil(text.split(' ').length * 1.3)
    
    return {
      responseTime: endTime - startTime,
      tokenCount: estimatedTokens,
      responseText: text
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