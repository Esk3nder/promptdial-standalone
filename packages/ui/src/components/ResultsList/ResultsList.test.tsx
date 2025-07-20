import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/tests/utils/test-utils'
import { ResultsList } from './ResultsList'
import { createMockOptimizationResult } from '@/tests/utils/mock-data'
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
    
    expect(screen.getByText('Enter a prompt above and click "Optimize" to get started')).toBeInTheDocument()
  })

  it('should display results when available', () => {
    const results = createMockOptimizationResult(3)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    expect(screen.getByText('Optimization Results')).toBeInTheDocument()
    expect(screen.getByText('3 variants generated')).toBeInTheDocument()
    expect(screen.getAllByRole('article')).toHaveLength(3)
  })

  it('should display summary statistics', () => {
    const results = createMockOptimizationResult(3)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    expect(screen.getByText('Best Score:')).toBeInTheDocument()
    expect(screen.getByText('85/100')).toBeInTheDocument()
    expect(screen.getByText('Average:')).toBeInTheDocument()
    expect(screen.getByText('80/100')).toBeInTheDocument()
  })

  it('should pass copy handler to variant cards', async () => {
    const user = userEvent.setup()
    const results = createMockOptimizationResult(1)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)
    
    expect(mockOnCopy).toHaveBeenCalledWith(results.variants[0].optimizedPrompt)
  })

  it('should announce results to screen readers', () => {
    const results = createMockOptimizationResult(3)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    expect(screen.getByRole('status')).toHaveTextContent('3 optimized variants ready')
  })

  it('should display request information', () => {
    const results = createMockOptimizationResult(1)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    expect(screen.getByText('Model: gpt-4')).toBeInTheDocument()
    expect(screen.getByText('Level: basic')).toBeInTheDocument()
  })

  it('should handle single variant result', () => {
    const results = createMockOptimizationResult(1)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    expect(screen.getByText('1 variant generated')).toBeInTheDocument()
  })

  it('should not display summary when no scores available', () => {
    const results = createMockOptimizationResult(1)
    results.summary.bestScore = undefined
    results.summary.averageScore = undefined
    
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    expect(screen.queryByText('Best Score:')).not.toBeInTheDocument()
    expect(screen.queryByText('Average:')).not.toBeInTheDocument()
  })

  it('should have proper heading hierarchy', () => {
    const results = createMockOptimizationResult(1)
    render(<ResultsList isLoading={false} results={results} onCopy={mockOnCopy} />)
    
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Optimization Results')
  })
})