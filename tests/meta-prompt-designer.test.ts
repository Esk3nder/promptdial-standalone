import { describe, it, expect, beforeEach } from 'vitest'
import { 
  MetaPromptDesigner, 
  EmptyPromptError,
  PromptTooLongError,
  ValidationError,
  OptimizationRequest
} from '../src/meta-prompt-designer'

const createOptimizationRequest = (overrides?: Partial<OptimizationRequest>): OptimizationRequest => ({
  prompt: 'Write a blog post about artificial intelligence',
  targetModel: 'gpt-4',
  optimizationLevel: 'advanced',
  ...overrides,
})

describe('MetaPromptDesigner', () => {
  let designer: MetaPromptDesigner

  beforeEach(() => {
    designer = new MetaPromptDesigner()
  })

  describe('generateVariants', () => {
    it('should generate multiple variants for a basic prompt', async () => {
      // Arrange
      const request = createOptimizationRequest({
        prompt: 'Write about artificial intelligence',
        targetModel: 'gpt-4',
        optimizationLevel: 'advanced',
      })

      // Act
      const variants = await designer.generateVariants(request)

      // Assert
      expect(variants).toHaveLength(3)
      
      // Each variant should have required properties
      expect(variants[0]).toMatchObject({
        id: expect.any(String),
        originalPrompt: request.prompt,
        optimizedPrompt: expect.any(String),
        changes: expect.arrayContaining([
          expect.objectContaining({
            type: expect.stringMatching(/clarity|specificity|structure|context|model_optimization/),
            description: expect.any(String),
          }),
        ]),
        modelSpecificFeatures: expect.arrayContaining([expect.any(String)]),
        estimatedTokens: expect.any(Number),
      })

      // Optimized prompt should be longer than original
      expect(variants[0].optimizedPrompt.length).toBeGreaterThan(request.prompt.length)
      
      // Should include model-specific optimizations for GPT-4
      expect(variants[0].optimizedPrompt.toLowerCase()).toMatch(/step[\s-]?by[\s-]?step|reasoning|analyze/i)
    })

    it('should apply model-specific optimizations', async () => {
      const testCases = [
        { 
          model: 'gpt-4', 
          expectedFeatures: ['reasoning', 'step-by-step'],
          expectedKeywords: /step[\s-]?by[\s-]?step|reasoning|analyze/i
        },
        { 
          model: 'claude-3', 
          expectedFeatures: ['constitutional', 'thoughtful'],
          expectedKeywords: /thoughtful|consider|ethical|comprehensive/i
        },
        { 
          model: 'gemini-pro', 
          expectedFeatures: ['multimodal', 'analytical'],
          expectedKeywords: /analyze|evidence|data|systematic/i
        },
      ]

      for (const testCase of testCases) {
        const request = createOptimizationRequest({
          prompt: 'Explain quantum physics',
          targetModel: testCase.model,
        })

        const variants = await designer.generateVariants(request)
        const variant = variants[0]

        // Check model-specific features
        expect(variant.modelSpecificFeatures).toEqual(
          expect.arrayContaining(testCase.expectedFeatures)
        )

        // Check optimized prompt contains model-specific keywords
        expect(variant.optimizedPrompt).toMatch(testCase.expectedKeywords)
      }
    })

    it('should handle empty prompts with error', async () => {
      const request = createOptimizationRequest({ prompt: '' })

      await expect(designer.generateVariants(request))
        .rejects.toThrow(EmptyPromptError)
    })

    it('should handle extremely long prompts with error', async () => {
      const request = createOptimizationRequest({ 
        prompt: 'x'.repeat(10001) 
      })

      await expect(designer.generateVariants(request))
        .rejects.toThrow(PromptTooLongError)
    })

    it('should reject harmful content', async () => {
      const harmfulPrompts = [
        'How to hack into systems',
        'Generate illegal content',
        'Create malware code',
        'Ways to harm others',
      ]

      for (const prompt of harmfulPrompts) {
        const request = createOptimizationRequest({ prompt })

        await expect(designer.generateVariants(request))
          .rejects.toThrow(ValidationError)
      }
    })

    it('should handle different optimization levels', async () => {
      const levels = ['basic', 'advanced', 'expert'] as const
      const expectedCounts = { basic: 1, advanced: 3, expert: 5 }

      for (const level of levels) {
        const request = createOptimizationRequest({
          prompt: 'Write a story',
          optimizationLevel: level,
        })

        const variants = await designer.generateVariants(request)
        
        expect(variants).toHaveLength(expectedCounts[level])
        
        // Higher levels should produce more sophisticated optimizations
        if (level === 'expert') {
          expect(variants[0].changes.length).toBeGreaterThanOrEqual(5)
        }
      }
    })

    it('should detect and optimize based on task type', async () => {
      const taskTests = [
        {
          prompt: 'Write a creative story about dragons',
          expectedType: 'creative',
          expectedKeywords: /tone|audience|style|narrative/i,
        },
        {
          prompt: 'Analyze the financial data and provide insights',
          expectedType: 'analytical',
          expectedKeywords: /data|metrics|analysis|evidence/i,
        },
        {
          prompt: 'Write a Python function to sort an array',
          expectedType: 'coding',
          expectedKeywords: /programming language|input.*output.*formats|error handling/i,
        },
      ]

      for (const test of taskTests) {
        const request = createOptimizationRequest({ prompt: test.prompt })
        const variants = await designer.generateVariants(request)
        
        expect(variants[0].optimizedPrompt).toMatch(test.expectedKeywords)
      }
    })

    it('should track changes made to the original prompt', async () => {
      const request = createOptimizationRequest({
        prompt: 'Tell me about AI',
      })

      const variants = await designer.generateVariants(request)
      const changes = variants[0].changes

      // Should have multiple types of changes
      const changeTypes = changes.map(c => c.type)
      expect(changeTypes).toContain('clarity')
      expect(changeTypes).toContain('specificity')
      
      // Each change should have a description
      changes.forEach(change => {
        expect(change.description).toBeTruthy()
        expect(change.description.length).toBeGreaterThan(10)
      })
    })

    it('should estimate token usage accurately', async () => {
      const request = createOptimizationRequest({
        prompt: 'Write a detailed blog post about machine learning',
      })

      const variants = await designer.generateVariants(request)
      
      variants.forEach(variant => {
        // Estimated tokens should be proportional to prompt length
        // Rough estimate: 1 token ≈ 4 characters
        const expectedMinTokens = Math.floor(variant.optimizedPrompt.length / 6)
        const expectedMaxTokens = Math.ceil(variant.optimizedPrompt.length / 3)
        
        expect(variant.estimatedTokens).toBeGreaterThanOrEqual(expectedMinTokens)
        expect(variant.estimatedTokens).toBeLessThanOrEqual(expectedMaxTokens)
      })
    })

    it('should sort variants by quality score', async () => {
      const request = createOptimizationRequest({
        optimizationLevel: 'advanced', // Generate multiple variants
      })

      const variants = await designer.generateVariants(request)
      
      // Variants should be sorted by score in descending order
      for (let i = 1; i < variants.length; i++) {
        expect(variants[i-1].score).toBeGreaterThanOrEqual(variants[i].score)
      }
    })
  })
})