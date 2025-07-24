import { axe, toHaveNoViolations } from 'jest-axe'
import { ReactElement } from 'react'
import { render } from './test-utils'
import userEvent from '@testing-library/user-event'

// Extend Vitest matchers
expect.extend(toHaveNoViolations)

// Helper to run accessibility tests
export async function expectNoA11yViolations(ui: ReactElement) {
  const { container } = render(ui)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
}

// Common ARIA patterns
export const ariaLabels = {
  promptInput: 'Enter your prompt',
  modelSelector: 'Select target AI model',
  levelSelector: 'Select optimization level',
  taskTypeSelector: 'Select task type (optional)',
  optimizeButton: 'Optimize prompt',
  copyButton: (index: number) => `Copy optimized variant ${index + 1}`,
  resultCard: (index: number) => `Optimized variant ${index + 1}`,
  qualityScore: (score: number) => `Quality score: ${score} out of 100`,
  loadingSpinner: 'Optimizing your prompt',
  errorMessage: 'Error message',
}

// Keyboard navigation helpers
export const keyboard = {
  tab: { key: 'Tab' },
  shiftTab: { key: 'Tab', shiftKey: true },
  enter: { key: 'Enter' },
  escape: { key: 'Escape' },
  arrowDown: { key: 'ArrowDown' },
  arrowUp: { key: 'ArrowUp' },
  cmdEnter: { key: 'Enter', metaKey: true },
}

// Focus management test helpers
export async function expectFocusOrder(elements: HTMLElement[]) {
  const user = userEvent.setup()

  for (let i = 0; i < elements.length; i++) {
    elements[i].focus()
    expect(document.activeElement).toBe(elements[i])
    if (i < elements.length - 1) {
      await user.tab()
    }
  }
}

// Screen reader announcement helpers
export function createLiveRegion(ariaLive: 'polite' | 'assertive' = 'polite') {
  const region = document.createElement('div')
  region.setAttribute('aria-live', ariaLive)
  region.setAttribute('aria-atomic', 'true')
  region.className = 'sr-only'
  document.body.appendChild(region)
  return region
}

export function announceToScreenReader(message: string, region?: HTMLElement) {
  const liveRegion = region || document.querySelector('[aria-live]') || createLiveRegion()
  liveRegion.textContent = message

  // Clear after announcement
  setTimeout(() => {
    liveRegion.textContent = ''
  }, 1000)
}
