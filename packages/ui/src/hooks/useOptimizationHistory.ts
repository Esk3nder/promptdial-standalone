import { useCallback, useEffect, useState } from 'react'
import type { OptimizationRequest, OptimizedResult } from '@/types'

export interface HistoryItem {
  id: string
  timestamp: Date
  request: OptimizationRequest
  result: OptimizedResult
  favorite: boolean
}

const HISTORY_KEY = 'promptdial-optimization-history'
const MAX_HISTORY_ITEMS = 50

export function useOptimizationHistory() {
  const [history, setHistory] = useState<HistoryItem[]>([])

  // Load history from localStorage on mount
  useEffect(() => {
    const loadHistory = () => {
      try {
        const stored = localStorage.getItem(HISTORY_KEY)
        if (stored) {
          const parsed = JSON.parse(stored)
          // Convert timestamp strings back to Date objects
          const items = parsed.map((item: any) => ({
            ...item,
            timestamp: new Date(item.timestamp),
          }))
          setHistory(items)
        }
      } catch (error) {
        console.error('Failed to load history:', error)
      }
    }

    loadHistory()
  }, [])

  // Save history to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    } catch (error) {
      console.error('Failed to save history:', error)
    }
  }, [history])

  const addToHistory = useCallback((request: OptimizationRequest, result: OptimizedResult) => {
    const newItem: HistoryItem = {
      id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      request,
      result,
      favorite: false,
    }

    setHistory((prev) => {
      // Add new item at the beginning and limit to MAX_HISTORY_ITEMS
      const updated = [newItem, ...prev].slice(0, MAX_HISTORY_ITEMS)
      return updated
    })
  }, [])

  const removeFromHistory = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toggleFavorite = useCallback((id: string) => {
    setHistory((prev) =>
      prev.map((item) => (item.id === id ? { ...item, favorite: !item.favorite } : item)),
    )
  }, [])

  const clearHistory = useCallback(() => {
    setHistory([])
  }, [])

  const getFavorites = useCallback(() => {
    return history.filter((item) => item.favorite)
  }, [history])

  const searchHistory = useCallback(
    (query: string) => {
      const lowerQuery = query.toLowerCase()
      return history.filter(
        (item) =>
          item.request.prompt.toLowerCase().includes(lowerQuery) ||
          item.result.variants.some((v) => v.optimizedPrompt.toLowerCase().includes(lowerQuery)),
      )
    },
    [history],
  )

  return {
    history,
    addToHistory,
    removeFromHistory,
    toggleFavorite,
    clearHistory,
    getFavorites,
    searchHistory,
  }
}
