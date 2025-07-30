import { Component } from 'react'
import type { ReactNode } from 'react'
import { ErrorMessage } from './ErrorMessage'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <ErrorMessage
            message={this.state.error?.message || 'Something went wrong'}
            details={this.state.error?.stack}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        </div>
      )
    }

    return this.props.children
  }
}
