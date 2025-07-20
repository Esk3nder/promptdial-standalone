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
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-container">
          <a href="/" className="nav-logo">prompt dial</a>
          <div className="nav-items">
            <a href="#" className="nav-link">How it Works</a>
            <a href="#" className="nav-link">Docs</a>
            <button className="nav-sign-in">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" width="16" height="16">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {/* Input Panel */}
        <div className="app-input-panel">
          <h2 className="panel-title">Your Prompt</h2>
          <PromptForm
            onSubmit={handleOptimize}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Output Panel */}
        <div className="app-output-panel">
          <h2 className="panel-title">Refined Prompt</h2>
          <ResultsList
            isLoading={isLoading}
            results={results}
            error={error}
            onCopy={handleCopy}
          />
        </div>
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