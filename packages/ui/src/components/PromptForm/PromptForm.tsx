import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { OptimizationRequest } from '@/types'
import { MODEL_OPTIONS, LEVEL_OPTIONS, TASK_TYPE_OPTIONS } from '@/types'
import { useKeyboardShortcuts } from '@/hooks'
import styles from './PromptForm.module.css'

interface PromptFormProps {
  onSubmit: (request: OptimizationRequest) => void
  isLoading: boolean
  error?: string
}

export function PromptForm({ onSubmit, isLoading, error }: PromptFormProps) {
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState<string>('gemini-pro')
  const [level, setLevel] = useState<'basic' | 'advanced' | 'expert'>('advanced')
  const [taskType, setTaskType] = useState<string | undefined>(undefined)
  const [validationError, setValidationError] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'instant' | 'deep'>('instant')
  const [chainOfThought, setChainOfThought] = useState(false)
  
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const errorId = 'prompt-error'
  
  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])
  
  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: 'Enter',
      cmd: true,
      handler: () => handleSubmit(),
      preventDefault: true,
    },
  ])
  
  const handlePromptChange = (value: string) => {
    // Enforce max length
    if (value.length <= 10000) {
      setPrompt(value)
      setValidationError('')
    }
  }
  
  const validateForm = (): boolean => {
    if (!prompt.trim()) {
      setValidationError('Please enter a prompt')
      return false
    }
    return true
  }
  
  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    
    if (!validateForm()) return
    
    const request: OptimizationRequest = {
      prompt: prompt.trim(),
      targetModel: model,
      optimizationLevel: activeTab === 'deep' ? 'expert' : level,
      ...(taskType && taskType !== 'undefined' && { taskType: taskType as any }),
      ...(chainOfThought && { chainOfThought }),
    }
    
    onSubmit(request)
  }
  
  const displayError = validationError || error
  
  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Prompt Textarea */}
      <div className={styles.formGroup}>
        <div className={styles.textareaWrapper}>
          <textarea
            ref={textareaRef}
            id="prompt"
            name="prompt"
            value={prompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            disabled={isLoading}
            aria-label="Enter your prompt"
            aria-describedby={displayError ? errorId : undefined}
            aria-invalid={!!displayError}
            className={styles.textarea}
            rows={6}
            placeholder="Enter your prompt here... (e.g., 'Create a 3-day travel itinerary for Paris focused on art museums')"
          />
          <div className={styles.charCount}>
            {prompt.length.toLocaleString()} / 10,000
          </div>
        </div>
      </div>
      
      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'instant' ? styles.active : ''}`}
          onClick={() => setActiveTab('instant')}
        >
          Instant Prompt
        </button>
        <button
          type="button"
          className={`${styles.tab} ${activeTab === 'deep' ? styles.active : ''}`}
          onClick={() => setActiveTab('deep')}
        >
          Deep Prompting
        </button>
      </div>
      
      {/* Configuration */}
      <div className={styles.configSection}>
        {/* Model Selection */}
        <div className={styles.formGroup}>
          <label htmlFor="model" className={styles.label}>
            Target AI Model Provider
          </label>
          <select
            id="model"
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={isLoading}
            aria-label="Select target AI model"
            className={styles.select}
          >
            {MODEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Output Format (placeholder for now) */}
        <div className={styles.formGroup}>
          <label htmlFor="outputFormat" className={styles.label}>
            Output Format
          </label>
          <select
            id="outputFormat"
            name="outputFormat"
            defaultValue="markdown"
            disabled={isLoading}
            aria-label="Select output format"
            className={styles.select}
          >
            <option value="markdown">Markdown</option>
            <option value="json">JSON</option>
            <option value="plain">Plain Text</option>
          </select>
        </div>
      </div>
      
      {/* Toggle Switch */}
      <div className={styles.toggleGroup}>
        <div className={styles.toggleLabel}>
          <span>Chain-of-Thought</span>
          <span className={styles.toggleBadge}>Advanced</span>
        </div>
        <button
          type="button"
          className={`${styles.toggleSwitch} ${chainOfThought ? styles.active : ''}`}
          onClick={() => setChainOfThought(!chainOfThought)}
          aria-pressed={chainOfThought}
          aria-label="Toggle chain of thought"
        >
          <span className={styles.toggleSlider}></span>
        </button>
      </div>
      
      {/* Error Message */}
      {displayError && (
        <div id={errorId} role="alert" className={styles.error}>
          {displayError}
        </div>
      )}
      
      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading}
        aria-label="Refine prompt"
        className={styles.submitButton}
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611l-3.98.793a3 3 0 01-2.31-2.31l-.793-3.98c-.293-1.717 1.379-2.299 2.611-1.067l1.402 1.402M5 14.5l-1.402 1.402c-1.232 1.232-.65 3.318 1.067 3.611l3.98.793a3 3 0 002.31-2.31l.793-3.98c.293-1.717-1.379-2.299-2.611-1.067L5 14.5" />
        </svg>
        {isLoading ? 'Refining...' : 'Refine Prompt'}
      </button>
      
      <div className={styles.hint}>
        Tip: Press <kbd>Cmd</kbd> + <kbd>Enter</kbd> to optimize
      </div>
    </form>
  )
}