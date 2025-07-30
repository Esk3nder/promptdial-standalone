import { useState, useEffect, useRef } from 'react'
import type { OptimizedResult } from '@/types'
import { LoadingSpinner, ErrorMessage, LiveRegion } from '@/components/common'
import { VariantComparison } from '@/components/VariantComparison'
import styles from './ResultsList.module.css'

interface ResultsListProps {
  isLoading: boolean
  results: OptimizedResult | null
  error?: string
  onCopy: (text: string) => void
}

export function ResultsList({ isLoading, results, error, onCopy }: ResultsListProps) {
  const [showAllVariants, setShowAllVariants] = useState(false)
  const [isPromptExpanded, setIsPromptExpanded] = useState(false)

  // Reset view when new results come in
  useEffect(() => {
    if (results) {
      setShowAllVariants(false)
    }
  }, [results])
  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <LoadingSpinner size="lg" label="Optimizing your prompt" />
          <p className={styles.loadingText}>Optimizing your prompt</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={styles.container}>
        <ErrorMessage message={error} />
      </div>
    )
  }

  // Empty state
  if (!results) {
    return (
      <div className={styles.container}>
        <div className={styles.emptyState}>
          <svg
            className={styles.emptyIcon}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <h3 className={styles.emptyTitle}>Ready to refine</h3>
          <p className={styles.emptyText}>
            Enter your prompt in the control panel and click "Refine Prompt"
            <br />
            to get started
          </p>
        </div>
      </div>
    )
  }

  const bestVariant = results.variants[0]
  const hasMultipleVariants = results.variants.length > 1

  return (
    <div className={styles.container}>
      {/* Screen reader announcement */}
      <LiveRegion message="Optimized prompt ready" />

      {/* Result Header */}
      <div className={styles.resultHeader}>
        <h3 className={styles.resultTitle}>
          {showAllVariants ? 'All Optimization Variants' : 'Best Optimized Result'}
        </h3>
        {hasMultipleVariants && (
          <button
            className={styles.toggleButton}
            onClick={() => setShowAllVariants(!showAllVariants)}
            aria-label={showAllVariants ? 'Show best result only' : 'Show all variants'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="2"
              stroke="currentColor"
            >
              {showAllVariants ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M2.25 7.125C2.25 6.504 2.754 6 3.375 6h17.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125H3.375a1.125 1.125 0 01-1.125-1.125V7.125z"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
                />
              )}
            </svg>
            {showAllVariants ? 'Show Best Only' : `Compare All ${results.variants.length} Variants`}
          </button>
        )}
      </div>

      {/* Show either single best result or all variants */}
      {showAllVariants ? (
        <VariantComparison variants={results.variants} onCopy={onCopy} />
      ) : (
        <div className={styles.bestResult}>
          {/* Best Result Card */}
          <div className={styles.resultCard}>
            <div className={styles.cardHeader}>
              <div className={styles.scoreSection}>
                <span className={styles.scoreLabel}>Quality Score</span>
                <span
                  className={`${styles.scoreValue} ${styles[(bestVariant.quality?.score ?? 0) >= 80 ? 'high' : (bestVariant.quality?.score ?? 0) >= 60 ? 'medium' : 'low']}`}
                >
                  {bestVariant.quality?.score || 0}/100
                </span>
              </div>
            </div>

            <div className={styles.promptWrapper}>
              <div className={`${styles.promptBox} ${isPromptExpanded ? styles.expanded : ''}`}>
                <p className={styles.promptText}>{bestVariant.optimizedPrompt}</p>
              </div>
              {bestVariant.optimizedPrompt.length > 200 && (
                <button
                  className={styles.expandPromptButton}
                  onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                  aria-label={isPromptExpanded ? 'Show less' : 'Show more'}
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
                      d={
                        isPromptExpanded
                          ? 'M4.5 15.75l7.5-7.5 7.5 7.5'
                          : 'M19.5 8.25l-7.5 7.5-7.5-7.5'
                      }
                    />
                  </svg>
                  {isPromptExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>

            <div className={styles.actionButtons}>
              <button
                className={styles.copyButton}
                onClick={() => onCopy(bestVariant.formatted?.markdown || bestVariant.optimizedPrompt)}
                aria-label="Copy optimized prompt"
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
                    d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
                  />
                </svg>
                Copy to Clipboard
              </button>
            </div>

            {/* Quick Stats */}
            {results.summary && (
              <div className={styles.statsSection}>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Variants Generated</span>
                  <span className={styles.statValue}>{results.summary.totalVariants}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statLabel}>Average Score</span>
                  <span className={styles.statValue}>
                    {Math.round(results.summary.averageScore ?? 0)}
                  </span>
                </div>
                {results.metadata?.activeProvider && (
                  <div className={styles.stat}>
                    <span className={styles.statLabel}>Optimized By</span>
                    <span className={styles.statValue}>{results.metadata.activeProvider}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
