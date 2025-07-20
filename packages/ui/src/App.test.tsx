import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@/tests/utils/test-utils'
import { App } from './App'
import userEvent from '@testing-library/user-event'
import { PromptDial } from 'promptdial'

// Mock PromptDial
vi.mock('promptdial', () => ({
  PromptDial: vi.fn().mockImplementation(() => ({
    optimize: vi.fn(),
  })),
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render header and form initially', () => {
    render(<App />)
    
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PromptDial')
    expect(screen.getByLabelText('Enter your prompt')).toBeInTheDocument()
    expect(screen.getByText('Enter a prompt above and click "Optimize" to get started')).toBeInTheDocument()
  })

  it('should handle successful optimization', async () => {
    const mockOptimize = vi.fn().mockResolvedValue({
      variants: [{
        id: '1',
        originalPrompt: 'test',
        optimizedPrompt: 'optimized test',
        changes: [],
        modelSpecificFeatures: [],
        estimatedTokens: 10,
        quality: { score: 85 },
      }],
      request: {
        prompt: 'test',
        targetModel: 'gpt-4',
        optimizationLevel: 'basic',
      },
      summary: {
        totalVariants: 1,
        bestScore: 85,
        averageScore: 85,
      },
    })
    
    PromptDial.mockImplementation(() => ({
      optimize: mockOptimize,
    }))
    
    const user = userEvent.setup()
    render(<App />)
    
    // Fill and submit form
    await user.type(screen.getByLabelText('Enter your prompt'), 'test')
    await user.click(screen.getByRole('button', { name: 'Optimize prompt' }))
    
    // Check loading state appeared
    expect(screen.getByText('Optimizing your prompt')).toBeInTheDocument()
    
    // Wait for results
    await waitFor(() => {
      expect(screen.getByText('Optimization Results')).toBeInTheDocument()
    })
    
    expect(screen.getByText('optimized test')).toBeInTheDocument()
    expect(mockOptimize).toHaveBeenCalledWith({
      prompt: 'test',
      targetModel: 'gpt-4',
      optimizationLevel: 'basic',
    })
  })

  it('should handle optimization error', async () => {
    const mockOptimize = vi.fn().mockRejectedValue(new Error('Network error'))
    
    PromptDial.mockImplementation(() => ({
      optimize: mockOptimize,
    }))
    
    const user = userEvent.setup()
    render(<App />)
    
    await user.type(screen.getByLabelText('Enter your prompt'), 'test')
    await user.click(screen.getByRole('button', { name: 'Optimize prompt' }))
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Network error')
    })
  })

  it('should handle copy to clipboard', async () => {
    const mockOptimize = vi.fn().mockResolvedValue({
      variants: [{
        id: '1',
        originalPrompt: 'test',
        optimizedPrompt: 'optimized test',
        changes: [],
        modelSpecificFeatures: [],
        estimatedTokens: 10,
      }],
      request: {
        prompt: 'test',
        targetModel: 'gpt-4',
        optimizationLevel: 'basic',
      },
      summary: { totalVariants: 1 },
    })
    
    PromptDial.mockImplementation(() => ({
      optimize: mockOptimize,
    }))
    
    const user = userEvent.setup()
    render(<App />)
    
    await user.type(screen.getByLabelText('Enter your prompt'), 'test')
    await user.click(screen.getByRole('button', { name: 'Optimize prompt' }))
    
    await waitFor(() => {
      expect(screen.getByText('optimized test')).toBeInTheDocument()
    })
    
    await user.click(screen.getByRole('button', { name: /copy/i }))
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('optimized test')
    expect(screen.getByText('Copied to clipboard!')).toBeInTheDocument()
  })

  it('should persist form values between optimizations', async () => {
    const mockOptimize = vi.fn().mockResolvedValue({
      variants: [],
      request: {
        prompt: 'test',
        targetModel: 'gpt-4',
        optimizationLevel: 'basic',
      },
      summary: { totalVariants: 0 },
    })
    
    PromptDial.mockImplementation(() => ({
      optimize: mockOptimize,
    }))
    
    const user = userEvent.setup()
    render(<App />)
    
    // First optimization
    await user.type(screen.getByLabelText('Enter your prompt'), 'first prompt')
    await user.selectOptions(screen.getByLabelText('Select target AI model'), 'claude-3-opus')
    await user.click(screen.getByRole('button', { name: 'Optimize prompt' }))
    
    await waitFor(() => {
      expect(mockOptimize).toHaveBeenCalled()
    })
    
    // Check form values are preserved
    expect(screen.getByLabelText('Enter your prompt')).toHaveValue('first prompt')
    expect(screen.getByLabelText('Select target AI model')).toHaveValue('claude-3-opus')
  })

  it('should have accessible page structure', () => {
    render(<App />)
    
    // Main landmark
    expect(screen.getByRole('main')).toBeInTheDocument()
    
    // Heading hierarchy
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('PromptDial')
    
    // Form landmark
    expect(screen.getByRole('form')).toBeInTheDocument()
  })
})