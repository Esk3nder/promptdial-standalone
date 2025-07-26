import { useState } from 'react'
import type { OptimizedVariant } from '@/types'
import { DeepLinkButtons } from '@/components/DeepLinkButtons'
import styles from './VariantComparison.module.css'

interface VariantComparisonProps {
  variants: OptimizedVariant[]
  onCopy: (text: string) => void
}

export function VariantComparison({ variants, onCopy }: VariantComparisonProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [expandedPrompts, setExpandedPrompts] = useState<Record<number, boolean>>({})
  const [searchTerm, setSearchTerm] = useState('')
  const [filterScore, setFilterScore] = useState<'all' | 'high' | 'medium' | 'low'>('all')

  // Filter variants based on search and score
  const filteredVariants = variants.filter((variant) => {
    const matchesSearch =
      searchTerm === '' ||
      variant.optimizedPrompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
      variant.changes?.some(
        (change) =>
          change.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          change.description.toLowerCase().includes(searchTerm.toLowerCase()),
      ) ||
      variant.modelSpecificFeatures?.some((feature) =>
        feature.toLowerCase().includes(searchTerm.toLowerCase()),
      )

    const score = variant.quality?.score || 0
    const matchesScore =
      filterScore === 'all' ||
      (filterScore === 'high' && score >= 80) ||
      (filterScore === 'medium' && score >= 60 && score < 80) ||
      (filterScore === 'low' && score < 60)

    return matchesSearch && matchesScore
  })

  // Reset selected index if it's out of bounds
  const safeSelectedIndex = selectedIndex < filteredVariants.length ? selectedIndex : 0
  const selectedVariant = filteredVariants[safeSelectedIndex]

  if (!variants.length) return null

  return (
    <div className={styles.container}>
      {/* Filter Section */}
      <div className={styles.filterSection}>
        <div className={styles.searchBox}>
          <svg
            className={styles.searchIcon}
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
            />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search prompts, techniques, or features..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className={styles.scoreFilter}>
          <label className={styles.filterLabel}>Quality Score:</label>
          <select
            className={styles.filterSelect}
            value={filterScore}
            onChange={(e) => setFilterScore(e.target.value as any)}
          >
            <option value="all">All</option>
            <option value="high">High (80+)</option>
            <option value="medium">Medium (60-79)</option>
            <option value="low">Low (&lt;60)</option>
          </select>
        </div>
      </div>

      {/* Variant Tabs */}
      <div className={styles.tabs}>
        <h3 className={styles.tabsTitle}>
          Optimization Variants ({filteredVariants.length} of {variants.length})
        </h3>
        <div className={styles.tabList} role="tablist">
          {filteredVariants.map((variant, index) => {
            const score = variant.quality?.score || 0
            const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'
            const originalIndex = variants.indexOf(variant)

            return (
              <button
                key={variant.id}
                role="tab"
                aria-selected={index === safeSelectedIndex}
                aria-controls={`variant-panel-${index}`}
                className={`${styles.tab} ${index === safeSelectedIndex ? styles.active : ''}`}
                onClick={() => setSelectedIndex(index)}
              >
                <span className={styles.tabLabel}>Variant {originalIndex + 1}</span>
                <span className={`${styles.tabScore} ${styles[scoreClass]}`}>{score}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* No Results Message */}
      {filteredVariants.length === 0 && (
        <div className={styles.noResults}>
          <p>No variants match your filter criteria.</p>
          <button
            className={styles.clearFiltersButton}
            onClick={() => {
              setSearchTerm('')
              setFilterScore('all')
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Selected Variant Details */}
      {selectedVariant && (
        <div
          id={`variant-panel-${safeSelectedIndex}`}
          role="tabpanel"
          className={styles.variantPanel}
        >
          {/* Variant Header */}
          <div className={styles.variantHeader}>
            <h4 className={styles.variantTitle}>
              Variant {variants.indexOf(selectedVariant) + 1} of {variants.length}
            </h4>
            {selectedVariant.quality && (
              <div className={styles.qualityBadge}>
                <span className={styles.qualityScore}>
                  Quality Score: {selectedVariant.quality.score}/100
                </span>
              </div>
            )}
          </div>

          {/* Optimized Prompt */}
          <div className={styles.promptSection}>
            <div className={styles.promptHeader}>
              <h5 className={styles.sectionTitle}>Optimized Prompt</h5>
              <button
                className={styles.expandButton}
                onClick={() =>
                  setExpandedPrompts((prev) => ({ ...prev, [selectedIndex]: !prev[selectedIndex] }))
                }
                aria-label={expandedPrompts[selectedIndex] ? 'Collapse prompt' : 'Expand prompt'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth="2"
                  stroke="currentColor"
                >
                  {expandedPrompts[selectedIndex] ? (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  )}
                </svg>
                {expandedPrompts[selectedIndex] ? 'Collapse' : 'Expand'}
              </button>
            </div>
            <div
              className={`${styles.promptBox} ${expandedPrompts[selectedIndex] ? styles.expanded : ''}`}
            >
              <p className={styles.promptText}>{selectedVariant.optimizedPrompt}</p>
              <button
                className={styles.copyButton}
                onClick={() => onCopy(selectedVariant.optimizedPrompt)}
                aria-label="Copy this variant"
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
                Copy
              </button>
            </div>
          </div>

          {/* Cognitive Techniques Applied */}
          {selectedVariant.changes && selectedVariant.changes.length > 0 && (
            <div className={styles.techniquesSection}>
              <h5 className={styles.sectionTitle}>Cognitive Techniques Applied</h5>
              <div className={styles.techniquesList}>
                {selectedVariant.changes.map((change, index) => (
                  <div key={index} className={styles.technique}>
                    <div className={styles.techniqueIcon}>✨</div>
                    <div className={styles.techniqueContent}>
                      <h6 className={styles.techniqueName}>{change.type}</h6>
                      <p className={styles.techniqueDescription}>{change.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model-Specific Features */}
          {selectedVariant.modelSpecificFeatures &&
            selectedVariant.modelSpecificFeatures.length > 0 && (
              <div className={styles.featuresSection}>
                <h5 className={styles.sectionTitle}>Model-Specific Optimizations</h5>
                <ul className={styles.featuresList}>
                  {selectedVariant.modelSpecificFeatures.map((feature, index) => (
                    <li key={index} className={styles.feature}>
                      <span className={styles.featureIcon}>🎯</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Quality Factors */}
          {selectedVariant.quality?.factors && (
            <div className={styles.factorsSection}>
              <h5 className={styles.sectionTitle}>Quality Analysis</h5>
              <div className={styles.factorsGrid}>
                {Object.entries(selectedVariant.quality.factors).map(([factor, score]) => {
                  const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'
                  return (
                    <div key={factor} className={styles.factor}>
                      <span className={styles.factorName}>
                        {factor.charAt(0).toUpperCase() + factor.slice(1)}
                      </span>
                      <div className={styles.factorBar}>
                        <div
                          className={`${styles.factorFill} ${styles[scoreClass]}`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className={styles.factorScore}>{score}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Improvement Suggestions */}
          {selectedVariant.quality?.suggestions &&
            selectedVariant.quality.suggestions.length > 0 && (
              <div className={styles.suggestionsSection}>
                <h5 className={styles.sectionTitle}>Improvement Suggestions</h5>
                <ul className={styles.suggestionsList}>
                  {selectedVariant.quality.suggestions.map((suggestion, index) => (
                    <li key={index} className={styles.suggestion}>
                      <span className={styles.suggestionIcon}>💡</span>
                      {suggestion}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Deep Links */}
          <DeepLinkButtons prompt={selectedVariant.optimizedPrompt} className={styles.deepLinks} />
        </div>
      )}
    </div>
  )
}
