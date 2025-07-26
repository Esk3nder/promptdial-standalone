/**
 * PromptDial 3.0 - Evaluator Calibration
 *
 * Monitors and corrects evaluator drift
 */

import { EvaluatorDrift, createLogger, getTelemetryService, mean, stddev } from '@promptdial/shared'

const logger = createLogger('calibration')

export interface CalibrationDataPoint {
  variant_id: string
  evaluator_scores: Record<string, number>
  human_score?: number
  timestamp: Date
}

export interface CalibrationStats {
  evaluator: string
  correlation: number
  bias: number
  variance: number
  drift: number
  samples: number
}

export class CalibrationMonitor {
  private dataPoints: CalibrationDataPoint[] = []
  private maxDataPoints = 1000
  private driftThreshold = 0.05

  /**
   * Add a new calibration data point
   */
  addDataPoint(point: CalibrationDataPoint): void {
    this.dataPoints.push(point)

    // Keep only recent data points
    if (this.dataPoints.length > this.maxDataPoints) {
      this.dataPoints = this.dataPoints.slice(-this.maxDataPoints)
    }
  }

  /**
   * Add human feedback for calibration
   */
  addHumanFeedback(variantId: string, humanScore: number): void {
    const point = this.dataPoints.find((p) => p.variant_id === variantId)
    if (point) {
      point.human_score = humanScore
      this.checkCalibration()
    }
  }

  /**
   * Get calibration statistics for each evaluator
   */
  getCalibrationStats(): Record<string, CalibrationStats> {
    const stats: Record<string, CalibrationStats> = {}

    // Get all evaluator names
    const evaluatorNames = new Set<string>()
    for (const point of this.dataPoints) {
      Object.keys(point.evaluator_scores).forEach((name) => evaluatorNames.add(name))
    }

    // Calculate stats for each evaluator
    for (const evaluator of evaluatorNames) {
      stats[evaluator] = this.calculateEvaluatorStats(evaluator)
    }

    return stats
  }

  /**
   * Check for calibration drift and alert if needed
   */
  async checkCalibration(): Promise<void> {
    const stats = this.getCalibrationStats()

    for (const [evaluator, stat] of Object.entries(stats)) {
      if (stat.drift > this.driftThreshold) {
        await this.alertDrift(evaluator, stat)
      }
    }
  }

  /**
   * Get calibration adjustments for an evaluator
   */
  getCalibrationAdjustment(evaluator: string): {
    scale: number
    offset: number
  } {
    const stats = this.calculateEvaluatorStats(evaluator)

    // Simple linear calibration
    // adjusted_score = scale * raw_score + offset
    const scale = stats.variance > 0 ? 1 / Math.sqrt(stats.variance) : 1
    const offset = -stats.bias * scale

    return { scale, offset }
  }

  /**
   * Apply calibration to a raw score
   */
  calibrateScore(evaluator: string, rawScore: number): number {
    const { scale, offset } = this.getCalibrationAdjustment(evaluator)
    const calibrated = scale * rawScore + offset

    // Ensure score stays in valid range
    return Math.max(0, Math.min(1, calibrated))
  }

  private calculateEvaluatorStats(evaluator: string): CalibrationStats {
    // Get data points with human scores
    const calibrationData = this.dataPoints.filter(
      (p) => p.human_score !== undefined && evaluator in p.evaluator_scores,
    )

    if (calibrationData.length < 5) {
      return {
        evaluator,
        correlation: 0,
        bias: 0,
        variance: 1,
        drift: 0,
        samples: calibrationData.length,
      }
    }

    const evaluatorScores = calibrationData.map((p) => p.evaluator_scores[evaluator])
    const humanScores = calibrationData.map((p) => p.human_score!)

    // Calculate correlation
    const correlation = this.calculateCorrelation(evaluatorScores, humanScores)

    // Calculate bias (mean difference)
    const differences = evaluatorScores.map((e, i) => e - humanScores[i])
    const bias = mean(differences)

    // Calculate variance
    const variance = stddev(evaluatorScores)

    // Calculate drift (change over time)
    const drift = this.calculateDrift(calibrationData, evaluator)

    return {
      evaluator,
      correlation,
      bias,
      variance,
      drift,
      samples: calibrationData.length,
    }
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0

    const n = x.length
    const meanX = mean(x)
    const meanY = mean(y)

    let numerator = 0
    let denomX = 0
    let denomY = 0

    for (let i = 0; i < n; i++) {
      const diffX = x[i] - meanX
      const diffY = y[i] - meanY
      numerator += diffX * diffY
      denomX += diffX * diffX
      denomY += diffY * diffY
    }

    const denominator = Math.sqrt(denomX * denomY)
    return denominator === 0 ? 0 : numerator / denominator
  }

  private calculateDrift(data: CalibrationDataPoint[], evaluator: string): number {
    if (data.length < 10) return 0

    // Split data into old and new halves
    const midpoint = Math.floor(data.length / 2)
    const oldData = data.slice(0, midpoint)
    const newData = data.slice(midpoint)

    // Calculate mean difference for each half
    const oldDiffs = oldData.map((p) => p.evaluator_scores[evaluator] - p.human_score!)
    const newDiffs = newData.map((p) => p.evaluator_scores[evaluator] - p.human_score!)

    const oldMean = mean(oldDiffs)
    const newMean = mean(newDiffs)

    // Drift is the change in bias
    return Math.abs(newMean - oldMean)
  }

  private async alertDrift(evaluator: string, stats: CalibrationStats): Promise<void> {
    logger.warn(`Calibration drift detected for ${evaluator}`, {
      drift: stats.drift,
      bias: stats.bias,
      samples: stats.samples,
    })

    // Log to telemetry
    const telemetry = getTelemetryService()
    telemetry.recordMetric('evaluator_drift', stats.drift, {
      evaluator,
      bias: stats.bias.toString(),
      correlation: stats.correlation.toString(),
    })

    // Create drift event
    const driftEvent: EvaluatorDrift = {
      timestamp: new Date(),
      variant_id: 'calibration-check',
      expected_score: 0.5, // Neutral baseline
      actual_score: 0.5 + stats.bias,
      drift_amount: stats.drift,
    }

    // In production, this would trigger alerts
    logger.error(
      `ALERT: ${evaluator} drift ${stats.drift} exceeds threshold ${this.driftThreshold}`,
    )
  }
}

// Global calibration monitor instance
let calibrationMonitor: CalibrationMonitor | null = null

export function getCalibrationMonitor(): CalibrationMonitor {
  if (!calibrationMonitor) {
    calibrationMonitor = new CalibrationMonitor()
  }
  return calibrationMonitor
}
