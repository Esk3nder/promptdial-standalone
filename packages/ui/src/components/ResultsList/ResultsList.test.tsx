import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@tests/utils/test-utils'
import { ResultsList } from './ResultsList'
import { createMockOptimizationResult } from '@tests/utils/mock-data'
import userEvent from '@testing-library/user-event'

describe('ResultsList', () => {
  const mockOnCopy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display loading state', () => {
    render(<ResultsList isLoading={true} results={null} onCopy={mockOnCopy} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Optimizing your prompt')).toBeInTheDocument()
  })

  it('should display error state', () => {
    const error = 'Network request failed'
    render(<ResultsList isLoading={false} results={null} error={error} onCopy={mockOnCopy} />)

    expect(screen.getByRole('alert')).toHaveTextContent(error)
  })

  it('should display empty state when no results', () => {
    render(<ResultsList isLoading={false} results={null} onCopy={mockOnCopy} />)

    expect(screen.getByText('Ready to refine')).toBeInTheDocument()
    expect(screen.getByText(/Enter your prompt in the control panel/)).toBeInTheDocument()
  })

  it('should display optimized result when available', () => {
    const results = createMockOptimizationResult(1)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)

    expect(screen.getByText('Optimized Result')).toBeInTheDocument()
    expect(screen.getByText(/Score: \d+\/100/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
  })

  it('should display quality score with appropriate styling', () => {
    const results = createMockOptimizationResult(1)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)

    const scoreElement = screen.getByText(/Score: \d+\/100/)
    expect(scoreElement.parentElement).toHaveClass('scoreBadge')
  })

  it('should handle copy action', async () => {
    const user = userEvent.setup()
    const results = createMockOptimizationResult(1)

    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)

    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)

    expect(mockOnCopy).toHaveBeenCalledWith(results.variants[0].optimizedPrompt)
  })

  it('should display the optimized prompt text', () => {
    const results = createMockOptimizationResult(1)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)

    expect(screen.getByText(results.variants[0].optimizedPrompt)).toBeInTheDocument()
  })
})
