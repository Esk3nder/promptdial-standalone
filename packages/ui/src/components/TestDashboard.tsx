import React, { useState, useEffect, useRef } from 'react'
import { PromptInput } from './PromptInput'
import { LiveTestStatus } from './LiveTestStatus'
import { ProviderCard } from './ProviderCard'
import { OptimizedPromptViewer } from './OptimizedPromptViewer'
import { ComparisonChart } from './ComparisonChart'
interface TestResult {
  responseTime: number
  tokenCount: number
  responseText: string
  error?: string
}

type ModelProvider = 'openai' | 'anthropic' | 'google'

interface TestEvent {
  type: string
  [key: string]: any
}

interface TestState {
  status: 'idle' | 'testing' | 'completed' | 'error'
  events: TestEvent[]
  results?: {
    original: Record<ModelProvider, TestResult>
    optimized: Array<{
      variant: string
      results: Record<ModelProvider, TestResult>
      quality: number
    }>
    summary?: {
      bestVariantIndex: number
      averageImprovement: {
        responseTime: number
        tokenCount: number
      }
    }
  }
  error?: string
}

export function TestDashboard() {
  const [state, setState] = useState<TestState>({
    status: 'idle',
    events: []
  })
  const eventSourceRef = useRef<EventSource | null>(null)

  const startTest = async (prompt: string, options: any) => {
    setState({ status: 'testing', events: [] })

    try {
      // Start the test
      const response = await fetch('http://localhost:3001/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
      })

      const { testId, streamUrl } = await response.json()

      // Connect to SSE stream
      const eventSource = new EventSource(`http://localhost:3001${streamUrl}`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        
        setState(prev => ({
          ...prev,
          events: [...prev.events, data]
        }))

        if (data.type === 'final_results') {
          setState(prev => ({
            ...prev,
            status: 'completed',
            results: data.results
          }))
          eventSource.close()
        } else if (data.type === 'error') {
          setState(prev => ({
            ...prev,
            status: 'error',
            error: data.error
          }))
          eventSource.close()
        }
      }

      eventSource.onerror = () => {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: 'Connection to server lost'
        }))
        eventSource.close()
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start test'
      }))
    }
  }

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return (
    <div className="test-dashboard">
      <h1>PromptDial Live Testing Dashboard</h1>
      
      <PromptInput onSubmit={startTest} disabled={state.status === 'testing'} />

      {state.status !== 'idle' && (
        <LiveTestStatus events={state.events} status={state.status} />
      )}

      {state.results && (
        <>
          <div className="provider-cards">
            <h2>Provider Performance</h2>
            <div className="cards-grid">
              {(['openai', 'anthropic', 'google'] as ModelProvider[]).map(provider => (
                <ProviderCard
                  key={provider}
                  provider={provider}
                  original={state.results.original[provider]}
                  optimized={state.results.optimized[state.results.summary?.bestVariantIndex || 0]?.results[provider]}
                />
              ))}
            </div>
          </div>

          {state.results.summary && (
            <ComparisonChart results={state.results} />
          )}

          <OptimizedPromptViewer
            variants={state.results.optimized}
            bestIndex={state.results.summary?.bestVariantIndex || 0}
          />
        </>
      )}

      {state.error && (
        <div className="error-message">
          <h3>Error</h3>
          <p>{state.error}</p>
        </div>
      )}
    </div>
  )
}