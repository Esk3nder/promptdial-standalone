import { describe, it, expect, vi } from 'vitest'
import { testPrompt } from '../src/testing/clients'
import type { TestResult } from '../src/testing/types'

describe('API Testing', () => {
  it('should return error when OpenAI API key is missing', async () => {
    vi.stubEnv('OPENAI_API_KEY', '')
    const result = await testPrompt('openai', 'Test prompt')

    expect(result).toHaveProperty('responseTime')
    expect(result).toHaveProperty('tokenCount')
    expect(result).toHaveProperty('responseText')
    expect(result.error).toBe('OPENAI_API_KEY not found in environment')
    expect(result.responseTime).toBe(0)
  })

  it('should return error when Anthropic API key is missing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    const result = await testPrompt('anthropic', 'Test prompt')

    expect(result).toHaveProperty('responseTime')
    expect(result).toHaveProperty('tokenCount')
    expect(result).toHaveProperty('responseText')
    expect(result.error).toBe('ANTHROPIC_API_KEY not found in environment')
    expect(result.responseTime).toBe(0)
  })

  it('should return error when Google API key is missing', async () => {
    vi.stubEnv('GOOGLE_AI_API_KEY', '')
    const result = await testPrompt('google', 'Test prompt')

    expect(result).toHaveProperty('responseTime')
    expect(result).toHaveProperty('tokenCount')
    expect(result).toHaveProperty('responseText')
    expect(result.error).toBe('GOOGLE_AI_API_KEY not found in environment')
    expect(result.responseTime).toBe(0)
  })

  it('should handle API errors gracefully', async () => {
    // Mock environment without API key
    vi.stubEnv('OPENAI_API_KEY', '')

    const result = await testPrompt('openai', 'Test prompt')

    expect(result.error).toBeDefined()
    expect(result.responseTime).toBe(0)
    expect(result.tokenCount).toBe(0)
  })
})
