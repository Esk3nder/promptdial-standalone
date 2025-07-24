/**
 * PromptDial 2.0 - Health Checker
 */

import axios from 'axios'
import { createLogger } from '@promptdial/shared'
import { ServiceConfig } from './services'

const logger = createLogger('health-checker')

export interface HealthStatus {
  service: string
  healthy: boolean
  latency?: number
  error?: string
  lastCheck: Date
}

export class HealthChecker {
  private services: Record<string, ServiceConfig>
  private healthCache: Map<string, HealthStatus> = new Map()
  private cacheTimeout = 30000 // 30 seconds

  constructor(services: Record<string, ServiceConfig>) {
    this.services = services
  }

  async checkService(serviceName: string): Promise<HealthStatus> {
    const config = this.services[serviceName]
    if (!config) {
      throw new Error(`Unknown service: ${serviceName}`)
    }

    // Check cache
    const cached = this.healthCache.get(serviceName)
    if (cached && Date.now() - cached.lastCheck.getTime() < this.cacheTimeout) {
      return cached
    }

    const startTime = Date.now()

    try {
      const response = await axios.get(`${config.url}${config.healthEndpoint}`, {
        timeout: config.timeout,
        validateStatus: (status) => status === 200,
      })

      const latency = Date.now() - startTime
      const status: HealthStatus = {
        service: config.name,
        healthy: true,
        latency,
        lastCheck: new Date(),
      }

      this.healthCache.set(serviceName, status)
      return status
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const status: HealthStatus = {
        service: config.name,
        healthy: false,
        error: errorMessage,
        lastCheck: new Date(),
      }

      logger.warn(`Service ${serviceName} is unhealthy`, { error: errorMessage })
      this.healthCache.set(serviceName, status)
      return status
    }
  }

  async checkAll(): Promise<Record<string, HealthStatus>> {
    const results: Record<string, HealthStatus> = {}

    // Check all services in parallel
    const checks = Object.keys(this.services).map(async (serviceName) => {
      const status = await this.checkService(serviceName)
      results[serviceName] = status
    })

    await Promise.all(checks)
    return results
  }

  clearCache(): void {
    this.healthCache.clear()
  }
}
