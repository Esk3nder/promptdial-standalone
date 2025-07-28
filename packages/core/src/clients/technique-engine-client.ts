import { ServiceClient, ServiceClientOptions } from './base-client'
import { 
  TechniqueRequest,
  TechniqueResponse,
  TaskClassification,
  TechniqueStrategy
} from '@promptdial/shared'

export class TechniqueEngineClient extends ServiceClient {
  constructor(baseUrl: string, options?: ServiceClientOptions) {
    super('TechniqueEngine', baseUrl, options)
  }

  async getTechniques(taskType: string): Promise<TechniqueStrategy[]> {
    return this.request<TechniqueStrategy[]>('GET', `/techniques?taskType=${taskType}`)
  }

  async generateVariants(request: TechniqueRequest): Promise<TechniqueResponse> {
    return this.request<TechniqueResponse>('POST', '/generate', request)
  }

  async classifyTask(prompt: string): Promise<TaskClassification> {
    return this.request<TaskClassification>('POST', '/classify', { prompt })
  }

  async getAvailableTechniques(): Promise<string[]> {
    return this.request<string[]>('GET', '/techniques/available')
  }
}