import { testOpenAI } from './openai'
import { testAnthropic } from './anthropic'
import { testGoogle } from './google'
import type { TestResult, ModelProvider } from '../types'

export async function testPrompt(
  provider: ModelProvider,
  prompt: string
): Promise<TestResult> {
  switch (provider) {
    case 'openai':
      return testOpenAI(prompt)
    case 'anthropic':
      return testAnthropic(prompt)
    case 'google':
      return testGoogle(prompt)
    default:
      return {
        responseTime: 0,
        tokenCount: 0,
        responseText: '',
        error: `Unknown provider: ${provider}`
      }
  }
}

export async function testAllProviders(prompt: string): Promise<Record<ModelProvider, TestResult>> {
  const [openai, anthropic, google] = await Promise.all([
    testOpenAI(prompt),
    testAnthropic(prompt),
    testGoogle(prompt)
  ])

  return { openai, anthropic, google }
}