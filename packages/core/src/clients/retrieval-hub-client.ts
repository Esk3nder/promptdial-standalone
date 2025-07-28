import { ServiceClient, ServiceClientOptions } from './base-client'
import { 
  RetrievalRequest,
  RetrievalResponse,
  Document,
  RetrievalTechnique
} from '@promptdial/shared'

export class RetrievalHubClient extends ServiceClient {
  constructor(baseUrl: string, options?: ServiceClientOptions) {
    super('RetrievalHub', baseUrl, options)
  }

  async retrieve(request: RetrievalRequest): Promise<RetrievalResponse> {
    return this.request<RetrievalResponse>('POST', '/retrieve', request)
  }

  async retrieveForPrompt(
    prompt: string, 
    technique: RetrievalTechnique = 'ircot',
    maxChunks: number = 5
  ): Promise<string> {
    const response = await this.retrieve({
      query: prompt,
      technique,
      maxChunks
    })
    
    return response.documents
      .map(doc => `[${doc.source}] ${doc.content}`)
      .join('\n\n')
  }

  async indexDocument(document: Document): Promise<void> {
    await this.request('POST', '/index', document)
  }

  async searchSimilar(query: string, limit: number = 10): Promise<Document[]> {
    return this.request<Document[]>('POST', '/search', { query, limit })
  }

  async clearIndex(): Promise<void> {
    await this.request('DELETE', '/index')
  }
}