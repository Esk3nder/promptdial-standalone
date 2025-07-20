import type { CSSProperties } from 'react'

interface ErrorMessageProps {
  message: string
  id?: string
}

export function ErrorMessage({ message, id }: ErrorMessageProps) {
  const errorStyle: CSSProperties = {
    padding: '0.75rem 1rem',
    backgroundColor: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '0.375rem',
    color: '#dc2626',
    fontSize: '0.875rem',
    lineHeight: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  }
  
  const iconStyle: CSSProperties = {
    width: '1rem',
    height: '1rem',
    flexShrink: 0,
  }
  
  return (
    <div 
      role="alert" 
      aria-live="assertive"
      id={id}
      style={errorStyle}
    >
      <svg 
        style={iconStyle}
        fill="currentColor" 
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path 
          fillRule="evenodd" 
          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" 
          clipRule="evenodd" 
        />
      </svg>
      <span>{message}</span>
    </div>
  )
}