import { useState, useCallback } from 'react'

interface UseClipboardOptions {
  timeout?: number
  onSuccess?: () => void
  onError?: (error: Error) => void
}

interface UseClipboardReturn {
  copy: (text: string) => Promise<void>
  copied: boolean
  error: Error | null
  isSupported: boolean
}

export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const { timeout = 2000, onSuccess, onError } = options
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const isSupported = !!(
    navigator?.clipboard?.writeText ||
    (document.queryCommandSupported && document.queryCommandSupported('copy'))
  )

  const copy = useCallback(
    async (text: string) => {
      try {
        // Modern clipboard API
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
        } else {
          // Fallback for older browsers
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          textarea.style.pointerEvents = 'none'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)
        }

        setCopied(true)
        setError(null)
        onSuccess?.()

        // Reset copied state after timeout
        setTimeout(() => setCopied(false), timeout)
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to copy')
        setError(error)
        setCopied(false)
        onError?.(error)
      }
    },
    [timeout, onSuccess, onError],
  )

  return { copy, copied, error, isSupported }
}

// Helper function for direct clipboard operations
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // Fallback
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    const success = document.execCommand('copy')
    document.body.removeChild(textarea)
    return success
  } catch {
    return false
  }
}
