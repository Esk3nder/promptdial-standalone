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
  const [model, setModel] = useState<string>('gpt-4')
  const [level, setLevel] = useState<'basic' | 'advanced' | 'expert'>('basic')
  const [taskType, setTaskType] = useState<string | undefined>(undefined)
  const [validationError, setValidationError] = useState<string>('')
  
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
      optimizationLevel: level,
      ...(taskType && taskType !== 'undefined' && { taskType: taskType as any }),
    }
    
    onSubmit(request)
  }
  
  const displayError = validationError || error
  
  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Prompt Textarea */}
      <div className={styles.formGroup}>
        <label htmlFor="prompt" className={styles.label}>
          Enter your prompt
        </label>
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
            placeholder="Enter the prompt you want to optimize..."
          />
          <div className={styles.charCount}>
            {prompt.length.toLocaleString()} / 10,000
          </div>
        </div>
      </div>
      
      {/* Configuration Row */}
      <div className={styles.configRow}>
        {/* Model Selection */}
        <div className={styles.formGroup}>
          <label htmlFor="model" className={styles.label}>
            Target Model
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
        
        {/* Level Selection */}
        <div className={styles.formGroup}>
          <label htmlFor="level" className={styles.label}>
            Optimization Level
          </label>
          <select
            id="level"
            name="level"
            value={level}
            onChange={(e) => setLevel(e.target.value as any)}
            disabled={isLoading}
            aria-label="Select optimization level"
            className={styles.select}
          >
            {LEVEL_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        
        {/* Task Type Selection */}
        <div className={styles.formGroup}>
          <label htmlFor="taskType" className={styles.label}>
            Task Type
          </label>
          <select
            id="taskType"
            name="taskType"
            value={taskType || 'undefined'}
            onChange={(e) => setTaskType(e.target.value === 'undefined' ? undefined : e.target.value)}
            disabled={isLoading}
            aria-label="Select task type (optional)"
            className={styles.select}
          >
            {TASK_TYPE_OPTIONS.map(option => (
              <option key={option.value || 'undefined'} value={option.value || 'undefined'}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
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
        aria-label="Optimize prompt"
        className={styles.submitButton}
      >
        {isLoading ? 'Optimizing...' : 'Optimize'}
      </button>
      
      <div className={styles.hint}>
        Tip: Press <kbd>Cmd</kbd> + <kbd>Enter</kbd> to optimize
      </div>
    </form>
  )
}