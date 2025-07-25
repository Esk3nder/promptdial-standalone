import { describe, it, expect } from 'vitest'
import { PromptDial } from '../src/index'

describe('PromptDial', () => {
  it('should optimize a prompt', async () => {
    const promptDial = new PromptDial()

    const result = await promptDial.optimize({
      prompt: 'Explain machine learning',
      targetModel: 'gpt-4',
    })

    expect(result.variants).toHaveLength(5) // Now generates 5 variants
    expect(result.variants[0].optimizedPrompt).toBeTruthy()
    expect(result.variants[0].optimizedPrompt.length).toBeGreaterThan(result.request.prompt.length)
    expect(result.variants[0].quality).toBeDefined()
    expect(result.variants[0].quality?.score).toBeGreaterThan(0)
  })

  it('should generate multiple variants', async () => {
    const promptDial = new PromptDial()

    const result = await promptDial.optimize({
      prompt: 'Write code',
      targetModel: 'claude-3-opus',
    })

    expect(result.variants).toHaveLength(5) // Now always generates 5 variants
    expect(result.summary.totalVariants).toBe(5)
    expect(result.summary.bestScore).toBeDefined()
    expect(result.summary.averageScore).toBeDefined()
  })

  it('should sort variants by quality when enabled', async () => {
    const promptDial = new PromptDial({ sortByQuality: true })

    const result = await promptDial.optimize({
      prompt: 'Analyze data',
      targetModel: 'gpt-4',
    })

    // Check that variants are sorted by score descending
    for (let i = 1; i < result.variants.length; i++) {
      const prevScore = result.variants[i - 1].quality?.score || 0
      const currScore = result.variants[i].quality?.score || 0
      expect(prevScore).toBeGreaterThanOrEqual(currScore)
    }
  })

  it('should work without auto-validation', async () => {
    const promptDial = new PromptDial({ autoValidate: false })

    const result = await promptDial.optimize({
      prompt: 'Test prompt',
      targetModel: 'gpt-4',
    })

    expect(result.variants[0].quality).toBeUndefined()
    expect(result.summary.bestScore).toBeUndefined()
    expect(result.summary.averageScore).toBeUndefined()
  })
})
