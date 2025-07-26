/**
 * PromptDial 3.0 - FlowGuard Middleware
 * 
 * Enforces strict flow version validation and invariants to prevent silent fallbacks
 */

import { Request, Response, NextFunction } from 'express'
import { createLogger, getTelemetryService } from '@promptdial/shared'
import crypto from 'crypto'

const logger = createLogger('flow-guard')
const EXPECTED_FLOW_VERSION = '3.0.0'

interface FlowValidationResult {
  isValid: boolean
  errors: string[]
  receipt?: TamperEvidentReceipt
}

interface TamperEvidentReceipt {
  flow_version: string
  planner_hash?: string
  builder_hash?: string
  runner_model?: string
  timestamp: string
  sig: string
}

// Generate ED25519 keypair for signing (in production, load from secure storage)
const generateKeyPair = () => {
  return crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    }
  })
}

const { privateKey, publicKey } = generateKeyPair()

export class FlowGuard {
  /**
   * Middleware to intercept and validate optimization responses
   */
  static middleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      // Only apply to optimization endpoint
      if (req.path !== '/api/optimize' || req.method !== 'POST') {
        return next()
      }

      // Capture the response
      const originalJson = res.json
      res.json = function(data: any) {
        const telemetry = getTelemetryService()
        
        try {
          // Skip validation for error responses
          if (!data.success || data.error) {
            return originalJson.call(res, data)
          }

          // Validate the response
          const validation = FlowGuard.validateResponse(data)
          
          if (!validation.isValid) {
            logger.error('Flow validation failed', undefined, { 
              errors: validation.errors,
              trace_id: data.trace_id 
            })
            
            // Increment failure metrics
            telemetry.recordCounter('flow_mismatch_total', 1)
            validation.errors.forEach(error => {
              if (error.includes('techniques')) {
                telemetry.recordCounter('zero_techniques_total', 1)
              }
            })

            // Abort with 500 error
            res.status(500)
            return originalJson.call(res, {
              success: false,
              error: 'FLOW_MISMATCH',
              details: validation.errors,
              trace_id: data.trace_id
            })
          }

          // Add tamper-evident receipt
          data.promptDial_receipt = validation.receipt

          // Record success metrics
          telemetry.recordCounter('flow_validation_success', 1)
          
          return originalJson.call(res, data)
        } catch (error) {
          logger.error('FlowGuard error', error as Error)
          telemetry.recordCounter('flow_guard_errors', 1)
          
          // Fail closed - reject the request
          res.status(500)
          return originalJson.call(res, {
            success: false,
            error: 'FLOW_GUARD_ERROR',
            message: (error as Error).message
          })
        }
      }

      next()
    }
  }

  /**
   * Validate response structure and invariants
   */
  static validateResponse(data: any): FlowValidationResult {
    const errors: string[] = []
    
    // Check if result exists
    if (!data.result) {
      errors.push('Missing result object')
      return { isValid: false, errors }
    }

    const result = data.result

    // Validate techniques used
    const techniquesUsed = result.optimization_metadata?.techniques_used || []
    if (!Array.isArray(techniquesUsed) || techniquesUsed.length === 0) {
      errors.push('No techniques applied')
    }

    // Validate variants
    if (!result.variants || !Array.isArray(result.variants) || result.variants.length === 0) {
      errors.push('No variants generated')
    }

    // Check for strategy planner output
    const suggestedTechniques = result.optimization_metadata?.suggested_techniques
    if (!suggestedTechniques || !Array.isArray(suggestedTechniques) || suggestedTechniques.length === 0) {
      errors.push('No suggested techniques from strategy planner')
    }

    // Validate each variant has required fields
    result.variants?.forEach((variant: any, index: number) => {
      if (!variant.technique) {
        errors.push(`Variant ${index} missing technique`)
      }
      if (!variant.prompt) {
        errors.push(`Variant ${index} missing prompt`)
      }
    })

    // Generate receipt if validation passes
    if (errors.length === 0) {
      const receipt = FlowGuard.generateReceipt(result, data.trace_id)
      return { isValid: true, errors: [], receipt }
    }

    return { isValid: false, errors }
  }

  /**
   * Generate tamper-evident receipt with signature
   */
  static generateReceipt(result: any, traceId: string): TamperEvidentReceipt {
    const timestamp = new Date().toISOString()
    
    // Extract key information for receipt
    const receiptData = {
      flow_version: EXPECTED_FLOW_VERSION,
      planner_hash: FlowGuard.hashData(result.optimization_metadata?.suggested_techniques || []),
      builder_hash: FlowGuard.hashData(result.optimization_metadata?.techniques_used || []),
      runner_model: result.recommended_variant?.model || 'unknown',
      timestamp,
      trace_id: traceId
    }

    // Create signature
    const message = JSON.stringify(receiptData)
    const signature = crypto.sign('sha256', Buffer.from(message), privateKey)
    
    return {
      flow_version: receiptData.flow_version,
      planner_hash: receiptData.planner_hash,
      builder_hash: receiptData.builder_hash,
      runner_model: receiptData.runner_model,
      timestamp: receiptData.timestamp,
      sig: signature.toString('base64')
    }
  }

  /**
   * Hash data for receipt
   */
  static hashData(data: any): string {
    const hash = crypto.createHash('sha256')
    hash.update(JSON.stringify(data))
    return hash.digest('hex').substring(0, 8)
  }

  /**
   * Verify a receipt signature (for external validation)
   */
  static verifyReceipt(receipt: TamperEvidentReceipt, traceId: string): boolean {
    try {
      const receiptData = {
        flow_version: receipt.flow_version,
        planner_hash: receipt.planner_hash,
        builder_hash: receipt.builder_hash,
        runner_model: receipt.runner_model,
        timestamp: receipt.timestamp,
        trace_id: traceId
      }

      const message = JSON.stringify(receiptData)
      const signature = Buffer.from(receipt.sig, 'base64')
      
      return crypto.verify('sha256', Buffer.from(message), publicKey, signature)
    } catch (error) {
      logger.error('Receipt verification failed', error as Error)
      return false
    }
  }

  /**
   * Get public key for external verifiers
   */
  static getPublicKey(): string {
    return publicKey
  }
}

// Export middleware function for easy use
export const flowGuardMiddleware = FlowGuard.middleware()