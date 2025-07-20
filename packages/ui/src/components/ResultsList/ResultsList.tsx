import type { OptimizedResult } from '@/types'
import { VariantCard } from '@/components/VariantCard'
import { LoadingSpinner, ErrorMessage, LiveRegion } from '@/components/common'
import styles from './ResultsList.module.css'

interface ResultsListProps {
  isLoading: boolean
  results: OptimizedResult | null
  error?: string
  onCopy: (text: string) => void
}

export function ResultsList({ isLoading, results, error, onCopy }: ResultsListProps) {
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
          <p className={styles.emptyText}>
            Enter a prompt above and click "Optimize" to get started
          </p>
        </div>
      </div>
    )
  }

  const { variants, summary, request } = results
  const variantCount = variants.length

  return (
    <div className={styles.container}>
      {/* Screen reader announcement */}
      <LiveRegion 
        message={`${variantCount} optimized variant${variantCount !== 1 ? 's' : ''} ready`}
      />

      {/* Header */}
      <div className={styles.header}>
        <h2 className={styles.title}>Optimization Results</h2>
        <p className={styles.subtitle}>
          {variantCount} variant{variantCount !== 1 ? 's' : ''} generated
        </p>
      </div>

      {/* Request info */}
      <div className={styles.requestInfo}>
        <span className={styles.infoItem}>Model: {request.targetModel}</span>
        <span className={styles.infoItem}>Level: {request.optimizationLevel}</span>
        {request.taskType && (
          <span className={styles.infoItem}>Task: {request.taskType}</span>
        )}
      </div>

      {/* Summary statistics */}
      {(summary.bestScore !== undefined || summary.averageScore !== undefined) && (
        <div className={styles.summary}>
          {summary.bestScore !== undefined && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Best Score:</span>
              <span className={styles.statValue}>{summary.bestScore}/100</span>
            </div>
          )}
          {summary.averageScore !== undefined && (
            <div className={styles.stat}>
              <span className={styles.statLabel}>Average:</span>
              <span className={styles.statValue}>{Math.round(summary.averageScore)}/100</span>
            </div>
          )}
        </div>
      )}

      {/* Variants list */}
      <div className={styles.variantsList} role="list">
        {variants.map((variant, index) => (
          <div key={variant.id} role="listitem">
            <VariantCard
              variant={variant}
              onCopy={onCopy}
              index={index}
            />
          </div>
        ))}
      </div>
    </div>
  )
}