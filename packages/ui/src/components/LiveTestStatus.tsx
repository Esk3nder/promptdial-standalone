import React from 'react'

interface LiveTestStatusProps {
  events: any[]
  status: 'testing' | 'completed' | 'error'
}

export function LiveTestStatus({ events, status }: LiveTestStatusProps) {
  const getLatestStatus = () => {
    const latestEvents = events.slice(-10).reverse()

    return latestEvents
      .map((event, index) => {
        switch (event.type) {
          case 'test_started':
            return (
              <div key={index} className="status-item">
                🚀 Test started for: "{event.prompt.substring(0, 50)}..."
              </div>
            )

          case 'provider_test_started':
            return (
              <div key={index} className="status-item">
                ⏳ Testing{' '}
                {event.variant === 'original' ? 'original' : `variant ${event.variant + 1}`} with{' '}
                {event.provider}...
              </div>
            )

          case 'provider_test_completed':
            const success = !event.result.error
            return (
              <div key={index} className="status-item">
                {success ? '✅' : '❌'} {event.provider} -{' '}
                {event.variant === 'original' ? 'original' : `variant ${event.variant + 1}`}:
                {success
                  ? ` ${event.result.responseTime}ms, ${event.result.tokenCount} tokens`
                  : ` ${event.result.error}`}
              </div>
            )

          case 'optimization_started':
            return (
              <div key={index} className="status-item">
                ✨ Optimizing prompt...
              </div>
            )

          case 'optimization_completed':
            return (
              <div key={index} className="status-item">
                📊 Generated {event.variantCount} optimized variants
              </div>
            )

          case 'test_completed':
            return (
              <div key={index} className="status-item">
                🎉 Test completed!
              </div>
            )

          default:
            return null
        }
      })
      .filter(Boolean)
  }

  return (
    <div className="live-test-status">
      <h2>
        {status === 'testing' && '🔄 Testing in Progress...'}
        {status === 'completed' && '✅ Test Completed'}
        {status === 'error' && '❌ Test Failed'}
      </h2>
      <div className="status-log">{getLatestStatus()}</div>
    </div>
  )
}
