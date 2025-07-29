import { describe, it, expect } from 'vitest'
import { AIMetaPromptDesigner } from '../packages/core/src/ai-meta-prompt-designer'

describe('JSON Parsing Fix', () => {
  const designer = new AIMetaPromptDesigner()

  describe('parseJsonResponse', () => {
    it('should parse complete JSON', () => {
      const completeJson = `{
        "optimizedPrompt": "What is the capital of France?",
        "changes": [{"type": "clarity", "description": "Made question direct"}],
        "modelSpecificFeatures": ["direct_question"]
      }`
      
      const result = (designer as any).parseJsonResponse(completeJson)
      expect(result.optimizedPrompt).toBe("What is the capital of France?")
      expect(result.changes).toHaveLength(1)
      expect(result.modelSpecificFeatures).toContain("direct_question")
    })

    it('should handle truncated JSON by attempting completion', () => {
      const truncatedJson = `{
        "optimizedPrompt": "Can you explain the scientific reasons why taking multiple naps often leads to grogginess",
        "changes": [{"type": "clarity", "description": "Added specific focus"}],
        "modelSpecificFeatures": ["scientific_explanation"]`
      
      try {
        const result = (designer as any).parseJsonResponse(truncatedJson)
        expect(result.optimizedPrompt).toContain("scientific reasons")
        expect(result.changes).toHaveLength(1)
        expect(result.modelSpecificFeatures).toContain("scientific_explanation")
      } catch (error) {
        console.error('Test error:', error.message)
        throw error
      }
    })

    it('should extract JSON from markdown code blocks', () => {
      const markdownJson = `Here's the optimized prompt:

\`\`\`json
{
  "optimizedPrompt": "Explain quantum computing concepts clearly",
  "changes": [{"type": "structure", "description": "Added clarity requirement"}],
  "modelSpecificFeatures": ["educational"]
}
\`\`\`

This should work better.`
      
      const result = (designer as any).parseJsonResponse(markdownJson)
      expect(result.optimizedPrompt).toBe("Explain quantum computing concepts clearly")
      expect(result.changes).toHaveLength(1)
    })

    it('should handle JSON with missing closing quotes (graceful degradation)', () => {
      const malformedJson = `{
        "optimizedPrompt": "What are the benefits of exercise for mental health? Include: 1. Neurochemical effects, 2. Stress reduction, 3. Sleep improvement,
        "changes": [{"type": "structure", "description": "Added specific areas to cover"}],
        "modelSpecificFeatures": ["comprehensive_list"]`
      
      // This test accepts that some malformed JSON may not be recoverable
      // The main goal is that the system doesn't crash and provides helpful error messages
      try {
        const result = (designer as any).parseJsonResponse(malformedJson)
        expect(result.optimizedPrompt).toContain("benefits of exercise")
        expect(result.changes).toHaveLength(1)
      } catch (error) {
        // It's acceptable for some malformed JSON to fail parsing
        // The key is that we get a clear error message
        expect(error.message).toContain("Unable to extract valid JSON")
      }
    })
  })

  describe('attemptJsonCompletion', () => {
    it('should complete missing closing braces', () => {
      const truncated = '{"test": "value", "nested": {"inner": "content"'
      const completed = (designer as any).attemptJsonCompletion(truncated)
      
      expect(completed).toBe('{"test": "value", "nested": {"inner": "content"}}')
      expect(() => JSON.parse(completed!)).not.toThrow()
    })

    it('should complete missing quotes and braces', () => {
      const truncated = '{"optimizedPrompt": "This is a test'
      const completed = (designer as any).attemptJsonCompletion(truncated)
      
      expect(completed).toBe('{"optimizedPrompt": "This is a test"}')
      expect(() => JSON.parse(completed!)).not.toThrow()
    })

    it('should return null for already complete JSON', () => {
      const complete = '{"test": "value"}'
      const result = (designer as any).attemptJsonCompletion(complete)
      
      expect(result).toBeNull()
    })
  })
})