import { useState, useEffect, useRef } from 'react'
import type { OptimizedResult } from '@/types'
import { LoadingSpinner, ErrorMessage, LiveRegion } from '@/components/common'
import styles from './ResultsList.module.css'

interface ResultsListProps {
  isLoading: boolean
  results: OptimizedResult | null
  error?: string
  onCopy: (text: string) => void
}

export function ResultsList({ isLoading, results, error, onCopy }: ResultsListProps) {
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [userHasScrolled, setUserHasScrolled] = useState(false)
  const promptDisplayRef = useRef<HTMLDivElement>(null)
  const bestVariant = results?.variants[0]
  const fullText = bestVariant?.optimizedPrompt || ''
  
  // Stream the text when results change
  useEffect(() => {
    if (!fullText || !results) {
      setStreamedText('')
      return
    }
    
    setIsStreaming(true)
    setStreamedText('')
    setUserHasScrolled(false)
    
    // Stream characters
    let currentIndex = 0
    const words = fullText.split(' ')
    
    const streamInterval = setInterval(() => {
      if (currentIndex < words.length) {
        const nextWords = words.slice(0, currentIndex + 1).join(' ')
        setStreamedText(nextWords)
        currentIndex++
      } else {
        clearInterval(streamInterval)
        setIsStreaming(false)
      }
    }, 50) // Stream one word every 50ms
    
    return () => clearInterval(streamInterval)
  }, [fullText, results])
  
  // Auto-scroll logic
  useEffect(() => {
    if (isStreaming && !userHasScrolled && promptDisplayRef.current) {
      promptDisplayRef.current.scrollTop = promptDisplayRef.current.scrollHeight
    }
  }, [streamedText, isStreaming, userHasScrolled])
  
  // Detect user scroll
  const handleScroll = () => {
    if (promptDisplayRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = promptDisplayRef.current
      const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 10
      setUserHasScrolled(!isAtBottom)
    }
  }
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
          <svg className={styles.emptyIcon} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <h3 className={styles.emptyTitle}>Ready to refine</h3>
          <p className={styles.emptyText}>
            Enter your prompt in the control panel and click "Refine Prompt"<br />
            to get started
          </p>
        </div>
      </div>
    )
  }

  const score = bestVariant?.quality?.score || 0
  const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'

  return (
    <div className={styles.container}>
      <div className={styles.resultContainer}>
        {/* Screen reader announcement */}
        <LiveRegion 
          message="Optimized prompt ready"
        />

        {/* Result Header */}
        <div className={styles.resultHeader}>
          <h3 className={styles.resultTitle}>Optimized Result</h3>
          <div className={`${styles.scoreBadge} ${styles[scoreClass]}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
            Score: {score}/100
          </div>
        </div>

        {/* Prompt Display */}
        <div 
          ref={promptDisplayRef}
          className={styles.promptDisplay}
          onScroll={handleScroll}
        >
          {streamedText}
          {isStreaming && <span className={styles.cursor}>▊</span>}
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button 
            className={styles.copyButton}
            onClick={() => onCopy(fullText)}
            disabled={isStreaming}
            aria-label="Copy optimized prompt to clipboard"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
            </svg>
            Copy
          </button>
        </div>
      </div>
    </div>
  )
}