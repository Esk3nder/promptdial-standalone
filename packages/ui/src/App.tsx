import { usePromptOptimization, useClipboard } from '@/hooks'
import { PromptForm } from '@/components/PromptForm'
import { ResultsList } from '@/components/ResultsList'
import { LiveRegion } from '@/components/common'
import type { OptimizationRequest } from '@/types'
import './App.css'

export function App() {
  const { state, optimize } = usePromptOptimization()
  const { copy, copied } = useClipboard({
    timeout: 2000,
  })

  const handleOptimize = async (request: OptimizationRequest) => {
    await optimize(request)
  }

  const handleCopy = async (text: string) => {
    await copy(text)
  }

  // Derive UI state
  const isLoading = state.status === 'validating' || state.status === 'optimizing'
  const error = state.status === 'error' ? state.error?.message : undefined
  const results = state.status === 'success' ? state.results : null

  return (
    <div className="app">
      <header className="app-header">
        <h1>PromptDial</h1>
        <p className="app-tagline">
          Transform your prompts into optimized, model-specific queries
        </p>
      </header>

      <main className="app-main">
        <section className="app-section">
          <PromptForm
            onSubmit={handleOptimize}
            isLoading={isLoading}
            error={error}
          />
        </section>

        <section className="app-section">
          <ResultsList
            isLoading={isLoading}
            results={results}
            error={error}
            onCopy={handleCopy}
          />
        </section>
      </main>

      {/* Copy feedback */}
      {copied && (
        <LiveRegion 
          message="Copied to clipboard!"
          ariaLive="polite"
        />
      )}
    </div>
  )
}

export default App