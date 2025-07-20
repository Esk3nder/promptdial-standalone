import { useState } from 'react'
import type { OptimizedVariant, ValidationResult } from '@/types'
import { getScoreColor, getScoreLabel } from '@/utils/styles'
import styles from './VariantCard.module.css'

interface VariantCardProps {
  variant: OptimizedVariant & { quality?: ValidationResult }
  onCopy: (text: string) => void
  index: number
}

export function VariantCard({ variant, onCopy, index }: VariantCardProps) {
  const [copied, setCopied] = useState(false)
  const variantNumber = index + 1

  const handleCopy = () => {
    onCopy(variant.optimizedPrompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const score = variant.quality?.score ?? null
  const scoreColor = score !== null ? getScoreColor(score) : '#6b7280'
  const scoreLabel = score !== null ? getScoreLabel(score) : 'N/A'

  return (
    <article 
      className={styles.card}
      aria-label={`Optimized variant ${variantNumber}`}
    >
      {/* Header with score */}
      <div className={styles.header}>
        <div className={styles.scoreContainer}>
          <span 
            className={styles.score}
            style={{ color: scoreColor }}
          >
            {score !== null ? `${score}/100` : 'N/A'}
          </span>
          <span className={styles.scoreLabel}>{scoreLabel}</span>
        </div>
        <button
          className={styles.copyButton}
          onClick={handleCopy}
          aria-label={`Copy optimized variant ${variantNumber}`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Optimized prompt */}
      <div className={styles.promptSection}>
        <h3 className={styles.sectionTitle}>Optimized Prompt</h3>
        <p className={styles.prompt}>{variant.optimizedPrompt}</p>
      </div>

      {/* Changes */}
      {variant.changes.length > 0 && (
        <div className={styles.changesSection}>
          <h3 className={styles.sectionTitle}>Improvements</h3>
          <ul className={styles.changesList}>
            {variant.changes.map((change, i) => (
              <li key={i} className={styles.changeItem}>
                {change.type}: {change.description}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Model-specific features */}
      {variant.modelSpecificFeatures.length > 0 && (
        <div className={styles.featuresSection}>
          <h3 className={styles.sectionTitle}>Model Features</h3>
          <div className={styles.featuresList}>
            {variant.modelSpecificFeatures.map((feature, i) => (
              <span key={i} className={styles.featureTag}>
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Token estimate */}
      <div className={styles.footer}>
        <span className={styles.tokenCount}>~{variant.estimatedTokens} tokens</span>
      </div>
    </article>
  )
}