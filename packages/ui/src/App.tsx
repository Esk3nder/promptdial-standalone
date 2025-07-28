import { useState, useEffect } from 'react'
import { usePromptOptimization, useClipboard, useOptimizationHistory } from '@/hooks'
import { PromptForm } from '@/components/PromptForm'
import { ResultsList } from '@/components/ResultsList'
import { OptimizationHistory } from '@/components/OptimizationHistory'
import { OptimizationProgress } from '@/components/OptimizationProgress'
import { LiveRegion } from '@/components/common'
import type { OptimizationRequest } from '@/types'
import type { HistoryItem } from '@/hooks/useOptimizationHistory'
import './App.css'

export function App() {
  const { state, optimize, stage } = usePromptOptimization()
  const { copy, copied } = useClipboard({
    timeout: 2000,
  })
  const { history, addToHistory, removeFromHistory, toggleFavorite, clearHistory } =
    useOptimizationHistory()

  const [showHistory, setShowHistory] = useState(false)
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<HistoryItem | null>(null)

  // Add successful results to history
  useEffect(() => {
    if (state.status === 'success' && state.results && state.request) {
      addToHistory(state.request, state.results)
    }
  }, [state, addToHistory])

  const handleOptimize = async (request: OptimizationRequest) => {
    setSelectedHistoryItem(null)
    await optimize(request)
  }

  const handleSelectHistoryItem = (item: HistoryItem) => {
    setSelectedHistoryItem(item)
    setShowHistory(false)
  }

  const handleCopy = async (text: string) => {
    await copy(text)
  }

  // Derive UI state
  const isLoading = state.status === 'validating' || state.status === 'optimizing'
  const error = state.status === 'error' ? state.error?.message : undefined
  const results = selectedHistoryItem
    ? selectedHistoryItem.result
    : state.status === 'success'
      ? state.results
      : null

  return (
    <div className="app">
      {/* Navigation */}
      <nav className="app-nav">
        <div className="nav-container">
          <a href="/" className="nav-logo">
            prompt dial
          </a>
          <div className="nav-items">
            <a href="#" className="nav-link">
              How it Works
            </a>
            <a href="#" className="nav-link">
              Docs
            </a>
            <button className="nav-sign-in">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="2"
                stroke="currentColor"
                width="16"
                height="16"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                />
              </svg>
              Sign In
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="app-main">
        {/* History Sidebar */}
        <aside className={`app-sidebar ${showHistory ? 'visible' : ''}`}>
          <button
            className="sidebar-toggle"
            onClick={() => setShowHistory(!showHistory)}
            aria-label={showHistory ? 'Hide history' : 'Show history'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            History
          </button>

          <div className="sidebar-content">
            <OptimizationHistory
              history={history}
              onSelect={handleSelectHistoryItem}
              onToggleFavorite={toggleFavorite}
              onRemove={removeFromHistory}
              onClear={clearHistory}
            />
          </div>
        </aside>

        <div className="app-content">
          {/* Input Panel */}
          <div className="app-input-panel">
            <h2 className="panel-title">Your Prompt</h2>
            <PromptForm
              onSubmit={handleOptimize}
              isLoading={isLoading}
              error={error}
              stage={stage}
            />
          </div>

          {/* Output Panel */}
          <div className="app-output-panel">
            <h2 className="panel-title">
              {selectedHistoryItem ? 'History Result' : 'Refined Prompt'}
            </h2>

            {/* Progress Indicator */}
            {isLoading && (
              <OptimizationProgress stage={stage} isVisible={true} />
            )}

            <ResultsList
              isLoading={isLoading}
              results={results}
              error={error}
              onCopy={handleCopy}
            />
          </div>
        </div>
      </main>

      {/* Copy feedback */}
      {copied && <LiveRegion message="Copied to clipboard!" ariaLive="polite" />}
    </div>
  )
}

export default App
