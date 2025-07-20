import { useReducer, useCallback } from 'react'
import { PromptDial } from '@/types/promptdial'
import type { OptimizationRequest, OptimizedResult } from '@/types'

// State machine states
type UIState =
  | { status: 'idle' }
  | { status: 'validating'; prompt: string }
  | { status: 'optimizing'; request: OptimizationRequest }
  | { status: 'success'; results: OptimizedResult; request: OptimizationRequest }
  | { status: 'error'; error: Error; request?: OptimizationRequest }

// State machine events
type UIEvent =
  | { type: 'START_VALIDATION'; prompt: string }
  | { type: 'VALIDATION_PASSED'; request: OptimizationRequest }
  | { type: 'VALIDATION_FAILED'; error: Error }
  | { type: 'START_OPTIMIZATION' }
  | { type: 'OPTIMIZATION_SUCCESS'; results: OptimizedResult }
  | { type: 'OPTIMIZATION_ERROR'; error: Error }
  | { type: 'RESET' }

// State reducer
function promptOptimizationReducer(state: UIState, event: UIEvent): UIState {
  switch (state.status) {
    case 'idle':
      if (event.type === 'START_VALIDATION') {
        return { status: 'validating', prompt: event.prompt }
      }
      break
      
    case 'validating':
      if (event.type === 'VALIDATION_PASSED') {
        return { status: 'optimizing', request: event.request }
      }
      if (event.type === 'VALIDATION_FAILED') {
        return { status: 'error', error: event.error }
      }
      break
      
    case 'optimizing':
      if (event.type === 'OPTIMIZATION_SUCCESS') {
        return { 
          status: 'success', 
          results: event.results,
          request: state.request 
        }
      }
      if (event.type === 'OPTIMIZATION_ERROR') {
        return { 
          status: 'error', 
          error: event.error,
          request: state.request 
        }
      }
      break
      
    case 'success':
    case 'error':
      if (event.type === 'RESET') {
        return { status: 'idle' }
      }
      if (event.type === 'START_VALIDATION') {
        return { status: 'validating', prompt: event.prompt }
      }
      break
  }
  
  return state
}

// Validation logic
function validatePrompt(prompt: string): Error | null {
  if (!prompt || prompt.trim().length === 0) {
    return new Error('Please enter a prompt')
  }
  if (prompt.length > 10000) {
    return new Error('Prompt exceeds maximum length of 10,000 characters')
  }
  return null
}

// Hook options
interface UsePromptOptimizationOptions {
  autoSort?: boolean
  autoValidate?: boolean
}

// Hook return type
interface UsePromptOptimizationReturn {
  state: UIState
  optimize: (request: OptimizationRequest) => Promise<void>
  reset: () => void
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
}

export function usePromptOptimization(
  options: UsePromptOptimizationOptions = {}
): UsePromptOptimizationReturn {
  const { autoSort = true, autoValidate = true } = options
  
  const [state, dispatch] = useReducer(promptOptimizationReducer, { status: 'idle' })
  
  const promptDial = useCallback(
    () => new PromptDial({ sortByQuality: autoSort, autoValidate }),
    [autoSort, autoValidate]
  )
  
  const optimize = useCallback(async (request: OptimizationRequest) => {
    // Start validation
    dispatch({ type: 'START_VALIDATION', prompt: request.prompt })
    
    // Validate prompt
    const validationError = validatePrompt(request.prompt)
    if (validationError) {
      dispatch({ type: 'VALIDATION_FAILED', error: validationError })
      return
    }
    
    // Validation passed, start optimization
    dispatch({ type: 'VALIDATION_PASSED', request })
    
    try {
      const pd = promptDial()
      const results = await pd.optimize(request)
      dispatch({ type: 'OPTIMIZATION_SUCCESS', results })
    } catch (error) {
      dispatch({ 
        type: 'OPTIMIZATION_ERROR', 
        error: error instanceof Error ? error : new Error('Optimization failed')
      })
    }
  }, [promptDial])
  
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' })
  }, [])
  
  return {
    state,
    optimize,
    reset,
    isLoading: state.status === 'validating' || state.status === 'optimizing',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
  }
}