import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@/tests/utils/test-utils'
import { VariantCard } from './VariantCard'
import { createMockVariant } from '@/tests/utils/mock-data'
import userEvent from '@testing-library/user-event'

describe('VariantCard', () => {
  const mockOnCopy = vi.fn()
  const defaultVariant = createMockVariant()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should display the optimized prompt', () => {
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    expect(screen.getByText(defaultVariant.optimizedPrompt)).toBeInTheDocument()
  })

  it('should display quality score with appropriate color', () => {
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    const score = screen.getByText(`${defaultVariant.quality?.score}/100`)
    expect(score).toBeInTheDocument()
    expect(score).toHaveStyle({ color: '#10b981' }) // green for score >= 80
  })

  it('should display quality score label', () => {
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    expect(screen.getByText('Excellent')).toBeInTheDocument() // for score >= 80
  })

  it('should display improvement changes', () => {
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    defaultVariant.changes.forEach(change => {
      expect(screen.getByText(`${change.type}: ${change.description}`)).toBeInTheDocument()
    })
  })

  it('should call onCopy when copy button is clicked', async () => {
    const user = userEvent.setup()
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)
    
    expect(mockOnCopy).toHaveBeenCalledWith(defaultVariant.optimizedPrompt)
  })

  it('should show copied feedback after clicking copy', async () => {
    const user = userEvent.setup()
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    const copyButton = screen.getByRole('button', { name: /copy/i })
    await user.click(copyButton)
    
    expect(screen.getByText('✓ Copied')).toBeInTheDocument()
  })

  it('should have appropriate ARIA labels', () => {
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    expect(screen.getByRole('article')).toHaveAttribute('aria-label', 'Optimized variant 1')
    expect(screen.getByRole('button', { name: /copy/i })).toHaveAttribute('aria-label', 'Copy optimized variant 1')
  })

  it('should display model-specific features', () => {
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    defaultVariant.modelSpecificFeatures.forEach(feature => {
      expect(screen.getByText(feature)).toBeInTheDocument()
    })
  })

  it('should display estimated tokens', () => {
    render(<VariantCard variant={defaultVariant} onCopy={mockOnCopy} index={0} />)
    
    expect(screen.getByText(`~${defaultVariant.estimatedTokens} tokens`)).toBeInTheDocument()
  })

  it('should handle variants without quality scores gracefully', () => {
    const variantWithoutQuality = { ...defaultVariant, quality: undefined }
    render(<VariantCard variant={variantWithoutQuality} onCopy={mockOnCopy} index={0} />)
    
    expect(screen.getByText('N/A')).toBeInTheDocument()
  })

  it('should apply correct color for medium quality scores', () => {
    const mediumQualityVariant = createMockVariant({ 
      quality: { ...defaultVariant.quality!, score: 65 }
    })
    render(<VariantCard variant={mediumQualityVariant} onCopy={mockOnCopy} index={0} />)
    
    const score = screen.getByText('65/100')
    expect(score).toHaveStyle({ color: '#f59e0b' }) // amber for 60-79
    expect(screen.getByText('Good')).toBeInTheDocument()
  })

  it('should apply correct color for low quality scores', () => {
    const lowQualityVariant = createMockVariant({ 
      quality: { ...defaultVariant.quality!, score: 45 }
    })
    render(<VariantCard variant={lowQualityVariant} onCopy={mockOnCopy} index={0} />)
    
    const score = screen.getByText('45/100')
    expect(score).toHaveStyle({ color: '#ef4444' }) // red for < 60
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument()
  })
})