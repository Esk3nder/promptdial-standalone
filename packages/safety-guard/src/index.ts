/**
 * PromptDial 2.0 - SafetyGuard Service
 *
 * Protects against prompt injection, jailbreaks, and harmful content
 */

import {
  PromptVariant,
  TaskClassification,
  ServiceRequest,
  ServiceResponse,
  createServiceResponse,
  createServiceError,
  createLogger,
  ERROR_CODES,
  getTelemetryService,
} from '@promptdial/shared'

import { PromptSanitizer, SanitizationResult, ViolationDetail } from './sanitizer'

import { PatternCategory, PATTERN_CATEGORIES } from './patterns'

const logger = createLogger('safety-guard')

// ============= SafetyGuard Service =============

export interface SafetyCheckResult {
  safe: boolean
  sanitized_prompt?: string
  violations: ViolationDetail[]
  risk_score: number
  blocked_reason?: string
}

export class SafetyGuard {
  private sanitizer: PromptSanitizer
  private blockThreshold: number
  private enabledCategories: Set<PatternCategory>
  private auditLog: AuditEntry[] = []
  private maxAuditEntries = 10000

  constructor(config?: {
    blockThreshold?: number
    enabledCategories?: PatternCategory[]
    customPatterns?: any[]
  }) {
    this.blockThreshold = config?.blockThreshold || 0.7
    this.enabledCategories = new Set(
      config?.enabledCategories || (Object.keys(PATTERN_CATEGORIES) as PatternCategory[]),
    )

    this.sanitizer = new PromptSanitizer({
      enabledCategories: Array.from(this.enabledCategories),
      patterns: config?.customPatterns,
    })
  }

  /**
   * Check prompt safety and sanitize if needed
   */
  async checkSafety(
    prompt: string,
    context?: {
      task_meta?: TaskClassification
      user_id?: string
      session_id?: string
      trace_id?: string
    },
  ): Promise<SafetyCheckResult> {
    const startTime = Date.now()

    // Sanitize the prompt
    const result = this.sanitizer.sanitize(prompt)

    // Determine if should block
    const shouldBlock =
      this.sanitizer.shouldBlock(result) || result.risk_score >= this.blockThreshold

    // Create audit entry
    const auditEntry: AuditEntry = {
      timestamp: new Date(),
      user_id: context?.user_id,
      session_id: context?.session_id,
      trace_id: context?.trace_id,
      original_prompt: prompt,
      sanitized_prompt: result.sanitized,
      violations: result.violations,
      risk_score: result.risk_score,
      blocked: shouldBlock,
      duration_ms: Date.now() - startTime,
    }

    this.addAuditEntry(auditEntry)

    // Log telemetry
    await this.logTelemetry(auditEntry)

    // Return result
    if (shouldBlock) {
      return {
        safe: false,
        violations: result.violations,
        risk_score: result.risk_score,
        blocked_reason: this.sanitizer.getBlockMessage(result.violations),
      }
    }

    return {
      safe: true,
      sanitized_prompt: result.sanitized,
      violations: result.violations,
      risk_score: result.risk_score,
    }
  }

  /**
   * Check variant safety before LLM execution
   */
  async checkVariant(
    variant: PromptVariant,
    context?: {
      task_meta?: TaskClassification
      trace_id?: string
    },
  ): Promise<{ safe: boolean; sanitized?: PromptVariant; reason?: string }> {
    const result = await this.checkSafety(variant.prompt, context)

    if (!result.safe) {
      return {
        safe: false,
        reason: result.blocked_reason,
      }
    }

    // Return sanitized variant if prompt was modified
    if (result.sanitized_prompt && result.sanitized_prompt !== variant.prompt) {
      return {
        safe: true,
        sanitized: {
          ...variant,
          prompt: result.sanitized_prompt,
        },
      }
    }

    return { safe: true }
  }

  /**
   * Rewrite prompt for enhanced safety
   */
  rewriteForSafety(
    prompt: string,
    context?: {
      task_type?: string
      previous_violations?: ViolationDetail[]
    },
  ): string {
    return this.sanitizer.rewriteForSafety(prompt, context)
  }

  /**
   * Get security statistics
   */
  getSecurityStats(timeRange?: { start: Date; end: Date }): SecurityStats {
    let entries = this.auditLog

    if (timeRange) {
      entries = entries.filter(
        (e) => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end,
      )
    }

    const totalChecks = entries.length
    const blockedCount = entries.filter((e) => e.blocked).length
    const modifiedCount = entries.filter((e) => e.sanitized_prompt !== e.original_prompt).length

    // Count violations by category
    const violationsByCategory: Record<string, number> = {}
    const violationsBySeverity: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    }

    for (const entry of entries) {
      for (const violation of entry.violations) {
        violationsByCategory[violation.category] =
          (violationsByCategory[violation.category] || 0) + 1

        violationsBySeverity[violation.severity] =
          (violationsBySeverity[violation.severity] || 0) + 1
      }
    }

    // Calculate average risk score
    const avgRiskScore =
      entries.length > 0 ? entries.reduce((sum, e) => sum + e.risk_score, 0) / entries.length : 0

