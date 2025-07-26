import OpenAI from 'openai'
import Anthropic from '@anthropic-ai/sdk'
import { GoogleGenerativeAI } from '@google/generative-ai'
import type { ModelProvider, TestResult } from './types'

const openaiClient = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    })
  : null

const anthropicClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null

const googleClient = process.env.GOOGLE_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  : null

export async function testPrompt(
  prompt: string,
  provider: ModelProvider,
  model?: string,
): Promise<TestResult> {
  const startTime = Date.now()

  try {
    switch (provider) {
      case 'openai': {
        if (!openaiClient) {
          throw new Error('OpenAI API key not configured')
        }

        const response = await openaiClient.chat.completions.create({
          model: model || 'gpt-4',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
        })

        const responseTime = Date.now() - startTime
        const tokenCount = response.usage?.total_tokens || 0
        const responseText = response.choices[0]?.message?.content || ''

        return {
          success: true,
          responseTime,
          tokenCount,
          error: null,
          responseText,
        }
      }

      case 'anthropic': {
        if (!anthropicClient) {
          throw new Error('Anthropic API key not configured')
        }

        const response = await anthropicClient.messages.create({
          model: model || 'claude-3-opus-20240229',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 150,
        })

        const responseTime = Date.now() - startTime
        const tokenCount = response.usage?.input_tokens + response.usage?.output_tokens || 0
        const responseText = response.content[0]?.type === 'text' ? response.content[0].text : ''

        return {
          success: true,
          responseTime,
          tokenCount,
          error: null,
          responseText,
        }
      }

      case 'google': {
        if (!googleClient) {
          throw new Error('Google API key not configured')
        }

        const genModel = googleClient.getGenerativeModel({ model: model || 'gemini-pro' })
        const result = await genModel.generateContent(prompt)

        const responseTime = Date.now() - startTime
        const response = await result.response
        const responseText = response.text()

        return {
          success: true,
          responseTime,
          tokenCount: 100, // Google doesn't provide token count easily
          error: null,
          responseText,
        }
      }

      default:
        throw new Error(`Unknown provider: ${provider}`)
    }
  } catch (error) {
    return {
      success: false,
      responseTime: Date.now() - startTime,
      tokenCount: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
