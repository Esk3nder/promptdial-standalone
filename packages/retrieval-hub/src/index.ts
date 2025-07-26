/**
 * PromptDial 3.0 - Retrieval Hub Service
 *
 * Manages document storage, retrieval, and RAG operations
 */

import {
  Document,
  RetrievalQuery,
  RetrievalResult,
  ServiceRequest,
  ServiceResponse,
  createLogger,
  ERROR_CODES,
  getTelemetryService,
} from '@promptdial/shared'

// Define the IRCOT retrieval instruction locally
const IRCOT_RETRIEVAL_INSTRUCTION = `
You are supporting an IRCoT (Interleaved Retrieval Chain of Thought) process.

When you see [RETRIEVE: query], you should:
1. Search for information relevant to the query
2. Return the most relevant passages
3. Include source citations when available
4. Prioritize factual, authoritative sources

The model will use your retrieved information to continue its reasoning process.
`

import { VectorStore, VectorStoreType, createVectorStore } from './vector-store'

import { DocumentProcessor, ProcessingOptions } from './document-processor'

const logger = createLogger('retrieval-hub')

// ============= Retrieval Hub Configuration =============

export interface RetrievalHubConfig {
  vectorStoreType: VectorStoreType
  defaultTopK: number
  defaultChunkSize: number
  defaultChunkOverlap: number
  enableCache: boolean
  cacheSize: number
  cacheTTL: number
}

const DEFAULT_CONFIG: RetrievalHubConfig = {
  vectorStoreType: 'memory',
  defaultTopK: 5,
  defaultChunkSize: 512,
  defaultChunkOverlap: 128,
  enableCache: true,
  cacheSize: 1000,
  cacheTTL: 3600000, // 1 hour
}

// ============= Query Cache =============

interface CacheEntry {
  result: RetrievalResult
  timestamp: number
}

class QueryCache {
  private cache: Map<string, CacheEntry> = new Map()
  private maxSize: number
  private ttl: number

  constructor(maxSize: number, ttl: number) {
    this.maxSize = maxSize
    this.ttl = ttl
  }

  get(query: string): RetrievalResult | null {
    const entry = this.cache.get(query)
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(query)
      return null
    }

    return entry.result
  }

  set(query: string, result: RetrievalResult): void {
    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        ([, a], [, b]) => a.timestamp - b.timestamp,
      )[0][0]
      this.cache.delete(oldestKey)
    }

    this.cache.set(query, {
      result,
      timestamp: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
  }
}

// ============= Retrieval Hub Implementation =============

export class RetrievalHub {
  private vectorStore: VectorStore
  private documentProcessor: DocumentProcessor
  private queryCache: QueryCache | null
  private config: RetrievalHubConfig

  constructor(config: Partial<RetrievalHubConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.vectorStore = createVectorStore(this.config.vectorStoreType)
    this.documentProcessor = new DocumentProcessor()
    this.queryCache = this.config.enableCache
      ? new QueryCache(this.config.cacheSize, this.config.cacheTTL)
      : null
  }

  /**
   * Index a document or set of documents
   */
  async indexDocuments(
    documents: Array<{ content: string; metadata?: Record<string, any> }>,
    options?: ProcessingOptions,
  ): Promise<{ indexed: number; chunks: number }> {
    const startTime = Date.now()

    try {
      // Process documents into chunks
      const chunks = await this.documentProcessor.processBatch(documents, {
        chunkSize: options?.chunkSize || this.config.defaultChunkSize,
        chunkOverlap: options?.chunkOverlap || this.config.defaultChunkOverlap,
        ...options,
      })

      // Index chunks in vector store
      await this.vectorStore.indexBatch(chunks)

      const duration = Date.now() - startTime
      logger.info(
        `Indexed ${documents.length} documents as ${chunks.length} chunks in ${duration}ms`,
      )

      // Clear cache as index has changed
      this.queryCache?.clear()

      // Log telemetry
      getTelemetryService().recordMetric('retrieval_documents_indexed', chunks.length)

      return {
        indexed: documents.length,
        chunks: chunks.length,
      }
    } catch (error) {
      logger.error('Failed to index documents', error as Error)
      throw error
    }
  }

