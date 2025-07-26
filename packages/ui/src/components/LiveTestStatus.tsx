import React from 'react'
import styles from './LiveTestStatus.module.css'

interface ServiceTrace {
  service: string
  method: string
  requestData?: any
  responseData?: any
  responseTime?: number
  timestamp: Date
}

interface LiveTestStatusProps {
  events: any[]
  status: 'testing' | 'completed' | 'error'
  error?: string
}

export function LiveTestStatus({ events, status, error }: LiveTestStatusProps) {
  const serviceTraces: Map<string, ServiceTrace[]> = new Map()
  
  // Process events to build service traces
  events.forEach((event) => {
    if (event.type === 'service_request' || event.type === 'service_response') {
      const key = `${event.service}-${event.method}`
      if (!serviceTraces.has(key)) {
        serviceTraces.set(key, [])
      }
      serviceTraces.get(key)!.push(event)
    }
  })

  const getLatestStatus = () => {
    const latestEvents = events.slice(-20).reverse()

    return latestEvents
      .map((event, index) => {
        switch (event.type) {
          case 'test_started':
            return (
              <div key={index} className={styles.statusItem}>
                🚀 Test started for: "{event.prompt.substring(0, 50)}..."
              </div>
            )

          case 'service_request':
            return (
              <div key={index} className={`${styles.statusItem} ${styles.serviceRequest}`}>
                📤 <strong>{event.service}</strong> → {event.method}
              </div>
            )

          case 'service_response':
            return (
              <div key={index} className={`${styles.statusItem} ${styles.serviceResponse}`}>
                📥 <strong>{event.service}</strong> ← {event.method} ({event.responseTime}ms)
              </div>
            )

          case 'technique_selected':
            return (
              <div key={index} className={styles.statusItem}>
                🎯 Techniques selected: {event.techniques.join(', ')}
              </div>
            )

          case 'variant_generated':
            return (
              <div key={index} className={styles.statusItem}>
                💡 Variant generated (Quality: {event.quality}/100)
              </div>
            )

          case 'safety_check_completed':
            return (
              <div key={index} className={styles.statusItem}>
                {event.passed ? '🛡️' : '⚠️'} Safety check {event.passed ? 'passed' : 'failed'}
              </div>
            )

          case 'provider_test_started':
            return (
              <div key={index} className={styles.statusItem}>
                ⏳ Testing{' '}
                {event.variant === 'original' ? 'original' : `variant ${event.variant + 1}`} with{' '}
                {event.provider}...
              </div>
            )

          case 'provider_test_completed':
            const success = !event.result.error
            return (
              <div key={index} className={styles.statusItem}>
                {success ? '✅' : '❌'} {event.provider} -{' '}
                {event.variant === 'original' ? 'original' : `variant ${event.variant + 1}`}:
                {success
                  ? ` ${event.result.responseTime}ms, ${event.result.tokenCount} tokens`
                  : ` ${event.result.error}`}
              </div>
            )

          case 'optimization_started':
            return (
              <div key={index} className={styles.statusItem}>
                ✨ Optimizing prompt...
              </div>
            )

          case 'optimization_completed':
            return (
              <div key={index} className={styles.statusItem}>
                📊 Generated {event.variantCount} optimized variants in {event.totalTime}ms
              </div>
            )

          case 'test_completed':
            return (
              <div key={index} className={styles.statusItem}>
                🎉 Test completed in {event.duration}ms!
              </div>
            )

          case 'error':
            return (
              <div key={index} className={`${styles.statusItem} ${styles.error}`}>
                ❌ Error: {event.error}
              </div>
            )

          default:
            return null
        }
      })
      .filter(Boolean)
  }

  const getServiceBreakdown = () => {
    const breakdown: any[] = []
    serviceTraces.forEach((traces, key) => {
      const request = traces.find(t => t.type === 'service_request')
      const response = traces.find(t => t.type === 'service_response')
      
      if (request && response) {
        breakdown.push({
          key,
          service: request.service,
          method: request.method,
          responseTime: response.responseTime,
          requestData: request.requestData,
          responseData: response.responseData,
        })
      }
    })
    
    return breakdown
  }

  return (
    <div className={styles.liveTestStatus}>
      <h2>
        {status === 'testing' && '🔄 Testing in Progress...'}
        {status === 'completed' && '✅ Test Completed'}
        {status === 'error' && '❌ Test Failed'}
        {error && <span className={styles.errorMessage}> - {error}</span>}
      </h2>
      
      <div className={styles.testDetails}>
        <div className={styles.statusSection}>
          <h3>📋 Live Activity</h3>
          <div className={styles.statusLog}>{getLatestStatus()}</div>
        </div>
        
        {serviceTraces.size > 0 && (
          <div className={styles.serviceBreakdown}>
            <h3>🔍 Service Breakdown</h3>
            <div className={styles.serviceList}>
              {getServiceBreakdown().map((trace, index) => (
                <details key={index} className={styles.serviceDetail}>
                  <summary>
                    <span className={styles.serviceName}>{trace.service}</span>
                    <span className={styles.serviceMethod}>{trace.method}</span>
                    <span className={styles.serviceTime}>{trace.responseTime}ms</span>
                  </summary>
                  <div className={styles.serviceData}>
                    <div className={styles.requestData}>
                      <h4>Request:</h4>
                      <pre>{JSON.stringify(trace.requestData, null, 2)}</pre>
                    </div>
                    <div className={styles.responseData}>
                      <h4>Response:</h4>
                      <pre>{JSON.stringify(trace.responseData, null, 2)}</pre>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
