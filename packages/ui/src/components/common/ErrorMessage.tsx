import { useState } from 'react'
import type { CSSProperties } from 'react'

interface ErrorMessageProps {
  message: string
  id?: string
  details?: string
  onRetry?: () => void
  type?: 'error' | 'warning' | 'info'
}

export function ErrorMessage({ message, id, details, onRetry, type = 'error' }: ErrorMessageProps) {
  const [showDetails, setShowDetails] = useState(false)
  
  const getStyles = () => {
    const baseStyle: CSSProperties = {
      padding: '1rem',
      borderRadius: '0.5rem',
      fontSize: '0.875rem',
      lineHeight: '1.25rem',
      border: '1px solid',
    }
    
    switch (type) {
      case 'warning':
        return {
          ...baseStyle,
          backgroundColor: '#fef3c7',
          borderColor: '#fde68a',
          color: '#92400e',
        }
      case 'info':
        return {
          ...baseStyle,
          backgroundColor: '#dbeafe',
          borderColor: '#bfdbfe',
          color: '#1e40af',
        }
      default:
        return {
          ...baseStyle,
          backgroundColor: '#fee2e2',
          borderColor: '#fecaca',
          color: '#dc2626',
        }
    }
  }
  
  const containerStyle: CSSProperties = getStyles()

  const iconStyle: CSSProperties = {
    width: '1.25rem',
    height: '1.25rem',
    flexShrink: 0,
  }
  
  const headerStyle: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  }
  
  const contentStyle: CSSProperties = {
    flex: 1,
  }
  
  const actionsStyle: CSSProperties = {
    display: 'flex',
    gap: '0.75rem',
    marginTop: '0.75rem',
  }
  
  const buttonStyle: CSSProperties = {
    padding: '0.375rem 0.75rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    borderRadius: '0.375rem',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
  }
  
  const detailsStyle: CSSProperties = {
    marginTop: '0.75rem',
    padding: '0.75rem',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: '0.375rem',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  }

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return (
          <svg style={iconStyle} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        )
      case 'info':
        return (
          <svg style={iconStyle} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z"
              clipRule="evenodd"
            />
          </svg>
        )
      default:
        return (
          <svg style={iconStyle} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
              clipRule="evenodd"
            />
          </svg>
        )
    }
  }
  
  // Get friendly error message
  const getFriendlyMessage = (msg: string) => {
    if (msg.includes('Network') || msg.includes('fetch')) {
      return 'Network connection issue. Please check your internet connection.'
    }
    if (msg.includes('API') || msg.includes('api key')) {
      return 'API configuration issue. Please check your API keys.'
    }
    if (msg.includes('timeout')) {
      return 'Request timed out. The server might be busy, please try again.'
    }
    if (msg.includes('rate limit')) {
      return 'Too many requests. Please wait a moment before trying again.'
    }
    return msg
  }

  return (
    <div role="alert" aria-live="assertive" id={id} style={containerStyle}>
      <div style={headerStyle}>
        {getIcon()}
        <div style={contentStyle}>
          <div>{getFriendlyMessage(message)}</div>
          
          {(details || onRetry) && (
            <div style={actionsStyle}>
              {details && (
                <button
                  style={{
                    ...buttonStyle,
                    backgroundColor: 'transparent',
                    color: 'inherit',
                    textDecoration: 'underline',
                  }}
                  onClick={() => setShowDetails(!showDetails)}
                >
                  {showDetails ? 'Hide' : 'Show'} Details
                </button>
              )}
              
              {onRetry && (
                <button
                  style={{
                    ...buttonStyle,
                    backgroundColor: type === 'error' ? '#dc2626' : '#1e40af',
                    color: 'white',
                  }}
                  onClick={onRetry}
                >
                  Try Again
                </button>
              )}
            </div>
          )}
          
          {showDetails && details && (
            <div style={detailsStyle}>
              {details}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
