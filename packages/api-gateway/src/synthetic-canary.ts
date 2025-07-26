/**
 * PromptDial 3.0 - Synthetic Canary Tests
 * 
 * Runs automated tests every 60 seconds to ensure system health
 */

import axios, { AxiosError } from 'axios'
import { createLogger, getTelemetryService } from '@promptdial/shared'
import { FlowGuard } from './flow-guard'

const logger = createLogger('synthetic-canary')

interface CanaryResult {
  testId: string
  timestamp: string
  success: boolean
  errors: string[]
  duration_ms: number
  receipt?: any
}

export class SyntheticCanary {
  private apiUrl: string
  private interval: NodeJS.Timeout | null = null
  private isRunning: boolean = false

  constructor(apiUrl: string = 'http://localhost:3000') {
    this.apiUrl = apiUrl
  }

  /**
   * Start the canary tests
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Canary tests already running')
      return
    }

    this.isRunning = true
    logger.info('Starting synthetic canary tests', { interval: '60s' })

    // Run immediately
    this.runCanaryTest()

    // Then run every 60 seconds
    this.interval = setInterval(() => {
      this.runCanaryTest()
    }, 60000)
  }

  /**
   * Stop the canary tests
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.isRunning = false
    logger.info('Stopped synthetic canary tests')
  }

  /**
   * Run a single canary test
   */
  private async runCanaryTest(): Promise<void> {
    const testId = `canary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const startTime = Date.now()
    const telemetry = getTelemetryService()

    try {
      logger.info('Running canary test', { testId })

      // Test 1: Basic optimization with expected techniques
      const result = await this.testOptimization(testId)

      if (!result.success) {
        logger.error('Canary test failed', undefined, { 
          testId, 
          errors: result.errors 
        })
        telemetry.recordCounter('canary_test_failed', 1)
        
        // Alert immediately
        this.alertOnFailure(testId, result.errors)
      } else {
        logger.info('Canary test passed', { 
          testId, 
          duration_ms: result.duration_ms 
        })
        telemetry.recordCounter('canary_test_success', 1)
        telemetry.recordLatency('canary_test_duration', result.duration_ms)
      }

    } catch (error) {
      const duration = Date.now() - startTime
      logger.error('Canary test error', error as Error, { testId })
      telemetry.recordCounter('canary_test_error', 1)
      
      this.alertOnFailure(testId, [(error as Error).message])
    }
  }

  /**
   * Test the optimization endpoint
   */
  private async testOptimization(testId: string): Promise<CanaryResult> {
    const startTime = Date.now()
    const errors: string[] = []

    try {
      // Canary prompt with predictable optimization requirements
      const canaryPrompt = `CANARY_TEST_${testId}: Explain the concept of recursion in programming with examples`

      const response = await axios.post(
        `${this.apiUrl}/api/optimize`,
        {
          prompt: canaryPrompt,
          options: {
            task_type: 'code_generation',
            max_variants: 3,
            security_level: 'standard'
          }
        },
        {
          headers: {
            'X-Trace-ID': testId,
            'X-Canary-Test': 'true'
          },
          timeout: 30000
        }
      )

      const data = response.data

      // Validate response structure
      if (!data.success) {
        errors.push('Response indicates failure')
      }

      if (!data.result) {
        errors.push('Missing result object')
      } else {
        // Check flow version (via receipt)
        if (!data.promptDial_receipt) {
          errors.push('Missing promptDial_receipt')
        } else {
          const receipt = data.promptDial_receipt
          
          // Validate flow version
          if (receipt.flow_version !== '3.0.0') {
            errors.push(`Invalid flow version: ${receipt.flow_version}`)
          }

          // Verify receipt signature
          if (!FlowGuard.verifyReceipt(receipt, testId)) {
            errors.push('Invalid receipt signature')
          }

          // Check timestamps are recent
          const receiptTime = new Date(receipt.timestamp).getTime()
          const timeDiff = Date.now() - receiptTime
          if (timeDiff > 60000) { // More than 1 minute old
            errors.push(`Receipt timestamp too old: ${timeDiff}ms`)
          }
        }

        // Validate techniques
        const techniques = data.result.optimization_metadata?.techniques_used || []
        if (!Array.isArray(techniques) || techniques.length === 0) {
          errors.push('No techniques applied')
        } else if (!techniques.includes('chain_of_thought')) {
          errors.push('Expected chain_of_thought technique not found')
        }

        // Validate variants
        const variants = data.result.variants || []
        if (!Array.isArray(variants) || variants.length === 0) {
          errors.push('No variants generated')
        } else if (variants.length < 2) {
          errors.push(`Insufficient variants: ${variants.length}`)
        }

        // Check recommended variant
        if (!data.result.recommended_variant) {
          errors.push('No recommended variant')
        }
      }

      const duration = Date.now() - startTime

      return {
        testId,
        timestamp: new Date().toISOString(),
        success: errors.length === 0,
        errors,
        duration_ms: duration,
        receipt: data.promptDial_receipt
      }

    } catch (error) {
      const duration = Date.now() - startTime
      const axiosError = error as AxiosError

      if (axiosError.response) {
        errors.push(`HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`)
        
        // Check if it's a flow mismatch error
        const responseData = axiosError.response.data as any
        if (responseData?.error === 'FLOW_MISMATCH') {
          errors.push('CRITICAL: Flow mismatch detected')
          errors.push(...(responseData.details || []))
        }
      } else if (axiosError.request) {
        errors.push('No response received from API')
      } else {
        errors.push(`Request error: ${axiosError.message}`)
      }

      return {
        testId,
        timestamp: new Date().toISOString(),
        success: false,
        errors,
        duration_ms: duration
      }
    }
  }

  /**
   * Alert on test failure
   */
  private alertOnFailure(testId: string, errors: string[]): void {
    const telemetry = getTelemetryService()
    
    // Log critical alert
    logger.error('CANARY ALERT: Test failed', undefined, {
      testId,
      errors,
      severity: 'critical'
    })

    // Record alert metric
    telemetry.recordCounter('canary_alerts_triggered', 1)

    // In production, this would trigger PagerDuty or similar
    // For now, we'll just log prominently
    console.error('🚨 CANARY FAILURE DETECTED 🚨')
    console.error(`Test ID: ${testId}`)
    console.error(`Errors: ${errors.join(', ')}`)
    console.error('System may be in degraded state!')
  }

  /**
   * Get canary status
   */
  getStatus(): { running: boolean; lastTest?: CanaryResult } {
    return {
      running: this.isRunning
    }
  }
}

// Export singleton instance
export const canary = new SyntheticCanary()

// Auto-start if running as main module
if (require.main === module) {
  const apiUrl = process.env.API_GATEWAY_URL || 'http://localhost:3000'
  const canaryInstance = new SyntheticCanary(apiUrl)
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    logger.info('Shutting down canary tests...')
    canaryInstance.stop()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    logger.info('Shutting down canary tests...')
    canaryInstance.stop()
    process.exit(0)
  })

  // Start canary tests
  canaryInstance.start()
  logger.info(`Synthetic canary started, testing ${apiUrl}`)
}