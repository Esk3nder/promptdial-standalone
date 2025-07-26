import { useReducer, useCallback, useRef } from 'react'
import { useSSEOptimization, type SSEProgress } from './useSSEOptimization'
import type { OptimizationRequest, OptimizedResult } from '@/types'

// State machine states
type UIState =
  | { status: 'idle' }
  | { status: 'validating'; prompt: string }
  | { status: 'optimizing'; request: OptimizationRequest; progress: number; stage?: string }
  | { status: 'success'; results: OptimizedResult; request: OptimizationRequest }
  | { status: 'error'; error: Error; request?: OptimizationRequest }

// State machine events
type UIEvent =
  | { type: 'START_VALIDATION'; prompt: string }
  | { type: 'VALIDATION_PASSED'; request: OptimizationRequest }
  | { type: 'VALIDATION_FAILED'; error: Error }
  | { type: 'START_OPTIMIZATION' }
  | { type: 'UPDATE_PROGRESS'; progress: number; stage?: string }
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
        return { status: 'optimizing', request: event.request, progress: 0 }
      }
      if (event.type === 'VALIDATION_FAILED') {
        return { status: 'error', error: event.error }
      }
      break

    case 'optimizing':
      if (event.type === 'UPDATE_PROGRESS') {
        return { ...state, progress: event.progress, stage: event.stage }
      }
      if (event.type === 'OPTIMIZATION_SUCCESS') {
        return {
          status: 'success',
          results: event.results,
          request: state.request,
        }
      }
      if (event.type === 'OPTIMIZATION_ERROR') {
        return {
          status: 'error',
          error: event.error,
          request: state.request,
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
  progress: number
  stage?: string
}

export function usePromptOptimization(
  options: UsePromptOptimizationOptions = {},
): UsePromptOptimizationReturn {
  const { autoSort = true, autoValidate = true } = options

  const [state, dispatch] = useReducer(promptOptimizationReducer, { status: 'idle' })
  const activeRequestRef = useRef<OptimizationRequest | null>(null)

  // Setup SSE connection
  const { connect, disconnect } = useSSEOptimization({
    onProgress: (progress: SSEProgress) => {
      if (progress.status === 'complete' && progress.results) {
        dispatch({ type: 'OPTIMIZATION_SUCCESS', results: progress.results })
      } else if (progress.status === 'error') {
        dispatch({
          type: 'OPTIMIZATION_ERROR',
          error: new Error(progress.error || 'Optimization failed'),
        })
      } else {
        dispatch({
          type: 'UPDATE_PROGRESS',
          progress: progress.progress,
          stage: progress.status,
        })
      }
    },
    onComplete: (results: OptimizedResult) => {
      dispatch({ type: 'OPTIMIZATION_SUCCESS', results })
    },
    onError: (error: string) => {
      dispatch({ type: 'OPTIMIZATION_ERROR', error: new Error(error) })
    },
  })

  const optimize = useCallback(
    async (request: OptimizationRequest) => {
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
      activeRequestRef.current = request

      // Connect to SSE for real-time updates
      try {
        connect(request)
      } catch (error) {
        dispatch({
          type: 'OPTIMIZATION_ERROR',
          error:
            error instanceof Error ? error : new Error('Failed to connect to optimization service'),
        })
      }
    },
    [connect],
  )

  const reset = useCallback(() => {
    disconnect()
    activeRequestRef.current = null
    dispatch({ type: 'RESET' })
  }, [disconnect])

  return {
    state,
    optimize,
    reset,
    isLoading: state.status === 'validating' || state.status === 'optimizing',
    isError: state.status === 'error',
    isSuccess: state.status === 'success',
    progress: state.status === 'optimizing' ? state.progress : 0,
    stage: state.status === 'optimizing' ? state.stage : undefined,
  }
}
