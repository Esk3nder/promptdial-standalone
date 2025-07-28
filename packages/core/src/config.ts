export interface ServiceUrls {
  techniqueEngine?: string
  evaluator?: string
  retrievalHub?: string
  optimizer?: string
  telemetry?: string
}

export interface FeatureFlags {
  useTechniqueEngine?: boolean
  useEvaluator?: boolean
  useRetrieval?: boolean
  useParetoFilter?: boolean
  useTelemetry?: boolean
}

export interface PromptDialConfig {
  mode: 'monolithic' | 'microservices'
  services?: ServiceUrls
  features?: FeatureFlags
  fallbackToMonolithic?: boolean
  serviceTimeout?: number
  maxRetries?: number
}

export class ConfigManager {
  private static instance: ConfigManager
  private config: PromptDialConfig

  private constructor() {
    this.config = this.loadConfig()
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager()
    }
    return ConfigManager.instance
  }

  private loadConfig(): PromptDialConfig {
    const mode = (process.env.PROMPTDIAL_MODE as 'monolithic' | 'microservices') || 'monolithic'
    
    return {
      mode,
      services: {
        techniqueEngine: process.env.TECHNIQUE_ENGINE_URL || 'http://localhost:3003',
        evaluator: process.env.EVALUATOR_URL || 'http://localhost:3005',
        retrievalHub: process.env.RETRIEVAL_HUB_URL || 'http://localhost:3004',
        optimizer: process.env.OPTIMIZER_URL || 'http://localhost:3007',
        telemetry: process.env.TELEMETRY_URL || 'http://localhost:3002'
      },
      features: {
        useTechniqueEngine: process.env.USE_TECHNIQUE_ENGINE !== 'false',
        useEvaluator: process.env.USE_EVALUATOR !== 'false',
        useRetrieval: process.env.USE_RETRIEVAL !== 'false',
        useParetoFilter: process.env.USE_PARETO_FILTER === 'true',
        useTelemetry: process.env.USE_TELEMETRY === 'true'
      },
      fallbackToMonolithic: process.env.FALLBACK_TO_MONOLITHIC !== 'false',
      serviceTimeout: parseInt(process.env.SERVICE_TIMEOUT || '30000'),
      maxRetries: parseInt(process.env.SERVICE_MAX_RETRIES || '3')
    }
  }

  getConfig(): PromptDialConfig {
    return { ...this.config }
  }

  updateConfig(updates: Partial<PromptDialConfig>): void {
    this.config = { ...this.config, ...updates }
  }

  isServiceEnabled(service: keyof ServiceUrls): boolean {
    if (this.config.mode !== 'microservices') {
      return false
    }

    const featureKey = `use${service.charAt(0).toUpperCase() + service.slice(1)}` as keyof FeatureFlags
    return this.config.features?.[featureKey] !== false
  }

  getServiceUrl(service: keyof ServiceUrls): string | undefined {
    return this.config.services?.[service]
  }

  shouldFallbackToMonolithic(): boolean {
    return this.config.fallbackToMonolithic !== false
  }
}