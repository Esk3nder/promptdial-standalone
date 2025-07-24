import React from 'react'

interface TestResult {
  responseTime: number
  tokenCount: number
  responseText: string
  error?: string
}

interface ProviderCardProps {
  provider: string
  original?: TestResult
  optimized?: TestResult
}

export function ProviderCard({ provider, original, optimized }: ProviderCardProps) {
  const getProviderIcon = () => {
    switch (provider) {
      case 'openai':
        return '🤖'
      case 'anthropic':
        return '🧠'
      case 'google':
        return '🔍'
      default:
        return '💡'
    }
  }

  const getProviderName = () => {
    switch (provider) {
      case 'openai':
        return 'OpenAI'
      case 'anthropic':
        return 'Anthropic'
      case 'google':
        return 'Google'
      default:
        return provider
    }
  }

  const calculateImprovement = (original: number, optimized: number) => {
    const improvement = ((original - optimized) / original) * 100
    return improvement
  }

  if (!original || !optimized) {
    return (
      <div className="provider-card loading">
        <h3>
          {getProviderIcon()} {getProviderName()}
        </h3>
        <p>Waiting for results...</p>
      </div>
    )
  }

  if (original.error || optimized.error) {
    return (
      <div className="provider-card error">
        <h3>
          {getProviderIcon()} {getProviderName()}
        </h3>
        <p>❌ {original.error || optimized.error}</p>
      </div>
    )
  }

  const timeImprovement = calculateImprovement(original.responseTime, optimized.responseTime)
  const tokenImprovement = calculateImprovement(original.tokenCount, optimized.tokenCount)

  return (
    <div className="provider-card">
      <h3>
        {getProviderIcon()} {getProviderName()}
      </h3>

      <div className="metrics">
        <div className="metric">
          <span className="label">Response Time:</span>
          <div className="values">
            <span className="original">{original.responseTime}ms</span>
            <span className="arrow">→</span>
            <span className="optimized">{optimized.responseTime}ms</span>
            <span className={`improvement ${timeImprovement > 0 ? 'positive' : 'negative'}`}>
              ({timeImprovement > 0 ? '+' : ''}
              {timeImprovement.toFixed(1)}%)
            </span>
          </div>
        </div>

        <div className="metric">
          <span className="label">Token Count:</span>
          <div className="values">
            <span className="original">{original.tokenCount}</span>
            <span className="arrow">→</span>
            <span className="optimized">{optimized.tokenCount}</span>
            <span className={`improvement ${tokenImprovement > 0 ? 'positive' : 'negative'}`}>
              ({tokenImprovement > 0 ? '+' : ''}
              {tokenImprovement.toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