  /**
   * Search for relevant documents
   */
  async search(query: RetrievalQuery): Promise<RetrievalResult> {
    const startTime = Date.now()

    // Check cache first
    if (this.queryCache) {
      const cached = this.queryCache.get(query.query)
      if (cached) {
        logger.debug('Cache hit for query', { query: query.query })
        getTelemetryService().incrementCounter('retrieval_cache_hits')
        return cached
      }
    }

    try {
      // Perform vector search
      const result = await this.vectorStore.search({
        ...query,
        top_k: query.top_k || this.config.defaultTopK,
      })

      // Post-process results
      const processedResult = await this.postProcessResults(result, query)

      // Cache result
      if (this.queryCache) {
        this.queryCache.set(query.query, processedResult)
      }

      // Log telemetry
      const duration = Date.now() - startTime
      getTelemetryService().recordLatency('retrieval', duration)
      getTelemetryService().recordMetric('retrieval_results_returned', result.documents.length)

      return processedResult
    } catch (error) {
      logger.error('Search failed', error as Error)
      getTelemetryService().incrementCounter('retrieval_errors')
      throw error
    }
  }

  /**
   * Handle IRCoT-specific retrieval
   */
  async retrieveForIRCoT(query: string, context?: string): Promise<string> {
    // Parse IRCoT query format [RETRIEVE: query]
    const retrieveMatch = query.match(/\[RETRIEVE:\s*(.+?)\]/)
    const actualQuery = retrieveMatch ? retrieveMatch[1] : query

    // Add context to query if provided
    const enhancedQuery = context ? `${actualQuery} (Context: ${context})` : actualQuery

    // Search with IRCoT-optimized parameters
    const result = await this.search({
      query: enhancedQuery,
      top_k: 3, // Fewer but more relevant results for IRCoT
      include_metadata: true,
    })

    // Format results for IRCoT consumption
    return this.formatForIRCoT(result)
  }

  /**
   * Delete a document and its chunks
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Find all chunks for this document
      const searchResult = await this.vectorStore.search({
        query: '',
        top_k: 1000,
        filters: { source_doc_id: documentId },
      })

      // Delete each chunk
      for (const doc of searchResult.documents) {
        await this.vectorStore.delete(doc.id)
      }

      // Clear cache
      this.queryCache?.clear()

      logger.info(`Deleted document ${documentId} and ${searchResult.documents.length} chunks`)
    } catch (error) {
      logger.error(`Failed to delete document ${documentId}`, error as Error)
      throw error
    }
  }

  /**
   * Get retrieval hub statistics
   */
  async getStats(): Promise<{
    vectorStore: any
    cache: { size: number; enabled: boolean }
  }> {
    const vectorStats = await this.vectorStore.getStats()

    return {
      vectorStore: vectorStats,
      cache: {
        size: this.queryCache ? this.queryCache['cache'].size : 0,
        enabled: this.config.enableCache,
      },
    }
  }

  /**
   * Post-process search results
   */
  private async postProcessResults(
    result: RetrievalResult,
    query: RetrievalQuery,
  ): Promise<RetrievalResult> {
    // Re-rank results if needed
    if (query.filters?.rerank) {
      result.documents = await this.rerankResults(result.documents, query.query)
    }

    // Deduplicate overlapping chunks
    result.documents = this.deduplicateChunks(result.documents)

    // Add context snippets
    result.documents = result.documents.map((doc) => ({
      ...doc,
      content: this.highlightRelevantText(doc.content, query.query),
    }))

    return result
  }

  /**
   * Re-rank results using cross-encoder or other methods
   */
  private async rerankResults(
    documents: RetrievalResult['documents'],
    query: string,
  ): Promise<RetrievalResult['documents']> {
    // TODO: Implement cross-encoder reranking
    // For now, just boost exact matches
    return documents
      .map((doc) => {
        const exactMatchBoost = doc.content.toLowerCase().includes(query.toLowerCase()) ? 0.1 : 0

        return {
          ...doc,
          score: doc.score + exactMatchBoost,
        }
      })
      .sort((a, b) => b.score - a.score)
  }

