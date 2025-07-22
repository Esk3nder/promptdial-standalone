import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GEvalEvaluator } from '../src/evaluators/g-eval'
import {
  createTestPromptVariant,
  createTestTaskClassification
} from '@promptdial/shared'
import axios from 'axios'

// Mock dependencies
vi.mock('@promptdial/shared', async () => {
  const actual = await vi.importActual('@promptdial/shared')
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    EVALUATORS: {
      G_EVAL: 'g_eval'
    }
  }
})

vi.mock('axios')

describe('GEvalEvaluator', () => {
  let evaluator: GEvalEvaluator
  let mockAxios: any

  beforeEach(() => {
    vi.clearAllMocks()
    evaluator = new GEvalEvaluator()
    mockAxios = vi.mocked(axios)
  })

  describe('evaluate', () => {
    it('should evaluate using G-EVAL criteria', async () => {
      // Mock LLM responses for each criterion
      mockAxios.post.mockImplementation((url: string, data: any) => {
        const criterion = data.messages?.[0]?.content?.match(/criterion: (\w+)/i)?.[1]
        
        // Return different scores for different criteria
        const scores: Record<string, number> = {
          coherence: 8,
          relevance: 9,
          fluency: 8,
          consistency: 7,
          depth: 8,
          engagement: 7
        }
        
        const score = scores[criterion?.toLowerCase()] || 8
        
        return Promise.resolve({
          data: {
            response: `Based on the evaluation criteria, I would rate this response as ${score}/10.`
          }
        })
      })

      const variant = createTestPromptVariant()
      const response = 'This is a well-structured response that addresses the question clearly.'
      const taskMeta = createTestTaskClassification()

      const result = await evaluator.evaluate(variant, response, taskMeta)

      expect(result).toBeDefined()
      expect(result.scores).toBeDefined()
      expect(result.scores!.g_eval).toBeDefined()
      expect(result.scores!.g_eval).toBeGreaterThan(0)
      expect(result.scores!.g_eval).toBeLessThanOrEqual(1)
      
      // Should have called LLM for each criterion
      expect(mockAxios.post).toHaveBeenCalledTimes(6)
    })

    it('should handle LLM errors gracefully', async () => {
      mockAxios.post.mockRejectedValue(new Error('LLM service unavailable'))

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      await expect(evaluator.evaluate(variant, response, taskMeta))
        .rejects.toThrow('LLM service unavailable')
    })

    it('should parse various score formats', async () => {
      const scoreFormats = [
        'I rate this 8/10',
        'Score: 7.5 out of 10',
        'Rating: 9',
        'This deserves a 6/10',
        '8.5/10',
        'I would give this an 8'
      ]

      let formatIndex = 0
      mockAxios.post.mockImplementation(() => {
        const response = scoreFormats[formatIndex % scoreFormats.length]
        formatIndex++
        return Promise.resolve({ data: { response } })
      })

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      const result = await evaluator.evaluate(variant, response, taskMeta)

      expect(result.scores!.g_eval).toBeDefined()
      expect(result.scores!.g_eval).toBeGreaterThan(0)
    })

    it('should use default score when parsing fails', async () => {
      mockAxios.post.mockResolvedValue({
        data: {
          response: 'This response contains no numeric score'
        }
      })

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      const result = await evaluator.evaluate(variant, response, taskMeta)

      // Should use default score of 5
      expect(result.scores!.g_eval).toBe(0.5) // 5/10 normalized
    })

    it('should construct proper evaluation prompts', async () => {
      let capturedPrompts: string[] = []
      
      mockAxios.post.mockImplementation((url: string, data: any) => {
        capturedPrompts.push(data.messages?.[0]?.content || '')
        return Promise.resolve({
          data: { response: 'Score: 8/10' }
        })
      })

      const variant = createTestPromptVariant({
        optimized_prompt: 'Explain quantum computing'
      })
      const response = 'Quantum computing uses quantum bits...'
      const taskMeta = createTestTaskClassification()

      await evaluator.evaluate(variant, response, taskMeta)

      // Verify prompts contain necessary elements
      expect(capturedPrompts).toHaveLength(6)
      capturedPrompts.forEach(prompt => {
        expect(prompt).toContain('criterion:')
        expect(prompt).toContain('Prompt:')
        expect(prompt).toContain('Response:')
        expect(prompt).toContain('Explain quantum computing')
        expect(prompt).toContain('Quantum computing uses quantum bits')
      })
    })

    it('should include reference in evaluation when provided', async () => {
      let capturedPrompt: string = ''
      
      mockAxios.post.mockImplementation((url: string, data: any) => {
        if (capturedPrompt === '') {
          capturedPrompt = data.messages?.[0]?.content || ''
        }
        return Promise.resolve({
          data: { response: 'Score: 9/10' }
        })
      })

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()
      const references = ['This is the expected reference answer']

      await evaluator.evaluate(variant, response, taskMeta, references)

      expect(capturedPrompt).toContain('Reference Answer:')
      expect(capturedPrompt).toContain('This is the expected reference answer')
    })

    it('should calculate mean of all criterion scores', async () => {
      const criterionScores = [8, 9, 7, 8, 9, 7] // Mean = 8
      let scoreIndex = 0
      
      mockAxios.post.mockImplementation(() => {
        const score = criterionScores[scoreIndex++]
        return Promise.resolve({
          data: { response: `Score: ${score}/10` }
        })
      })

      const variant = createTestPromptVariant()
      const response = 'Test response'
      const taskMeta = createTestTaskClassification()

      const result = await evaluator.evaluate(variant, response, taskMeta)

      // Mean of scores normalized to 0-1
      expect(result.scores!.g_eval).toBe(0.8) // 8/10
    })
  })

  describe('configuration', () => {
    it('should require LLM', () => {
      expect(evaluator.requiresLLM()).toBe(true)
    })

    it('should not require reference', () => {
      expect(evaluator.requiresReference()).toBe(false)
    })

    it('should have correct name', () => {
      expect(evaluator.getName()).toBe('g_eval')
    })
  })

  describe('LLM URL configuration', () => {
    it('should use OpenAI URL when API key is present', async () => {
      process.env.OPENAI_API_KEY = 'test-key'
      
      mockAxios.post.mockResolvedValue({
        data: { response: 'Score: 8/10' }
      })

      const variant = createTestPromptVariant()
      const response = 'Test'
      const taskMeta = createTestTaskClassification()

      await evaluator.evaluate(variant, response, taskMeta)

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://localhost:4001/run',
        expect.any(Object),
        expect.any(Object)
      )
      
      delete process.env.OPENAI_API_KEY
    })

    it('should use custom URL from environment', async () => {
      process.env.OPENAI_API_KEY = 'test-key'
      process.env.OPENAI_RUNNER_URL = 'http://custom:5000'
      
      mockAxios.post.mockResolvedValue({
        data: { response: 'Score: 8/10' }
      })

      const variant = createTestPromptVariant()
      const response = 'Test'
      const taskMeta = createTestTaskClassification()

      await evaluator.evaluate(variant, response, taskMeta)

      expect(mockAxios.post).toHaveBeenCalledWith(
        'http://custom:5000/run',
        expect.any(Object),
        expect.any(Object)
      )
      
      delete process.env.OPENAI_API_KEY
      delete process.env.OPENAI_RUNNER_URL
    })

    it('should throw when no LLM provider configured', async () => {
      // Ensure no API keys are set
      delete process.env.OPENAI_API_KEY
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.GOOGLE_AI_API_KEY

      const variant = createTestPromptVariant()
      const response = 'Test'
      const taskMeta = createTestTaskClassification()

      await expect(evaluator.evaluate(variant, response, taskMeta))
        .rejects.toThrow('No LLM provider configured')
    })
  })
})