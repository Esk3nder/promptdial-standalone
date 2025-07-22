import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getTelemetryService } from '../src/utils'

describe('Telemetry Service', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  describe('getTelemetryService', () => {
    it('should return singleton instance', () => {
      const service1 = getTelemetryService()
      const service2 = getTelemetryService()
      expect(service1).toBe(service2)
    })

    it('should track events', () => {
      const service = getTelemetryService()
      const event = {
        trace_id: 'trace-123',
        variant_id: 'variant-456',
        ts_utc: new Date().toISOString(),
        event_type: 'optimization_started' as const,
        task_type: 'general_qa' as const
      }
      
      service.trackEvent(event)
      expect(console.log).toHaveBeenCalledWith('[Telemetry] Event:', event)
    })

    it('should track metrics', () => {
      const service = getTelemetryService()
      service.trackMetric('latency', 1500, { service: 'api-gateway' })
      
      expect(console.log).toHaveBeenCalledWith('[Telemetry] Metric:', {
        name: 'latency',
        value: 1500,
        tags: { service: 'api-gateway' }
      })
    })

    it('should track errors', () => {
      const service = getTelemetryService()
      const error = new Error('Test error')
      const context = { request_id: '123' }
      
      service.trackError(error, context)
      expect(console.error).toHaveBeenCalledWith('[Telemetry] Error:', error, context)
    })

    it('should handle flush', async () => {
      const service = getTelemetryService()
      await expect(service.flush()).resolves.toBeUndefined()
    })
  })
})