import { useRef, useEffect } from 'react'
import type { RefObject } from 'react'

interface UseFocusManagementOptions {
  autoFocus?: boolean
  restoreFocus?: boolean
  trapFocus?: boolean
}

export function useFocusManagement<T extends HTMLElement>(
  options: UseFocusManagementOptions = {},
): RefObject<T> {
  const { autoFocus = false, restoreFocus = false, trapFocus = false } = options
  const elementRef = useRef<T>(null)
  const previousActiveElement = useRef<Element | null>(null)

  // Auto focus on mount
  useEffect(() => {
    if (autoFocus && elementRef.current) {
      previousActiveElement.current = document.activeElement
      elementRef.current.focus()
    }

    // Restore focus on unmount
    return () => {
      if (restoreFocus && previousActiveElement.current instanceof HTMLElement) {
        previousActiveElement.current.focus()
      }
    }
  }, [autoFocus, restoreFocus])

  // Focus trap
  useEffect(() => {
    if (!trapFocus || !elementRef.current) return

    const element = elementRef.current
    const focusableElements = element.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )

    const firstFocusable = focusableElements[0] as HTMLElement
    const lastFocusable = focusableElements[focusableElements.length - 1] as HTMLElement

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault()
          lastFocusable?.focus()
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault()
          firstFocusable?.focus()
        }
      }
    }

    element.addEventListener('keydown', handleKeyDown)
    return () => element.removeEventListener('keydown', handleKeyDown)
  }, [trapFocus])

  return elementRef
}

// Helper to focus first focusable element
export function focusFirstElement(container: HTMLElement) {
  const focusable = container.querySelector(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
  ) as HTMLElement

  focusable?.focus()
}
