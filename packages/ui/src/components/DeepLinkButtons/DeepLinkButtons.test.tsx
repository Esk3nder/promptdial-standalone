import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DeepLinkButtons } from './DeepLinkButtons'

// Mock window.open
const mockWindowOpen = vi.fn()
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
})

describe('DeepLinkButtons', () => {
  beforeEach(() => {
    mockWindowOpen.mockClear()
  })

  it('renders all platform buttons', () => {
    const testPrompt = 'Test prompt for AI'
    render(<DeepLinkButtons prompt={testPrompt} />)

    expect(screen.getByRole('button', { name: /open prompt in chatgpt/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open prompt in claude/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open prompt in gemini/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open prompt in perplexity/i })).toBeInTheDocument()
  })

  it('shows extension indicator for ChatGPT', () => {
    render(<DeepLinkButtons prompt="test" />)

    const chatgptButton = screen.getByRole('button', { name: /open prompt in chatgpt/i })
    expect(chatgptButton.className).toContain('requiresExtension')
    expect(screen.getByText('*')).toBeInTheDocument()
    expect(screen.getByText('* Requires browser extension for auto-submit')).toBeInTheDocument()
  })

  it('opens ChatGPT with encoded prompt when clicked', () => {
    const testPrompt = 'Hello, test prompt with spaces!'
    render(<DeepLinkButtons prompt={testPrompt} />)

    const chatgptButton = screen.getByRole('button', { name: /open prompt in chatgpt/i })
    fireEvent.click(chatgptButton)

    const expectedUrl = `https://chat.openai.com/?q=${encodeURIComponent(testPrompt)}`
    expect(mockWindowOpen).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer')
  })

  it('opens Claude with base URL when clicked', () => {
    render(<DeepLinkButtons prompt="test prompt" />)

    const claudeButton = screen.getByRole('button', { name: /open prompt in claude/i })
    fireEvent.click(claudeButton)

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://claude.ai/',
      '_blank',
      'noopener,noreferrer',
    )
  })

  it('handles special characters in prompts correctly', () => {
    const specialPrompt = 'Test with special characters: &=?#'
    render(<DeepLinkButtons prompt={specialPrompt} />)

    const chatgptButton = screen.getByRole('button', { name: /open prompt in chatgpt/i })
    fireEvent.click(chatgptButton)

    const expectedUrl = `https://chat.openai.com/?q=${encodeURIComponent(specialPrompt)}`
    expect(mockWindowOpen).toHaveBeenCalledWith(expectedUrl, '_blank', 'noopener,noreferrer')
  })

  it('applies custom className when provided', () => {
    const { container } = render(<DeepLinkButtons prompt="test" className="custom-class" />)

    expect(container.firstChild).toHaveClass('custom-class')
  })
})
