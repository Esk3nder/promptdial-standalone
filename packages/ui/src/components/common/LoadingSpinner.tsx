import type { CSSProperties } from 'react'
import { VisuallyHidden } from './VisuallyHidden'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}

const sizes = {
  sm: 16,
  md: 24,
  lg: 32,
}

export function LoadingSpinner({ 
  size = 'md', 
  label = 'Loading' 
}: LoadingSpinnerProps) {
  const dimension = sizes[size]
  
  const spinnerStyle: CSSProperties = {
    width: dimension,
    height: dimension,
    border: '2px solid #e5e7eb',
    borderTopColor: '#2563eb',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  }
  
  return (
    <div 
      role="status" 
      aria-live="polite"
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
    >
      <div style={spinnerStyle} />
      <VisuallyHidden>{label}</VisuallyHidden>
      <style>
        {`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  )
}