import { describe, it, expect } from 'vitest'
import {
  getChatGPTLink,
  getClaudeLink,
  getGeminiLink,
  getPerplexityLink,
  getAllPlatformLinks,
  getPlatformLinksForModel,
} from './deepLinks'

describe('deepLinks utilities', () => {
  const testPrompt = 'Test prompt with spaces and special chars: &=?#'

  describe('getChatGPTLink', () => {
    it('returns correct ChatGPT link with encoded prompt', () => {
      const result = getChatGPTLink(testPrompt)

      expect(result.name).toBe('ChatGPT')
      expect(result.url).toBe(`https://chat.openai.com/?q=${encodeURIComponent(testPrompt)}`)
      expect(result.requiresExtension).toBe(true)
      expect(result.icon).toBe('🤖')
    })

    it('handles empty prompt', () => {
      const result = getChatGPTLink('')
      expect(result.url).toBe('https://chat.openai.com/?q=')
    })
  })

  describe('getClaudeLink', () => {
    it('returns correct Claude link', () => {
      const result = getClaudeLink()

      expect(result.name).toBe('Claude')
      expect(result.url).toBe('https://claude.ai/')
      expect(result.requiresExtension).toBe(false)
      expect(result.icon).toBe('🔮')
    })
  })

  describe('getGeminiLink', () => {
    it('returns correct Gemini link', () => {
      const result = getGeminiLink()

      expect(result.name).toBe('Gemini')
      expect(result.url).toBe('https://gemini.google.com/')
      expect(result.requiresExtension).toBe(false)
      expect(result.icon).toBe('💎')
    })
  })

  describe('getPerplexityLink', () => {
    it('returns correct Perplexity link', () => {
      const result = getPerplexityLink()

      expect(result.name).toBe('Perplexity')
      expect(result.url).toBe('https://perplexity.ai/')
      expect(result.requiresExtension).toBe(false)
      expect(result.icon).toBe('🔍')
    })
  })

  describe('getAllPlatformLinks', () => {
    it('returns all platform links', () => {
      const result = getAllPlatformLinks(testPrompt)

      expect(result).toHaveLength(4)
      expect(result.map((link) => link.name)).toEqual(['ChatGPT', 'Claude', 'Gemini', 'Perplexity'])
    })

    it('includes encoded prompt in ChatGPT link only', () => {
      const result = getAllPlatformLinks(testPrompt)

      const chatgptLink = result.find((link) => link.name === 'ChatGPT')
      expect(chatgptLink?.url).toContain(encodeURIComponent(testPrompt))

      const otherLinks = result.filter((link) => link.name !== 'ChatGPT')
      otherLinks.forEach((link) => {
        expect(link.url).not.toContain(encodeURIComponent(testPrompt))
      })
    })
  })

  describe('getPlatformLinksForModel', () => {
    it('returns ChatGPT and Perplexity for GPT models', () => {
      const result = getPlatformLinksForModel(testPrompt, 'gpt-4')

      expect(result).toHaveLength(2)
      expect(result.map((link) => link.name)).toEqual(['ChatGPT', 'Perplexity'])
    })

    it('returns Claude and Perplexity for Claude models', () => {
      const result = getPlatformLinksForModel(testPrompt, 'claude-3-opus')

      expect(result).toHaveLength(2)
      expect(result.map((link) => link.name)).toEqual(['Claude', 'Perplexity'])
    })

    it('returns Gemini and Perplexity for Gemini models', () => {
      const result = getPlatformLinksForModel(testPrompt, 'gemini-pro')

      expect(result).toHaveLength(2)
      expect(result.map((link) => link.name)).toEqual(['Gemini', 'Perplexity'])
    })

    it('returns default platforms for unknown models', () => {
      const result = getPlatformLinksForModel(testPrompt, 'unknown-model')

      expect(result).toHaveLength(3)
      expect(result.map((link) => link.name)).toEqual(['ChatGPT', 'Claude', 'Gemini'])
    })
  })
})
