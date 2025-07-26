import React from 'react'
import styles from './ServiceBreakdown.module.css'

interface ServiceEvent {
  type: string
  service: string
  method?: string
  requestData?: any
  responseData?: any
  responseTime?: number
  timestamp: Date
  techniques?: string[]
  quality?: number
  variantId?: string
  taskType?: string
}

interface ServiceBreakdownProps {
  events: ServiceEvent[]
}

export function ServiceBreakdown({ events }: ServiceBreakdownProps) {
  // Group events by service
  const serviceGroups = events.reduce((acc, event) => {
    if (!event.service) return acc
    
    if (!acc[event.service]) {
      acc[event.service] = []
    }
    acc[event.service].push(event)
    return acc
  }, {} as Record<string, ServiceEvent[]>)

  // Extract key metrics
  const metrics = {
    totalServiceCalls: events.filter(e => e.type === 'service_request').length,
    totalResponseTime: events
      .filter(e => e.type === 'service_response' && e.responseTime)
      .reduce((sum, e) => sum + (e.responseTime || 0), 0),
    techniques: events.find(e => e.type === 'technique_selected')?.techniques || [],
    variantsGenerated: events.filter(e => e.type === 'variant_generated').length,
  }

  return (
    <div className={styles.serviceBreakdown}>
      <h3>🔍 Service Breakdown</h3>
      
      {/* Key Metrics */}
      <div className={styles.metrics}>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total Service Calls</span>
          <span className={styles.metricValue}>{metrics.totalServiceCalls}</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Total Response Time</span>
          <span className={styles.metricValue}>{metrics.totalResponseTime}ms</span>
        </div>
        <div className={styles.metric}>
          <span className={styles.metricLabel}>Variants Generated</span>
          <span className={styles.metricValue}>{metrics.variantsGenerated}</span>
        </div>
        {metrics.techniques.length > 0 && (
          <div className={styles.metric}>
            <span className={styles.metricLabel}>Techniques Used</span>
            <span className={styles.metricValue}>{metrics.techniques.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Service Timeline */}
      <div className={styles.serviceTimeline}>
        <h4>Service Call Timeline</h4>
        {Object.entries(serviceGroups).map(([service, serviceEvents]) => (
          <div key={service} className={styles.serviceGroup}>
            <h5 className={styles.serviceName}>{service}</h5>
            {serviceEvents.map((event, index) => (
              <div key={index} className={styles.serviceEvent}>
                <div className={styles.eventHeader}>
                  <span className={styles.eventType}>
                    {event.type === 'service_request' ? '📤' : '📥'} {event.method}
                  </span>
                  {event.responseTime && (
                    <span className={styles.responseTime}>{event.responseTime}ms</span>
                  )}
                </div>
                
                {(event.requestData || event.responseData) && (
                  <details className={styles.eventDetails}>
                    <summary>View Details</summary>
                    <div className={styles.eventData}>
                      {event.requestData && (
                        <div className={styles.dataSection}>
                          <h6>Request:</h6>
                          <pre>{JSON.stringify(event.requestData, null, 2)}</pre>
                        </div>
                      )}
                      {event.responseData && (
                        <div className={styles.dataSection}>
                          <h6>Response:</h6>
                          <pre>{JSON.stringify(event.responseData, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  </details>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Optimization Details */}
      {events.some(e => e.type === 'variant_generated') && (
        <div className={styles.optimizationDetails}>
          <h4>Optimization Details</h4>
          {events
            .filter(e => e.type === 'variant_generated')
            .map((variant, index) => (
              <div key={index} className={styles.variantInfo}>
                <span className={styles.variantLabel}>Variant {index + 1}</span>
                <span className={styles.variantQuality}>
                  Quality Score: {variant.quality}/100
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}