  /**
   * Remove duplicate or highly overlapping chunks
   */
  private deduplicateChunks(documents: RetrievalResult['documents']): RetrievalResult['documents'] {
    const seen = new Set<string>()
    const deduplicated = []

    for (const doc of documents) {
      // Create a simple hash of the content
      const contentHash = doc.content.toLowerCase().replace(/\s+/g, ' ').substring(0, 100)

      if (!seen.has(contentHash)) {
        seen.add(contentHash)
        deduplicated.push(doc)
      }
    }

    return deduplicated
  }

  /**
   * Highlight relevant text in the content
   */
  private highlightRelevantText(content: string, query: string): string {
    // Simple keyword highlighting for now
    const keywords = query.toLowerCase().split(/\s+/)
    let highlighted = content

    for (const keyword of keywords) {
      if (keyword.length > 2) {
        // Skip short words
        // Escape special regex characters in keyword
        const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const regex = new RegExp(`\\b(${escapedKeyword})\\b`, 'gi')
        highlighted = highlighted.replace(regex, '**$1**')
      }
    }

    return highlighted
  }

  /**
   * Format results for IRCoT consumption
   */
  private formatForIRCoT(result: RetrievalResult): string {
    if (result.documents.length === 0) {
      return 'No relevant information found.'
    }

    const formatted = result.documents
      .map((doc, i) => {
        const source = doc.metadata?.source || `Document ${i + 1}`
        return `[${source}]\n${doc.content}`
      })
      .join('\n\n---\n\n')

    return `Retrieved Information:\n\n${formatted}`
  }
}

// ============= Service API =============

let hubInstance: RetrievalHub | null = null

export function getRetrievalHub(): RetrievalHub {
  if (!hubInstance) {
    hubInstance = new RetrievalHub()
  }
  return hubInstance
}

export async function handleIndexRequest(
  request: ServiceRequest<{
    documents: Array<{ content: string; metadata?: Record<string, any> }>
    options?: ProcessingOptions
  }>,
): Promise<ServiceResponse<{ indexed: number; chunks: number }>> {
  try {
    const result = await getRetrievalHub().indexDocuments(
      request.payload.documents,
      request.payload.options,
    )
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to index documents',
        retryable: true,
      },
    }
  }
}

export async function handleSearchRequest(
  request: ServiceRequest<RetrievalQuery>,
): Promise<ServiceResponse<RetrievalResult>> {
  try {
    const result = await getRetrievalHub().search(request.payload)
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'Search failed',
        retryable: true,
      },
    }
  }
}

export async function handleIRCoTRequest(
  request: ServiceRequest<{ query: string; context?: string }>,
): Promise<ServiceResponse<string>> {
  try {
    const result = await getRetrievalHub().retrieveForIRCoT(
      request.payload.query,
      request.payload.context,
    )
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      trace_id: request.trace_id,
      timestamp: new Date(),
      service: request.service,
      success: false,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: 'IRCoT retrieval failed',
        retryable: true,
      },
    }
  }
}

// ============= Standalone Service =============

if (require.main === module) {
  const express = require('express')
  const app = express()
  const PORT = process.env.PORT || 3003

  app.use(express.json({ limit: '50mb' }))

  // Index documents
  app.post('/index', async (req: any, res: any) => {
    const response = await handleIndexRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Search documents
  app.post('/search', async (req: any, res: any) => {
    const response = await handleSearchRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // IRCoT retrieval
  app.post('/ircot', async (req: any, res: any) => {
    const response = await handleIRCoTRequest(req.body)
    res.status(response.success ? 200 : 500).json(response)
  })

  // Delete document
  app.delete('/document/:id', async (req: any, res: any) => {
    try {
      await getRetrievalHub().deleteDocument(req.params.id)
      res.json({ success: true })
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message,
      })
    }
  })

  // Get stats
  app.get('/stats', async (_req: any, res: any) => {
    const stats = await getRetrievalHub().getStats()
    res.json(stats)
  })

  app.get('/health', (_req: any, res: any) => {
    res.json({
      status: 'healthy',
      service: 'retrieval-hub',
      vectorStore: process.env.VECTOR_STORE_TYPE || 'memory',
    })
  })

  app.listen(PORT, () => {
    logger.info(`Retrieval Hub service running on port ${PORT}`)
  })
}
