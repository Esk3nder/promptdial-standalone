import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RetrievalHub,
  RetrievalHubConfig,
  getRetrievalHub,
  handleIndexRequest,
  handleSearchRequest,
  handleIRCoTRequest,
} from '../src/index'
import {
  createTestServiceRequest,
  createTestDocument,
  createTestRetrievalQuery,
  createTestRetrievalResult,
} from '@promptdial/shared'
import type { Document, RetrievalQuery, RetrievalResult } from '@promptdial/shared'

// Mock dependencies
vi.mock('@promptdial/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@promptdial/shared')>()
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    getTelemetryService: () => ({
      recordMetric: vi.fn(),
      recordLatency: vi.fn(),
      incrementCounter: vi.fn(),
    }),
  }
})

// Mock vector store
vi.mock('../src/vector-store', () => ({
  createVectorStore: () => ({
    index: vi.fn().mockResolvedValue(undefined),
    indexBatch: vi.fn().mockResolvedValue(undefined),
    search: vi.fn().mockResolvedValue({
      documents: [
        {
          id: 'doc1',
          content: 'Test document content',
          score: 0.95,
          metadata: { source: 'test.txt' },
        },
      ],
      total_results: 1,
      query_time_ms: 25,
    }),
    delete: vi.fn().mockResolvedValue(undefined),
    getStats: vi.fn().mockResolvedValue({
      documentCount: 10,
      indexSize: 1024,
      dimensions: 384,
    }),
  }),
}))

// Mock document processor
vi.mock('../src/document-processor', () => ({
  DocumentProcessor: vi.fn().mockImplementation(() => ({
    process: vi.fn().mockResolvedValue([
      {
        id: 'chunk1',
        content: 'Processed chunk 1',
        metadata: { chunk_index: 0 },
      },
    ]),
    processBatch: vi.fn().mockResolvedValue([
      {
        id: 'chunk1',
        content: 'Processed chunk 1',
        metadata: { chunk_index: 0 },
      },
      {
        id: 'chunk2',
        content: 'Processed chunk 2',
        metadata: { chunk_index: 1 },
      },
    ]),
  })),
}))

describe('RetrievalHub', () => {
  let hub: RetrievalHub

  beforeEach(() => {
    vi.clearAllMocks()
    hub = new RetrievalHub()
  })

  describe('indexDocuments', () => {
    it('should index documents and return stats', async () => {
      const documents = [
        { content: 'Document 1 content', metadata: { author: 'Alice' } },
        { content: 'Document 2 content', metadata: { author: 'Bob' } },
      ]

      const result = await hub.indexDocuments(documents)

      expect(result).toEqual({
        indexed: 2,
        chunks: 2,
      })

      // Should process documents and index them
      const mockProcessor = (hub as any).documentProcessor
      expect(mockProcessor.processBatch).toHaveBeenCalledWith(
        documents,
        expect.objectContaining({
          chunkSize: expect.any(Number),
          chunkOverlap: expect.any(Number),
        }),
      )

      const mockStore = (hub as any).vectorStore
      expect(mockStore.indexBatch).toHaveBeenCalled()
    })

    it('should use custom processing options', async () => {
      const documents = [{ content: 'Test document' }]
      const options = {
        chunkSize: 256,
        chunkOverlap: 64,
        splitMethod: 'sentence' as const,
      }

      await hub.indexDocuments(documents, options)

      const mockProcessor = (hub as any).documentProcessor
      expect(mockProcessor.processBatch).toHaveBeenCalledWith(
        documents,
        expect.objectContaining(options),
      )
    })

    it('should clear cache after indexing', async () => {
      // Enable cache
      hub = new RetrievalHub({ enableCache: true })

      // Add something to cache first
      await hub.search({ query: 'test query', top_k: 5 })

      // Index new documents
      await hub.indexDocuments([{ content: 'New document' }])

      // Cache should be cleared - search should hit the store again
      const mockStore = (hub as any).vectorStore
      mockStore.search.mockClear()

      await hub.search({ query: 'test query', top_k: 5 })
      expect(mockStore.search).toHaveBeenCalled()
    })
  })

  describe('search', () => {
    it('should search for documents', async () => {
      const query: RetrievalQuery = {
        query: 'quantum computing',
        top_k: 5,
        include_metadata: true,
      }

      const result = await hub.search(query)

      expect(result).toBeDefined()
      expect(result.documents).toHaveLength(1)
      expect(result.documents[0].content).toContain('Test document')
      expect(result.query_time_ms).toBeGreaterThan(0)
    })

    it('should use cache when enabled', async () => {
      hub = new RetrievalHub({ enableCache: true })
      const query: RetrievalQuery = { query: 'cached query', top_k: 3 }

      // First search - should hit the store
      const result1 = await hub.search(query)

      // Clear mock to verify cache hit
      const mockStore = (hub as any).vectorStore
      mockStore.search.mockClear()

      // Second search - should use cache
      const result2 = await hub.search(query)

      expect(mockStore.search).not.toHaveBeenCalled()
      expect(result2).toEqual(result1)
    })

    it('should post-process results', async () => {
      const query: RetrievalQuery = {
        query: 'test',
        top_k: 5,
        filters: { rerank: true },
      }

      const result = await hub.search(query)

      // Should highlight keywords (case insensitive match)
      expect(result.documents[0].content).toContain('**Test**')
    })
  })

  describe('retrieveForIRCoT', () => {
    it('should handle IRCoT retrieval format', async () => {
      const result = await hub.retrieveForIRCoT('[RETRIEVE: quantum computing]')

      expect(result).toContain('Retrieved Information:')
      expect(result).toContain('Test document content')

      // Should search with extracted query
      const mockStore = (hub as any).vectorStore
      expect(mockStore.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'quantum computing',
          top_k: 3,
        }),
      )
    })

    it('should include context in IRCoT retrieval', async () => {
      await hub.retrieveForIRCoT('information', 'about quantum physics')

      const mockStore = (hub as any).vectorStore
      expect(mockStore.search).toHaveBeenCalledWith(
        expect.objectContaining({
          query: 'information (Context: about quantum physics)',
        }),
      )
    })

    it('should format empty results for IRCoT', async () => {
      const mockStore = (hub as any).vectorStore
      mockStore.search.mockResolvedValueOnce({
        documents: [],
        query: 'test',
        total_results: 0,
      })

      const result = await hub.retrieveForIRCoT('no results query')

      expect(result).toBe('No relevant information found.')
    })
  })

  describe('deleteDocument', () => {
    it('should delete document and its chunks', async () => {
      const mockStore = (hub as any).vectorStore
      mockStore.search.mockResolvedValueOnce({
        documents: [
          { id: 'chunk1', content: 'Chunk 1', score: 0.9 },
          { id: 'chunk2', content: 'Chunk 2', score: 0.8 },
        ],
        query: '',
        total_results: 2,
      })

      await hub.deleteDocument('doc123')

      // Should search for chunks
      expect(mockStore.search).toHaveBeenCalledWith({
        query: '',
        top_k: 1000,
        filters: { source_doc_id: 'doc123' },
      })

      // Should delete each chunk
      expect(mockStore.delete).toHaveBeenCalledWith('chunk1')
      expect(mockStore.delete).toHaveBeenCalledWith('chunk2')
    })

    it('should clear cache after deletion', async () => {
      hub = new RetrievalHub({ enableCache: true })

      // Cache a search
      await hub.search({ query: 'test', top_k: 5 })

      // Delete a document
      await hub.deleteDocument('doc123')

      // Search again - should not use cache
      const mockStore = (hub as any).vectorStore
      mockStore.search.mockClear()

      await hub.search({ query: 'test', top_k: 5 })
      expect(mockStore.search).toHaveBeenCalled()
    })
  })

  describe('getStats', () => {
    it('should return hub statistics', async () => {
      hub = new RetrievalHub({ enableCache: true })

      const stats = await hub.getStats()

      expect(stats).toEqual({
        vectorStore: {
          documentCount: 10,
          indexSize: 1024,
          dimensions: 384,
        },
        cache: {
          size: 0,
          enabled: true,
        },
      })
    })
  })

  describe('configuration', () => {
    it('should use custom configuration', () => {
      const config: Partial<RetrievalHubConfig> = {
        defaultTopK: 10,
        defaultChunkSize: 256,
        enableCache: false,
      }

      hub = new RetrievalHub(config)

      expect((hub as any).config.defaultTopK).toBe(10)
      expect((hub as any).config.defaultChunkSize).toBe(256)
      expect((hub as any).queryCache).toBeNull()
    })
  })
})

