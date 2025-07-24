import React, { useState, useEffect, useRef, Suspense, lazy } from 'react'

// Lazy load heavy components for better performance
const PromptInput = lazy(() => import('./PromptInput').then(m => ({ default: m.PromptInput })))
const LiveTestStatus = lazy(() => import('./LiveTestStatus').then(m => ({ default: m.LiveTestStatus })))
const ProviderCard = lazy(() => import('./ProviderCard').then(m => ({ default: m.ProviderCard })))
const OptimizedPromptViewer = lazy(() => import('./OptimizedPromptViewer').then(m => ({ default: m.OptimizedPromptViewer })))
const ComparisonChart = lazy(() => import('./ComparisonChart').then(m => ({ default: m.ComparisonChart })))

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
  }
  error?: string
}

// Loading fallback component
const ComponentLoader = () => (
  <div className="flex items-center justify-center p-4">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
)

export function TestDashboard() {
  const [testState, setTestState] = useState<TestState>({
    status: 'idle',
    events: []
  })
  const [testId, setTestId] = useState<string | null>(null)
  const [eventSource, setEventSource] = useState<EventSource | null>(null)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom when new events arrive
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [testState.events])

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSource) {
        eventSource.close()
      }
    }
  }, [eventSource])

  const startTest = async (prompt: string) => {
    try {
      setTestState({
        status: 'testing',
        events: []
      })

      // Start the test
      const response = await fetch('/api/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          targetModel: 'gpt-4',
          optimizationLevel: 'advanced'
        }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setTestId(data.testId)

      // Set up SSE connection
      const es = new EventSource(data.streamUrl)
      setEventSource(es)

      es.onmessage = (event) => {
        const eventData = JSON.parse(event.data)
        
        setTestState(prev => ({
          ...prev,
          events: [...prev.events, eventData]
        }))

        if (eventData.type === 'final_results') {
          setTestState(prev => ({
            ...prev,
            status: 'completed',
            results: eventData.results
          }))
          es.close()
        } else if (eventData.type === 'error') {
          setTestState(prev => ({
            ...prev,
            status: 'error',
            error: eventData.error
          }))
          es.close()
        }
      }

      es.onerror = (error) => {
        console.error('EventSource failed:', error)
        setTestState(prev => ({
          ...prev,
          status: 'error',
          error: 'Connection to server lost'
        }))
        es.close()
      }

    } catch (error) {
      console.error('Failed to start test:', error)
      setTestState({
        status: 'error',
        events: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      })
    }
  }

  return (
    <div className="test-dashboard">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            PromptDial Testing Dashboard
          </h1>
          <p className="text-gray-600">
            Test and optimize your prompts across different AI providers
          </p>
        </div>

        {/* Input Section */}
        <div className="mb-8">
          <Suspense fallback={<ComponentLoader />}>
            <PromptInput onSubmit={startTest} isDisabled={testState.status === 'testing'} />
          </Suspense>
        </div>

        {/* Status Section */}
        {testState.status !== 'idle' && (
          <div className="mb-8">
            <Suspense fallback={<ComponentLoader />}>
              <LiveTestStatus 
                status={testState.status}
                events={testState.events}
                error={testState.error}
              />
            </Suspense>
            <div ref={eventsEndRef} />
          </div>
        )}

        {/* Results Section */}
        {testState.results && (
          <div className="space-y-8">
            {/* Provider Results */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {Object.entries(testState.results.original).map(([provider, result]) => (
                <Suspense key={provider} fallback={<ComponentLoader />}>
                  <ProviderCard
                    provider={provider as ModelProvider}
                    result={result}
                    isOriginal={true}
                  />
                </Suspense>
              ))}
            </div>

            {/* Optimized Variants */}
            {testState.results.optimized.map((variant, index) => (
              <div key={index} className="border rounded-lg p-6 bg-white shadow-sm">
                <Suspense fallback={<ComponentLoader />}>
                  <OptimizedPromptViewer
                    variant={variant.variant}
                    quality={variant.quality}
                    results={variant.results}
                  />
                </Suspense>
              </div>
            ))}

            {/* Comparison Chart */}
            <div className="mt-8">
              <Suspense fallback={<ComponentLoader />}>
                <ComparisonChart
                  originalResults={testState.results.original}
                  optimizedResults={testState.results.optimized}
                />
              </Suspense>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TestDashboard