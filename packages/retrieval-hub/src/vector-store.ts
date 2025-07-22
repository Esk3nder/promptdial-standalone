/**
 * PromptDial 2.0 - Vector Store Interface
 * 
 * Abstract interface for vector databases
 */

import {
  Document,
  RetrievalQuery,
  RetrievalResult,
  createLogger
} from '@promptdial/shared'

const logger = createLogger('vector-store')

// ============= Vector Store Interface =============

export interface VectorStore {
  /**
   * Index a document with its embedding
   */
  index(document: Document): Promise<void>
  
  /**
   * Index multiple documents in batch
   */
  indexBatch(documents: Document[]): Promise<void>
  
  /**
   * Search for similar documents
   */
  search(query: RetrievalQuery): Promise<RetrievalResult>
  
  /**
   * Delete a document by ID
   */
  delete(id: string): Promise<void>
  
  /**
   * Get store statistics
   */
  getStats(): Promise<VectorStoreStats>
}

export interface VectorStoreStats {
  documentCount: number
  indexSize: number
  dimensions: number
}

// ============= In-Memory Vector Store (Development) =============

export class InMemoryVectorStore implements VectorStore {
  private documents: Map<string, Document> = new Map()
  private embeddings: Map<string, number[]> = new Map()
  private dimensions: number = 384 // Default embedding size
  
  async index(document: Document): Promise<void> {
    // Generate embedding if not provided
    if (!document.embedding) {
      document.embedding = await this.generateEmbedding(document.content)
    }
    
    this.documents.set(document.id, document)
    this.embeddings.set(document.id, document.embedding)
    
    logger.debug(`Indexed document ${document.id}`)
  }
  
  async indexBatch(documents: Document[]): Promise<void> {
    // Process in parallel for efficiency
    await Promise.all(documents.map(doc => this.index(doc)))
    logger.info(`Indexed batch of ${documents.length} documents`)
  }
  
  async search(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()
    
    // Generate query embedding
    const queryEmbedding = await this.generateEmbedding(query.query)
    
    // Calculate similarities
    const similarities: Array<{ id: string; score: number }> = []
    
    for (const [id, embedding] of this.embeddings) {
      const document = this.documents.get(id)!
      
      // Apply filters if provided
      if (query.filters && !this.matchesFilters(document, query.filters)) {
        continue
      }
      
      const score = this.cosineSimilarity(queryEmbedding, embedding)
      similarities.push({ id, score })
    }
    
    // Sort by score and take top K
    similarities.sort((a, b) => b.score - a.score)
    const topK = similarities.slice(0, query.top_k)
    
    // Build results
    const results = topK.map(({ id, score }) => {
      const doc = this.documents.get(id)!
      return {
        id: doc.id,
        content: doc.content,
        score,
        metadata: query.include_metadata ? doc.metadata : undefined
      }
    })
    
    const queryTime = Date.now() - startTime
    
    return {
      documents: results,
      total_results: similarities.length,
      query_time_ms: queryTime
    }
  }
  
  async delete(id: string): Promise<void> {
    this.documents.delete(id)
    this.embeddings.delete(id)
    logger.debug(`Deleted document ${id}`)
  }
  
  async getStats(): Promise<VectorStoreStats> {
    return {
      documentCount: this.documents.size,
      indexSize: this.calculateIndexSize(),
      dimensions: this.dimensions
    }
  }
  
  private async generateEmbedding(text: string): Promise<number[]> {
    // In production, this would call an embedding service
    // For now, generate a deterministic fake embedding
    const hash = this.simpleHash(text)
    const embedding = new Array(this.dimensions)
    
    for (let i = 0; i < this.dimensions; i++) {
      // Generate pseudo-random values based on hash
      embedding[i] = Math.sin(hash * (i + 1)) * 0.5 + 0.5
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0))
    return embedding.map(val => val / magnitude)
  }
  
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have same dimensions')
    }
    
    let dotProduct = 0
    let normA = 0
    let normB = 0
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i]
      normA += a[i] * a[i]
      normB += b[i] * b[i]
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
  }
  
  private matchesFilters(document: Document, filters: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (document.metadata?.[key] !== value) {
        return false
      }
    }
    return true
  }
  
  private calculateIndexSize(): number {
    // Rough estimate: 4 bytes per float * dimensions * documents
    return 4 * this.dimensions * this.documents.size
  }
  
  private simpleHash(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    return Math.abs(hash)
  }
}

// ============= Vector Store Factory =============

export type VectorStoreType = 'memory' | 'pinecone' | 'weaviate' | 'pgvector'

export function createVectorStore(type: VectorStoreType = 'memory'): VectorStore {
  switch (type) {
    case 'memory':
      return new InMemoryVectorStore()
    
    case 'pinecone':
      // TODO: Implement Pinecone adapter
      logger.warn('Pinecone adapter not implemented, using in-memory store')
      return new InMemoryVectorStore()
    
    case 'weaviate':
      // TODO: Implement Weaviate adapter
      logger.warn('Weaviate adapter not implemented, using in-memory store')
      return new InMemoryVectorStore()
    
    case 'pgvector':
      // TODO: Implement pgvector adapter
      logger.warn('pgvector adapter not implemented, using in-memory store')
      return new InMemoryVectorStore()
    
    default:
      throw new Error(`Unknown vector store type: ${type}`)
  }
}