import { useState } from 'react'
import type { HistoryItem } from '@/hooks/useOptimizationHistory'
import styles from './OptimizationHistory.module.css'

interface OptimizationHistoryProps {
  history: HistoryItem[]
  onSelect: (item: HistoryItem) => void
  onToggleFavorite: (id: string) => void
  onRemove: (id: string) => void
  onClear: () => void
}

export function OptimizationHistory({
  history,
  onSelect,
  onToggleFavorite,
  onRemove,
  onClear
}: OptimizationHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  
  const filteredHistory = history.filter(item => {
    const matchesSearch = !searchQuery || 
      item.request.prompt.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesFavorite = !showFavoritesOnly || item.favorite
    return matchesSearch && matchesFavorite
  })

  const formatDate = (date: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins} min ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    
    return date.toLocaleDateString()
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Optimization History</h3>
        {history.length > 0 && (
          <button 
            className={styles.clearButton}
            onClick={onClear}
            aria-label="Clear all history"
          >
            Clear All
          </button>
        )}
      </div>

      {history.length === 0 ? (
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
              d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" 
            />
          </svg>
          <p className={styles.emptyText}>No optimization history yet</p>
          <p className={styles.emptySubtext}>Your optimized prompts will appear here</p>
        </div>
      ) : (
        <>
          <div className={styles.controls}>
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
                placeholder="Search history..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
            
            <button
              className={`${styles.filterButton} ${showFavoritesOnly ? styles.active : ''}`}
              onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
              aria-pressed={showFavoritesOnly}
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                fill={showFavoritesOnly ? 'currentColor' : 'none'}
                viewBox="0 0 24 24" 
                strokeWidth="2" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" 
                />
              </svg>
              Favorites
            </button>
          </div>

          <div className={styles.historyList}>
            {filteredHistory.map(item => {
              const bestVariant = item.result.variants[0]
              const score = bestVariant?.quality?.score || 0
              const scoreClass = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low'
              
              return (
                <div key={item.id} className={styles.historyItem}>
                  <button
                    className={styles.itemButton}
                    onClick={() => onSelect(item)}
                  >
                    <div className={styles.itemHeader}>
                      <span className={styles.timestamp}>
                        {formatDate(item.timestamp)}
                      </span>
                      <span className={`${styles.score} ${styles[scoreClass]}`}>
                        Score: {score}
                      </span>
                    </div>
                    
                    <div className={styles.itemContent}>
                      <p className={styles.originalPrompt}>
                        {item.request.prompt}
                      </p>
                      <p className={styles.optimizedPrompt}>
                        {bestVariant.optimizedPrompt.substring(0, 150)}...
                      </p>
                    </div>
                    
                    <div className={styles.itemMeta}>
                      <span className={styles.metaItem}>
                        {item.request.targetModel}
                      </span>
                      <span className={styles.metaItem}>
                        {item.request.optimizationLevel}
                      </span>
                      <span className={styles.metaItem}>
                        {item.result.variants.length} variants
                      </span>
                    </div>
                  </button>
                  
                  <div className={styles.itemActions}>
                    <button
                      className={`${styles.actionButton} ${item.favorite ? styles.favorite : ''}`}
                      onClick={() => onToggleFavorite(item.id)}
                      aria-label={item.favorite ? 'Remove from favorites' : 'Add to favorites'}
                    >
                      <svg 
                        xmlns="http://www.w3.org/2000/svg" 
                        fill={item.favorite ? 'currentColor' : 'none'}
                        viewBox="0 0 24 24" 
                        strokeWidth="2" 
                        stroke="currentColor"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" 
                        />
                      </svg>
                    </button>
                    
                    <button
                      className={styles.actionButton}
                      onClick={() => onRemove(item.id)}
                      aria-label="Remove from history"
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
                          d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" 
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}