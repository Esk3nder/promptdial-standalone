import { useEffect, useCallback } from 'react'

interface ShortcutConfig {
  key: string
  ctrl?: boolean
  cmd?: boolean
  shift?: boolean
  alt?: boolean
  handler: () => void
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const {
          key,
          ctrl = false,
          cmd = false,
          shift = false,
          alt = false,
          handler,
          preventDefault = true,
        } = shortcut

        const isCtrlMatch = ctrl ? event.ctrlKey : !event.ctrlKey
        const isCmdMatch = cmd ? event.metaKey : !event.metaKey
        const isShiftMatch = shift ? event.shiftKey : !event.shiftKey
        const isAltMatch = alt ? event.altKey : !event.altKey

        if (event.key === key && isCtrlMatch && isCmdMatch && isShiftMatch && isAltMatch) {
          if (preventDefault) {
            event.preventDefault()
          }
          handler()
        }
      })
    },
    [shortcuts],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

// Common shortcuts
export const commonShortcuts = {
  submitForm: { key: 'Enter', cmd: true },
  escape: { key: 'Escape' },
  nextItem: { key: 'ArrowDown' },
  prevItem: { key: 'ArrowUp' },
  selectItem: { key: 'Enter' },
}
