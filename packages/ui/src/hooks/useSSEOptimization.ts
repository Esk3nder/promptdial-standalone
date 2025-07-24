import { useCallback, useRef } from 'react'
import type { OptimizationRequest, OptimizedResult } from '@/types'

export interface SSEProgress {
  status: 'initializing' | 'validating' | 'analyzing' | 'optimizing' | 'generating' | 'evaluating' | 'finalizing' | 'complete' | 'error'
  progress: number
  message?: string
  results?: OptimizedResult
  error?: string
}

interface UseSSEOptimizationOptions {
  onProgress?: (progress: SSEProgress) => void
  onComplete?: (results: OptimizedResult) => void
  onError?: (error: string) => void
}

export function useSSEOptimization(options: UseSSEOptimizationOptions = {}) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const { onProgress, onComplete, onError } = options

  const connect = useCallback((request: OptimizationRequest) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Build query string
    const params = new URLSearchParams({
      prompt: request.prompt,
      targetModel: request.targetModel,
      optimizationLevel: request.optimizationLevel,
    })

    // Create new EventSource
    const eventSource = new EventSource(`/api/optimize/stream?${params}`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      try {
        const data: SSEProgress = JSON.parse(event.data)
        
        // Call progress callback
        onProgress?.(data)

        // Handle completion
        if (data.status === 'complete' && data.results) {
          onComplete?.(data.results)
          eventSource.close()
          eventSourceRef.current = null
        }

        // Handle error
        if (data.status === 'error' && data.error) {
          onError?.(data.error)
          eventSource.close()
          eventSourceRef.current = null
        }
      } catch (error) {
        console.error('Error parsing SSE data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
      onError?.('Connection lost. Please try again.')
      eventSource.close()
      eventSourceRef.current = null
    }

    return eventSource
  }, [onProgress, onComplete, onError])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  return {
    connect,
    disconnect,
  }
}