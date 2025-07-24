import { useEffect, useRef } from 'react'
import { srOnly } from '@utils/styles'

interface LiveRegionProps {
  message: string
  ariaLive?: 'polite' | 'assertive'
  clearDelay?: number
}

export function LiveRegion({ message, ariaLive = 'polite', clearDelay = 1000 }: LiveRegionProps) {
  const regionRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (message && regionRef.current) {
      // Announce the message
      regionRef.current.textContent = message

      // Clear after delay to prepare for next announcement
      const timer = setTimeout(() => {
        if (regionRef.current) {
          regionRef.current.textContent = ''
        }
      }, clearDelay)

      return () => clearTimeout(timer)
    }
  }, [message, clearDelay])

  return (
    <div ref={regionRef} aria-live={ariaLive} aria-atomic="true" role="status" style={srOnly} />
  )
}