    return {
      total_checks: totalChecks,
      blocked_count: blockedCount,
      modified_count: modifiedCount,
      block_rate: totalChecks > 0 ? blockedCount / totalChecks : 0,
      avg_risk_score: avgRiskScore,
      violations_by_category: violationsByCategory,
      violations_by_severity: violationsBySeverity,
    }
  }

  /**
   * Get recent security incidents
   */
  getRecentIncidents(limit: number = 10): AuditEntry[] {
    return this.auditLog
      .filter((e) => e.blocked || e.risk_score > 0.5)
      .slice(-limit)
      .reverse()
  }

  private addAuditEntry(entry: AuditEntry): void {
    this.auditLog.push(entry)

    // Keep audit log size manageable
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog = this.auditLog.slice(-this.maxAuditEntries)
    }
  }

  private async logTelemetry(entry: AuditEntry): Promise<void> {
    const telemetry = getTelemetryService()

    // Record safety check
    telemetry.recordCounter('safety_checks_total', 1)

    if (entry.blocked) {
      telemetry.recordCounter('safety_blocks_total', 1)
    }

    if (entry.sanitized_prompt !== entry.original_prompt) {
      telemetry.recordCounter('safety_modifications_total', 1)
    }

    // Record risk score
    telemetry.recordMetric('safety_risk_score', entry.risk_score)

    // Record latency
    telemetry.recordLatency('safety_check', entry.duration_ms)

    // Log high-risk attempts
    if (entry.risk_score > 0.8 || entry.blocked) {
      logger.warn('High-risk prompt detected', {
        trace_id: entry.trace_id,
        risk_score: entry.risk_score,
        blocked: entry.blocked,
        violations: entry.violations.length,
      })
    }
  }
}

// ============= Audit Types =============

interface AuditEntry {
  timestamp: Date
  user_id?: string
  session_id?: string
  trace_id?: string
  original_prompt: string
  sanitized_prompt: string
  violations: ViolationDetail[]
  risk_score: number
  blocked: boolean
  duration_ms: number
}

interface SecurityStats {
  total_checks: number
  blocked_count: number
  modified_count: number
  block_rate: number
  avg_risk_score: number
  violations_by_category: Record<string, number>
  violations_by_severity: Record<string, number>
}

// ============= Service API =============

let guardInstance: SafetyGuard | null = null

export function getSafetyGuard(): SafetyGuard {
  if (!guardInstance) {
    guardInstance = new SafetyGuard()
  }
  return guardInstance
}

export async function handleCheckRequest(
  request: ServiceRequest<{
    prompt: string
    task_meta?: TaskClassification
    user_id?: string
    session_id?: string
    trace_id?: string
  }>,
): Promise<ServiceResponse<SafetyCheckResult>> {
  try {
    const { prompt, ...context } = request.payload

    const result = await getSafetyGuard().checkSafety(prompt, context)

    return createServiceResponse(request, result)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.SAFETY_CHECK_FAILED,
      'Safety check failed',
      true,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleCheckVariantRequest(
  request: ServiceRequest<{
    variant: PromptVariant
    task_meta?: TaskClassification
    trace_id?: string
  }>,
): Promise<ServiceResponse<{ safe: boolean; sanitized?: PromptVariant; reason?: string }>> {
  try {
    const { variant, ...context } = request.payload

    const result = await getSafetyGuard().checkVariant(variant, context)

    return createServiceResponse(request, result)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.SAFETY_CHECK_FAILED,
      'Variant safety check failed',
      true,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

export async function handleStatsRequest(
  request: ServiceRequest<{
    time_range?: { start: string; end: string }
  }>,
): Promise<ServiceResponse<SecurityStats>> {
  try {
    const timeRange = request.payload.time_range
      ? {
          start: new Date(request.payload.time_range.start),
          end: new Date(request.payload.time_range.end),
        }
      : undefined

    const stats = getSafetyGuard().getSecurityStats(timeRange)

    return createServiceResponse(request, stats)
  } catch (error) {
    const serviceError = createServiceError(
      ERROR_CODES.INTERNAL_ERROR,
      'Failed to get security stats',
      false,
    )
    return createServiceResponse(request, undefined, serviceError)
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3006

  app.use(express.json({ limit: '10mb' }))

  // Check prompt safety
  app.post('/check', async (req: any, res: any) => {
    const response = await handleCheckRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Check variant safety
  app.post('/check-variant', async (req: any, res: any) => {
    const response = await handleCheckVariantRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Get security stats
  app.post('/stats', async (req: any, res: any) => {
    const response = await handleStatsRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Get recent incidents
  app.get('/incidents', (_req: any, res: any) => {
    const incidents = getSafetyGuard().getRecentIncidents(20)
    res.json({ incidents })
  })

  app.get('/health', (_req: any, res: any) => {
    const stats = getSafetyGuard().getSecurityStats()
    res.json({
      status: 'healthy',
      service: 'safety-guard',
      stats: {
        total_checks: stats.total_checks,
        block_rate: stats.block_rate,
        avg_risk_score: stats.avg_risk_score,
      },
    })
  })

  app.listen(PORT, () => {
    logger.info(`SafetyGuard service running on port ${PORT}`)
  })
}
