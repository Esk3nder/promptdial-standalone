import React from 'react'

interface ComparisonChartProps {
  results: {
    original: any
    optimized: any[]
    summary?: {
      averageImprovement: {
        responseTime: number
        tokenCount: number
      }
    }
  }
}

export function ComparisonChart({ results }: ComparisonChartProps) {
  if (!results.summary) return null

  const { averageImprovement } = results.summary

  const renderBar = (value: number, label: string) => {
    const isPositive = value > 0
    const width = Math.min(Math.abs(value), 100)

    return (
      <div className="metric-bar">
        <div className="label">{label}</div>
        <div className="bar-container">
          <div className="baseline" />
          <div
            className={`bar ${isPositive ? 'positive' : 'negative'}`}
            style={{
              width: `${width}%`,
              marginLeft: isPositive ? '50%' : `${50 - width}%`,
            }}
          />
          <span className="value">
            {isPositive ? '+' : ''}
            {value.toFixed(1)}%
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="comparison-chart">
      <h2>📊 Performance Comparison</h2>
      <p className="subtitle">Average improvement across all providers</p>

      <div className="metrics">
        {renderBar(averageImprovement.responseTime, 'Response Time')}
        {renderBar(averageImprovement.tokenCount, 'Token Usage')}
      </div>

      <div className="legend">
        <span className="positive">■ Better</span>
        <span className="negative">■ Worse</span>
      </div>
    </div>
  )
}
