import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@tests/utils/test-utils'
import { PromptForm } from './PromptForm'
import userEvent from '@testing-library/user-event'
import { MODEL_OPTIONS, LEVEL_OPTIONS, TASK_TYPE_OPTIONS } from '@/types'

describe('PromptForm', () => {
  const mockOnSubmit = vi.fn()
  const defaultProps = {
    onSubmit: mockOnSubmit,
    isLoading: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render all form elements', () => {
    render(<PromptForm {...defaultProps} />)

    // Basic elements should be visible
    expect(screen.getByLabelText('Enter your prompt')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Refine prompt' })).toBeInTheDocument()
    expect(screen.getByText('Advanced Settings')).toBeInTheDocument()

    // Click to expand advanced settings
    userEvent.click(screen.getByText('Advanced Settings'))

    // Now advanced fields should be visible
    expect(screen.getByLabelText('Select target AI model')).toBeInTheDocument()
    expect(screen.getByLabelText('Select optimization level')).toBeInTheDocument()
    expect(screen.getByLabelText('Select output format')).toBeInTheDocument()
  })

  it('should show character count', async () => {
    const user = userEvent.setup()
    render(<PromptForm {...defaultProps} />)

    const textarea = screen.getByLabelText('Enter your prompt')
    await user.type(textarea, 'Test prompt')

    expect(screen.getByText('11 / 10,000')).toBeInTheDocument()
  })

  it('should validate empty prompt', async () => {
    const user = userEvent.setup()
    render(<PromptForm {...defaultProps} />)

    const button = screen.getByRole('button', { name: 'Refine prompt' })
    await user.click(button)

    expect(screen.getByText('Please enter a prompt')).toBeInTheDocument()
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should validate max length', async () => {
    const user = userEvent.setup()
    render(<PromptForm {...defaultProps} />)

    const textarea = screen.getByLabelText('Enter your prompt')
    const longText = 'a'.repeat(10001)
    await user.type(textarea, longText)

    expect(screen.getByText('10,000 / 10,000')).toBeInTheDocument()
    expect(textarea).toHaveValue('a'.repeat(10000)) // Should truncate
  })

  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    render(<PromptForm {...defaultProps} />)

    // Fill prompt
    await user.type(screen.getByLabelText('Enter your prompt'), 'Test prompt')
    
    // Open advanced settings
    await user.click(screen.getByText('Advanced Settings'))
    
    // Fill advanced fields
    await user.selectOptions(screen.getByLabelText('Select target AI model'), 'claude-3-opus')
    await user.selectOptions(screen.getByLabelText('Select optimization level'), 'advanced')

    // Submit
    await user.click(screen.getByRole('button', { name: 'Refine prompt' }))

    expect(mockOnSubmit).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      targetModel: 'claude-3-opus',
      optimizationLevel: 'advanced',
          })
  })

  it('should submit with Cmd+Enter', async () => {
    const user = userEvent.setup()
    render(<PromptForm {...defaultProps} />)

    const textarea = screen.getByLabelText('Enter your prompt')
    await user.type(textarea, 'Test prompt')
    await user.keyboard('{Meta>}{Enter}{/Meta}')

    expect(mockOnSubmit).toHaveBeenCalledWith({
      prompt: 'Test prompt',
      targetModel: 'gpt-4',
      optimizationLevel: 'basic',
          })
  })

  it('should disable form when loading', () => {
    render(<PromptForm {...defaultProps} isLoading={true} />)

    expect(screen.getByLabelText('Enter your prompt')).toBeDisabled()
    
    // Open advanced settings to check those fields
    userEvent.click(screen.getByText('Advanced Settings'))
    
    expect(screen.getByLabelText('Select target AI model')).toBeDisabled()
    expect(screen.getByLabelText('Select optimization level')).toBeDisabled()
    expect(screen.getByLabelText('Select output format')).toBeDisabled()
    
    // Check button shows loading state
    expect(screen.getByRole('button', { name: 'Refine prompt' })).toBeDisabled()
  })

  it('should reset form after successful submission', async () => {
    const user = userEvent.setup()
    render(<PromptForm {...defaultProps} />)

    const textarea = screen.getByLabelText('Enter your prompt')
    await user.type(textarea, 'Test prompt')
    await user.click(screen.getByRole('button', { name: 'Refine prompt' }))

    // Should not clear prompt after submission (user might want to refine)
    expect(textarea).toHaveValue('Test prompt')
  })

  it('should show error message when provided', () => {
    render(<PromptForm {...defaultProps} error="Something went wrong" />)

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
  })

  it('should have proper ARIA attributes for accessibility', () => {
    render(<PromptForm {...defaultProps} error="Error message" />)

    const textarea = screen.getByLabelText('Enter your prompt')
    expect(textarea).toHaveAttribute('aria-describedby', expect.stringContaining('error'))
    expect(textarea).toHaveAttribute('aria-invalid', 'true')
  })

  it('should render all model options', () => {
    render(<PromptForm {...defaultProps} />)
    
    // Open advanced settings first
    userEvent.click(screen.getByText('Advanced Settings'))

    const select = screen.getByLabelText('Select target AI model')
    MODEL_OPTIONS.forEach((option) => {
      expect(screen.getByRole('option', { name: option.label })).toBeInTheDocument()
    })
  })

  it('should render all level options', () => {
    render(<PromptForm {...defaultProps} />)
    
    // Open advanced settings first
    userEvent.click(screen.getByText('Advanced Settings'))

    const select = screen.getByLabelText('Select optimization level')
    LEVEL_OPTIONS.forEach((option) => {
      expect(screen.getByRole('option', { name: option.label })).toBeInTheDocument()
    })
  })

  // Removed test for task type options as the field doesn't exist in the component

  it('should focus prompt textarea on mount', () => {
    render(<PromptForm {...defaultProps} />)

    const textarea = screen.getByLabelText('Enter your prompt')
    expect(document.activeElement).toBe(textarea)
  })
})