describe('Service API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('handleIndexRequest', () => {
    it('should handle valid index request', async () => {
      const request = createTestServiceRequest({
        documents: [{ content: 'Document 1' }, { content: 'Document 2' }],
        options: { chunkSize: 512 },
      })

      const response = await handleIndexRequest(request)

      expect(response.success).toBe(true)
      expect(response.data).toEqual({
        indexed: 2,
        chunks: 2,
      })
    })

    it('should handle index errors', async () => {
      const hub = getRetrievalHub()
      vi.spyOn(hub, 'indexDocuments').mockRejectedValueOnce(new Error('Index failed'))

      const request = createTestServiceRequest({
        documents: [{ content: 'Doc' }],
      })

      const response = await handleIndexRequest(request)

      expect(response.success).toBe(false)
      expect(response.error).toBeDefined()
      expect(response.error?.code).toBe('INTERNAL_ERROR')
    })
  })

  describe('handleSearchRequest', () => {
    it('should handle valid search request', async () => {
      const request = createTestServiceRequest(
        createTestRetrievalQuery({
          query: 'test search',
          top_k: 10,
        }),
      )

      const response = await handleSearchRequest(request)

      expect(response.success).toBe(true)
      expect(response.data).toBeDefined()
      expect(response.data?.documents).toHaveLength(1)
    })

    it('should handle search errors', async () => {
      const hub = getRetrievalHub()
      vi.spyOn(hub, 'search').mockRejectedValueOnce(new Error('Search failed'))

      const request = createTestServiceRequest(createTestRetrievalQuery({ query: 'fail' }))

      const response = await handleSearchRequest(request)

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe('INTERNAL_ERROR')
    })
  })

  describe('handleIRCoTRequest', () => {
    it('should handle valid IRCoT request', async () => {
      const request = createTestServiceRequest({
        query: '[RETRIEVE: information]',
        context: 'about AI',
      })

      const response = await handleIRCoTRequest(request)

      expect(response.success).toBe(true)
      expect(response.data).toContain('Retrieved Information:')
    })

    it('should handle IRCoT errors', async () => {
      const hub = getRetrievalHub()
      vi.spyOn(hub, 'retrieveForIRCoT').mockRejectedValueOnce(new Error('IRCoT failed'))

      const request = createTestServiceRequest({
        query: 'fail',
      })

      const response = await handleIRCoTRequest(request)

      expect(response.success).toBe(false)
      expect(response.error?.code).toBe('INTERNAL_ERROR')
    })
  })
})

describe('getRetrievalHub', () => {
  it('should return singleton instance', () => {
    const hub1 = getRetrievalHub()
    const hub2 = getRetrievalHub()

    expect(hub1).toBe(hub2)
  })
})
