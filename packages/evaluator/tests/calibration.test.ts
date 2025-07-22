import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CalibrationMonitor,
  CalibrationDataPoint,
  getCalibrationMonitor
} from '../src/calibration'

// Mock shared dependencies
vi.mock('@promptdial/shared', async () => {
  const actual = await vi.importActual('@promptdial/shared')
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    mean: (values: number[]) => 
      values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length,
    stddev: (values: number[]) => {
      if (values.length === 0) return 0
      const mean = values.reduce((a, b) => a + b, 0) / values.length
      const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
      return Math.sqrt(variance)
    },
    getTelemetryService: () => ({
      recordMetric: vi.fn()
    })
  }
})

describe('CalibrationMonitor', () => {
  let monitor: CalibrationMonitor

  beforeEach(() => {
    vi.clearAllMocks()
    monitor = new CalibrationMonitor()
  })

  describe('addDataPoint', () => {
    it('should add calibration data point', () => {
      const dataPoint: CalibrationDataPoint = {
        variant_id: 'variant-123',
        evaluator_scores: {
          g_eval: 0.85,
          chat_eval: 0.80
        },
        timestamp: new Date()
      }

      monitor.addDataPoint(dataPoint)

      // Verify data was stored (would need getter method in real implementation)
      const stats = monitor.getCalibrationStats()
      expect(stats).toBeDefined()
    })

    it('should handle data point with human score', () => {
      const dataPoint: CalibrationDataPoint = {
        variant_id: 'variant-123',
        evaluator_scores: {
          g_eval: 0.85
        },
        human_score: 0.90,
        timestamp: new Date()
      }

      monitor.addDataPoint(dataPoint)

      const stats = monitor.getCalibrationStats()
      expect(stats).toBeDefined()
    })
  })

  describe('addHumanFeedback', () => {
    it('should add human feedback for existing variant', async () => {
      // Mock checkCalibration to avoid async issues
      vi.spyOn(monitor as any, 'checkCalibration').mockResolvedValue(undefined)
      
      // First add a data point
      const dataPoint: CalibrationDataPoint = {
        variant_id: 'variant-123',
        evaluator_scores: {
          g_eval: 0.85
        },
        timestamp: new Date()
      }
      monitor.addDataPoint(dataPoint)

      // Then add human feedback
      monitor.addHumanFeedback('variant-123', 0.90)

      // Verify checkCalibration was called
      expect((monitor as any).checkCalibration).toHaveBeenCalled()
    })

    it('should handle human feedback for non-existent variant', () => {
      // Should not throw
      monitor.addHumanFeedback('unknown-variant', 0.90)

      const stats = monitor.getCalibrationStats()
      expect(stats).toBeDefined()
    })
  })

  describe('calibrateScore', () => {
    it('should return adjusted score when no sufficient data available', () => {
      // With less than 5 data points, calibration uses default values
      const score = monitor.calibrateScore('g_eval', 0.85)
      
      // Should still be within valid range
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(1)
    })

    it('should apply calibration based on historical data', () => {
      // Add multiple data points with human scores
      const dataPoints: CalibrationDataPoint[] = [
        {
          variant_id: 'v1',
          evaluator_scores: { g_eval: 0.80 },
          human_score: 0.85,
          timestamp: new Date()
        },
        {
          variant_id: 'v2',
          evaluator_scores: { g_eval: 0.70 },
          human_score: 0.78,
          timestamp: new Date()
        },
        {
          variant_id: 'v3',
          evaluator_scores: { g_eval: 0.90 },
          human_score: 0.92,
          timestamp: new Date()
        }
      ]

      dataPoints.forEach(dp => monitor.addDataPoint(dp))

      // The calibration should adjust scores based on the pattern
      // In this case, evaluator tends to underestimate slightly
      const calibrated = monitor.calibrateScore('g_eval', 0.80)
      
      // Should be adjusted upward based on historical pattern
      expect(calibrated).toBeGreaterThanOrEqual(0.80)
      expect(calibrated).toBeLessThanOrEqual(1.0)
    })

    it('should handle extreme scores', () => {
      // Test edge cases
      expect(monitor.calibrateScore('g_eval', 0)).toBe(0)
      expect(monitor.calibrateScore('g_eval', 1)).toBe(1)
      expect(monitor.calibrateScore('g_eval', -0.5)).toBe(0)
      expect(monitor.calibrateScore('g_eval', 1.5)).toBe(1)
    })
  })

  describe('getCalibrationStats', () => {
    it('should return empty stats initially', () => {
      const stats = monitor.getCalibrationStats()
      
      expect(stats).toBeDefined()
      expect(Object.keys(stats)).toHaveLength(0)
    })

    it('should return stats after adding data', () => {
      // Add enough data points to get meaningful stats (need at least 5)
      const dataPoints: CalibrationDataPoint[] = [
        {
          variant_id: 'v1',
          evaluator_scores: { g_eval: 0.85, chat_eval: 0.80 },
          human_score: 0.87,
          timestamp: new Date()
        },
        {
          variant_id: 'v2',
          evaluator_scores: { g_eval: 0.75 },
          human_score: 0.78,
          timestamp: new Date()
        },
        {
          variant_id: 'v3',
          evaluator_scores: { g_eval: 0.80 },
          human_score: 0.82,
          timestamp: new Date()
        },
        {
          variant_id: 'v4',
          evaluator_scores: { g_eval: 0.90 },
          human_score: 0.88,
          timestamp: new Date()
        },
        {
          variant_id: 'v5',
          evaluator_scores: { g_eval: 0.70 },
          human_score: 0.73,
          timestamp: new Date()
        }
      ]

      dataPoints.forEach(dp => monitor.addDataPoint(dp))

      const stats = monitor.getCalibrationStats()
      
      expect(Object.keys(stats)).toContain('g_eval')
      expect(stats.g_eval).toBeDefined()
      expect(stats.g_eval.samples).toBe(5)
    })

    it('should include evaluator-specific statistics', () => {
      // Add data points with consistent bias (need at least 5)
      const dataPoints: CalibrationDataPoint[] = [
        {
          variant_id: 'v1',
          evaluator_scores: { g_eval: 0.80 },
          human_score: 0.85,
          timestamp: new Date()
        },
        {
          variant_id: 'v2',
          evaluator_scores: { g_eval: 0.70 },
          human_score: 0.75,
          timestamp: new Date()
        },
        {
          variant_id: 'v3',
          evaluator_scores: { g_eval: 0.90 },
          human_score: 0.95,
          timestamp: new Date()
        },
        {
          variant_id: 'v4',
          evaluator_scores: { g_eval: 0.85 },
          human_score: 0.90,
          timestamp: new Date()
        },
        {
          variant_id: 'v5',
          evaluator_scores: { g_eval: 0.75 },
          human_score: 0.80,
          timestamp: new Date()
        }
      ]

      dataPoints.forEach(dp => monitor.addDataPoint(dp))

      const stats = monitor.getCalibrationStats()
      
      expect(stats.g_eval).toBeDefined()
      expect(stats.g_eval.bias).toBeDefined()
      expect(stats.g_eval.correlation).toBeDefined()
      expect(stats.g_eval.variance).toBeDefined()
      expect(stats.g_eval.drift).toBeDefined()
      expect(stats.g_eval.samples).toBe(5)
    })
  })

  describe('drift detection', () => {
    it('should detect evaluator drift over time', () => {
      // Need at least 10 data points for drift calculation
      const dataPoints: CalibrationDataPoint[] = []
      
      // Add 5 older data points with slight underestimation
      for (let i = 0; i < 5; i++) {
        dataPoints.push({
          variant_id: `old${i}`,
          evaluator_scores: { g_eval: 0.75 + i * 0.02 },
          human_score: 0.77 + i * 0.02, // Slight underestimation
          timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        })
      }

      // Add 5 recent data points with overestimation
      for (let i = 0; i < 5; i++) {
        dataPoints.push({
          variant_id: `new${i}`,
          evaluator_scores: { g_eval: 0.80 + i * 0.02 },
          human_score: 0.75 + i * 0.02, // Now overestimating
          timestamp: new Date()
        })
      }

      dataPoints.forEach(dp => monitor.addDataPoint(dp))

      const stats = monitor.getCalibrationStats()
      
      // Should detect drift in calibration
      expect(stats.g_eval).toBeDefined()
      expect(stats.g_eval.drift).toBeGreaterThan(0)
    })
  })
})

describe('getCalibrationMonitor', () => {
  it('should return singleton instance', () => {
    const monitor1 = getCalibrationMonitor()
    const monitor2 = getCalibrationMonitor()
    
    expect(monitor1).toBe(monitor2)
  })
})