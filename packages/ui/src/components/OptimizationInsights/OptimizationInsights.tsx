import { useState } from 'react'
import type { OptimizedVariant, OptimizedResult } from '@/types'
import styles from './OptimizationInsights.module.css'

interface OptimizationInsightsProps {
  result: OptimizedResult
}

export function OptimizationInsights({ result }: OptimizationInsightsProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev)
      if (newSet.has(section)) {
        newSet.delete(section)
      } else {
        newSet.add(section)
      }
      return newSet
    })
  }

  const bestVariant = result.variants[0]
  
  // Extract unique techniques used across all variants
  const allTechniques = new Set<string>()
  const techniqueDescriptions = new Map<string, string[]>()
  
  result.variants.forEach(variant => {
    variant.changes?.forEach(change => {
      allTechniques.add(change.type)
      if (!techniqueDescriptions.has(change.type)) {
        techniqueDescriptions.set(change.type, [])
      }
      techniqueDescriptions.get(change.type)?.push(change.description)
    })
  })

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Optimization Insights</h3>
      
      {/* Summary Section */}
      <div className={styles.summarySection}>
        <div className={styles.summaryCard}>
          <h4 className={styles.summaryTitle}>Optimization Summary</h4>
          <div className={styles.summaryStats}>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Variants Generated</span>
              <span className={styles.statValue}>{result.summary.totalVariants}</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Best Score</span>
              <span className={styles.statValue}>{result.summary.bestScore}/100</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statLabel}>Improvement</span>
              <span className={styles.statValue}>
                {bestVariant.quality?.improvementPercentage || 0}%
              </span>
            </div>
          </div>
          
          {result.metadata && (
            <div className={styles.metadata}>
              <span className={styles.metaLabel}>Optimization Mode:</span>
              <span className={styles.metaValue}>{result.metadata.optimizationMode}</span>
              {result.metadata.activeProvider && (
                <>
                  <span className={styles.metaLabel}>Provider:</span>
                  <span className={styles.metaValue}>{result.metadata.activeProvider}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Techniques Applied */}
      <div className={styles.section}>
        <button
          className={styles.sectionHeader}
          onClick={() => toggleSection('techniques')}
          aria-expanded={expandedSections.has('techniques')}
        >
          <svg 
            className={`${styles.sectionIcon} ${expandedSections.has('techniques') ? styles.expanded : ''}`}
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth="2" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h4 className={styles.sectionTitle}>
            Cognitive Techniques Applied ({allTechniques.size})
          </h4>
        </button>
        
        {expandedSections.has('techniques') && (
          <div className={styles.sectionContent}>
            {Array.from(allTechniques).map(technique => (
              <div key={technique} className={styles.techniqueCard}>
                <h5 className={styles.techniqueName}>{technique}</h5>
                <ul className={styles.techniqueDescriptions}>
                  {Array.from(new Set(techniqueDescriptions.get(technique) || [])).map((desc, i) => (
                    <li key={i}>{desc}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Why These Optimizations */}
      <div className={styles.section}>
        <button
          className={styles.sectionHeader}
          onClick={() => toggleSection('why')}
          aria-expanded={expandedSections.has('why')}
        >
          <svg 
            className={`${styles.sectionIcon} ${expandedSections.has('why') ? styles.expanded : ''}`}
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth="2" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h4 className={styles.sectionTitle}>Why These Optimizations?</h4>
        </button>
        
        {expandedSections.has('why') && (
          <div className={styles.sectionContent}>
            <div className={styles.explanationCard}>
              <p className={styles.explanation}>
                Based on the analysis of your prompt, the system identified it as a 
                <strong> {result.request.taskType || 'general'} </strong> 
                task requiring 
                <strong> {result.request.optimizationLevel} </strong> 
                level optimization.
              </p>
              
              <p className={styles.explanation}>
                The Ultra-Think cognitive framework was applied to enhance your prompt by:
              </p>
              
              <ul className={styles.enhancementList}>
                <li>Activating deeper reasoning patterns through open-ended framing</li>
                <li>Creating cognitive bridges between concepts for better understanding</li>
                <li>Embedding metacognitive triggers to promote self-reflection</li>
                <li>Enabling emergent insights through discovery-oriented language</li>
              </ul>
              
              {bestVariant.modelSpecificFeatures && bestVariant.modelSpecificFeatures.length > 0 && (
                <>
                  <p className={styles.explanation}>
                    Model-specific optimizations for {result.request.targetModel}:
                  </p>
                  <ul className={styles.enhancementList}>
                    {bestVariant.modelSpecificFeatures.map((feature, i) => (
                      <li key={i}>{feature}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quality Breakdown */}
      {bestVariant.quality && (
        <div className={styles.section}>
          <button
            className={styles.sectionHeader}
            onClick={() => toggleSection('quality')}
            aria-expanded={expandedSections.has('quality')}
          >
            <svg 
              className={`${styles.sectionIcon} ${expandedSections.has('quality') ? styles.expanded : ''}`}
              xmlns="http://www.w3.org/2000/svg" 
              fill="none" 
              viewBox="0 0 24 24" 
              strokeWidth="2" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
            <h4 className={styles.sectionTitle}>Quality Analysis</h4>
          </button>
          
          {expandedSections.has('quality') && (
            <div className={styles.sectionContent}>
              <div className={styles.qualityGrid}>
                {Object.entries(bestVariant.quality.factors).map(([factor, score]) => (
                  <div key={factor} className={styles.qualityFactor}>
                    <h5 className={styles.factorName}>
                      {factor.charAt(0).toUpperCase() + factor.slice(1)}
                    </h5>
                    <div className={styles.factorScore}>
                      <div className={styles.factorBar}>
                        <div 
                          className={styles.factorFill}
                          style={{ 
                            width: `${score}%`,
                            backgroundColor: score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444'
                          }}
                        />
                      </div>
                      <span className={styles.factorValue}>{score}%</span>
                    </div>
                    <p className={styles.factorDescription}>
                      {getFactorDescription(factor, score)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Learning Resources */}
      <div className={styles.section}>
        <button
          className={styles.sectionHeader}
          onClick={() => toggleSection('learn')}
          aria-expanded={expandedSections.has('learn')}
        >
          <svg 
            className={`${styles.sectionIcon} ${expandedSections.has('learn') ? styles.expanded : ''}`}
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24" 
            strokeWidth="2" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <h4 className={styles.sectionTitle}>Learn More</h4>
        </button>
        
        {expandedSections.has('learn') && (
          <div className={styles.sectionContent}>
            <div className={styles.resourceCard}>
              <h5 className={styles.resourceTitle}>Prompt Engineering Best Practices</h5>
              <ul className={styles.resourceList}>
                <li>
                  <strong>Be Specific:</strong> Clear, detailed prompts yield better results
                </li>
                <li>
                  <strong>Use Examples:</strong> Few-shot learning improves understanding
                </li>
                <li>
                  <strong>Structure Matters:</strong> Logical organization enhances comprehension
                </li>
                <li>
                  <strong>Iterate:</strong> Refine prompts based on results
                </li>
              </ul>
            </div>
            
            <div className={styles.resourceCard}>
              <h5 className={styles.resourceTitle}>Cognitive Enhancement Techniques</h5>
              <p className={styles.resourceText}>
                The Ultra-Think framework leverages cognitive science principles to enhance
                AI reasoning. Key techniques include thought decomposition, perspective
                synthesis, and recursive enhancement patterns.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function getFactorDescription(factor: string, score: number): string {
  const descriptions: Record<string, Record<string, string>> = {
    clarity: {
      high: "The prompt is exceptionally clear and unambiguous",
      medium: "The prompt is reasonably clear with minor ambiguities",
      low: "The prompt could be clearer and more specific"
    },
    specificity: {
      high: "Contains precise details and requirements",
      medium: "Has good specificity but could include more details",
      low: "Lacks specific details and requirements"
    },
    structure: {
      high: "Well-organized with logical flow",
      medium: "Has decent structure with room for improvement",
      low: "Could benefit from better organization"
    },
    completeness: {
      high: "Covers all necessary aspects comprehensively",
      medium: "Covers main points but missing some details",
      low: "Missing important information or context"
    },
    efficiency: {
      high: "Concise yet comprehensive",
      medium: "Good balance of brevity and detail",
      low: "Could be more concise without losing meaning"
    },
    modelAlignment: {
      high: "Perfectly optimized for the target model",
      medium: "Well-suited for the model with minor adjustments",
      low: "Could be better tailored to the model's strengths"
    },
    safety: {
      high: "No safety concerns detected",
      medium: "Minor safety considerations",
      low: "Contains potentially problematic content"
    }
  }
  
  const level = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'
  return descriptions[factor]?.[level] || `Score: ${score}%`
}