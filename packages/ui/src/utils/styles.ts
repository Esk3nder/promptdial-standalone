// Utility classes for accessibility and styling

export const srOnly = {
  position: 'absolute' as const,
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap' as const,
  borderWidth: 0,
}

export const focusRing = {
  outline: '2px solid #2563eb',
  outlineOffset: '2px',
}

export const buttonBase = {
  padding: '0.5rem 1rem',
  borderRadius: '0.375rem',
  fontWeight: 500,
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
  cursor: 'pointer',
  transition: 'all 150ms ease-in-out',
  border: 'none',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
}

export const inputBase = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.375rem',
  border: '1px solid #e5e7eb',
  fontSize: '0.875rem',
  lineHeight: '1.25rem',
  transition: 'all 150ms ease-in-out',
  backgroundColor: 'white',
  '&:focus': {
    ...focusRing,
    borderColor: '#2563eb',
  },
  '&:disabled': {
    backgroundColor: '#f9fafb',
    cursor: 'not-allowed',
  },
}

// Color utilities for quality scores
export function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981' // green
  if (score >= 60) return '#f59e0b' // amber
  return '#ef4444' // red
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Excellent'
  if (score >= 60) return 'Good'
  return 'Needs Improvement'
}