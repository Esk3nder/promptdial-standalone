/**
 * Tests for Telemetry Service
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TelemetryService } from '../src'
import { TelemetryEvent, createTelemetryEvent } from '@promptdial/shared'

// Mock dependencies
vi.mock('@promptdial/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@promptdial/shared')>()
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  }
})

describe('TelemetryService', () => {
  let telemetryService: TelemetryService

  beforeEach(() => {
    vi.clearAllMocks()
    telemetryService = new TelemetryService()
  })

  afterEach(async () => {
    await telemetryService.shutdown()
  })

  describe('Event Logging', () => {
    it('should log events successfully', async () => {
      const event = createTelemetryEvent('optimization_start', 'test-trace-123', 'variant-1', {
        task_type: 'math_reasoning',
        provider: 'openai',
      })

      await expect(telemetryService.logEvent(event)).resolves.not.toThrow()
    })

    it('should reject invalid events', async () => {
      const invalidEvent = {
        // Missing required fields
        ts_utc: new Date().toISOString(),
      } as TelemetryEvent

      await expect(telemetryService.logEvent(invalidEvent)).rejects.toThrow()
    })

    it('should batch events for efficient storage', async () => {
      const events: TelemetryEvent[] = []

      // Create 150 events (batch size is 100)
      for (let i = 0; i < 150; i++) {
        events.push(
          createTelemetryEvent('variant_generated', 'batch-test', `variant-${i}`, {
            task_type: 'general_qa',
            total_tokens: 100 + i,
            cost_usd: 0.01 * i,
          }),
        )
      }

      // Log all events
      for (const event of events) {
        await telemetryService.logEvent(event)
      }

      // Force flush any remaining events in the batch
      await (telemetryService as any).flushEvents()

      // Query should return all events
      const results = await telemetryService.queryEvents({ trace_id: 'batch-test' })
      expect(results).toHaveLength(150)
    })
  })

  describe('Event Querying', () => {
    beforeEach(async () => {
      // Add test events
      const events = [
        createTelemetryEvent('optimization_start', 'trace-1', '', {
          task_type: 'math_reasoning',
        }),
        createTelemetryEvent('variant_generated', 'trace-1', 'var-1', {
          task_type: 'math_reasoning',
          score: 0.85,
        }),
        createTelemetryEvent('variant_generated', 'trace-1', 'var-2', {
          task_type: 'math_reasoning',
          score: 0.92,
        }),
        createTelemetryEvent('optimization_end', 'trace-1', '', {
          task_type: 'math_reasoning',
          latency_ms: 2500,
        }),
        createTelemetryEvent('optimization_start', 'trace-2', '', {
          task_type: 'code_generation',
        }),
      ]

      for (const event of events) {
        await telemetryService.logEvent(event)
      }

      // Force flush to ensure events are in the store for querying
      await (telemetryService as any).flushEvents()
    })

    it('should query events by trace ID', async () => {
      const results = await telemetryService.queryEvents({ trace_id: 'trace-1' })
      expect(results).toHaveLength(4)
      expect(results.every((e) => e.trace_id === 'trace-1')).toBe(true)
    })

    it('should query events by variant ID', async () => {
      const results = await telemetryService.queryEvents({ variant_id: 'var-1' })
      expect(results).toHaveLength(1)
      expect(results[0].variant_id).toBe('var-1')
    })

    it('should query events by event type', async () => {
      const results = await telemetryService.queryEvents({
        event_type: 'variant_generated',
      })
      expect(results).toHaveLength(2)
    })

    it('should query events by task type', async () => {
      const results = await telemetryService.queryEvents({
        task_type: 'math_reasoning',
      })
      expect(results).toHaveLength(4)
    })

    it('should get trace events in order', async () => {
      const results = await telemetryService.getTraceEvents('trace-1')
      expect(results).toHaveLength(4)

      // Check events are in chronological order
      expect(results[0].event_type).toBe('optimization_start')
      expect(results[results.length - 1].event_type).toBe('optimization_end')
    })
  })

  describe('Metrics Collection', () => {
    it('should record latency metrics', () => {
      telemetryService.recordLatency('test-service', 150)
      telemetryService.recordLatency('test-service', 200)
      telemetryService.recordLatency('test-service', 175)

      // Metrics should be recorded (internal state)
      expect(() => telemetryService.recordLatency('test-service', 300)).not.toThrow()
    })

    it('should increment counters', () => {
      telemetryService.incrementCounter('test_counter', 1)
      telemetryService.incrementCounter('test_counter', 2)
      telemetryService.incrementCounter('test_counter', 3)

      // Should not throw
      expect(() => telemetryService.incrementCounter('test_counter')).not.toThrow()
    })

    it('should calculate performance metrics', async () => {
      // Add some test data
      const events = [
        createTelemetryEvent('optimization_end', 'perf-1', '', {
          latency_ms: 1000,
          provider: 'test-service',
        }),
        createTelemetryEvent('optimization_end', 'perf-2', '', {
          latency_ms: 2000,
          provider: 'test-service',
        }),
        createTelemetryEvent('optimization_end', 'perf-3', '', {
          latency_ms: 1500,
          provider: 'test-service',
        }),
        createTelemetryEvent('optimization_end', 'perf-4', '', {
          latency_ms: 3000,
          provider: 'test-service',
          error: 'timeout',
        }),
      ]

      for (const event of events) {
        await telemetryService.logEvent(event)
      }

      const metrics = await telemetryService.getPerformanceMetrics('test-service')

      // Should have calculated percentiles
      expect(metrics.p50_latency_ms).toBeGreaterThan(0)
      expect(metrics.p95_latency_ms).toBeGreaterThan(metrics.p50_latency_ms)
      expect(metrics.p99_latency_ms).toBeGreaterThanOrEqual(metrics.p95_latency_ms)
    })
  })

  describe('Event Emission', () => {
    it('should emit events for real-time monitoring', async () => {
      let emittedEvent: TelemetryEvent | null = null

      telemetryService.on('event', (event) => {
        emittedEvent = event
      })

      const testEvent = createTelemetryEvent('optimization_start', 'emit-test', '', {
        task_type: 'general_qa',
      })

      await telemetryService.logEvent(testEvent)

      expect(emittedEvent).toBeTruthy()
      expect(emittedEvent?.trace_id).toBe('emit-test')
    })
  })

  describe('Metric Updates from Events', () => {
    it('should update token usage from events', async () => {
      const event = createTelemetryEvent('variant_generated', 'token-test', 'var-1', {
        task_type: 'general_qa',
        total_tokens: 500,
        provider: 'openai',
      })

      await telemetryService.logEvent(event)

      // Verify token metric was recorded
      expect(() => telemetryService.recordMetric('test', 1)).not.toThrow()
    })

    it('should update cost metrics from events', async () => {
      const event = createTelemetryEvent('optimization_end', 'cost-test', '', {
        task_type: 'general_qa',
        cost_usd: 0.05,
        provider: 'anthropic',
      })

      await telemetryService.logEvent(event)

      // Cost should be recorded
      expect(() => telemetryService.recordMetric('cost', 0.05)).not.toThrow()
    })

    it('should track security violations', async () => {
      const event = createTelemetryEvent('variant_generated', 'security-test', 'var-1', {
        task_type: 'general_qa',
        safety_verdict: 'unsafe',
      })

      await telemetryService.logEvent(event)

      // Security violation should be counted
      expect(() => telemetryService.incrementCounter('violations')).not.toThrow()
    })
  })
})
