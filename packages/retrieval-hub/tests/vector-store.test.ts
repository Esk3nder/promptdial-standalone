import { describe, it, expect, vi, beforeEach } from 'vitest'
import { InMemoryVectorStore, createVectorStore, VectorStoreType } from '../src/vector-store'
import { createTestDocument, createTestRetrievalQuery } from '@promptdial/shared'
import type { Document, RetrievalQuery } from '@promptdial/shared'

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
  }
})

describe('InMemoryVectorStore', () => {
  let store: InMemoryVectorStore

  beforeEach(() => {
    vi.clearAllMocks()
    store = new InMemoryVectorStore()
  })

  describe('index', () => {
    it('should index a document with embedding', async () => {
      const doc = createTestDocument({
        id: 'doc1',
        content: 'Test document content',
        embedding: [0.1, 0.2, 0.3],
      })

      await store.index(doc)

      const stats = await store.getStats()
      expect(stats.documentCount).toBe(1)
    })

    it('should generate embedding if not provided', async () => {
      const doc = createTestDocument({
        id: 'doc2',
        content: 'Document without embedding',
      })
      delete doc.embedding

      await store.index(doc)

      const stats = await store.getStats()
      expect(stats.documentCount).toBe(1)
    })
  })

  describe('indexBatch', () => {
    it('should index multiple documents', async () => {
      const docs = [
        createTestDocument({ id: 'doc1', content: 'First document' }),
        createTestDocument({ id: 'doc2', content: 'Second document' }),
        createTestDocument({ id: 'doc3', content: 'Third document' }),
      ]

      await store.indexBatch(docs)

      const stats = await store.getStats()
      expect(stats.documentCount).toBe(3)
    })
  })

  describe('search', () => {
    beforeEach(async () => {
      // Index some test documents
      const docs = [
        createTestDocument({
          id: 'doc1',
          content: 'Quantum computing is the future',
        }),
        createTestDocument({
          id: 'doc2',
          content: 'Classical computers are everywhere',
        }),
        createTestDocument({
          id: 'doc3',
          content: 'Quantum physics explains quantum computing',
        }),
      ]

      await store.indexBatch(docs)
    })

    it('should search for similar documents', async () => {
      const query: RetrievalQuery = {
        query: 'quantum',
        top_k: 2,
      }

      const result = await store.search(query)

      expect(result.documents).toHaveLength(2)
      expect(result.total_results).toBeGreaterThanOrEqual(2)
      expect(result.query_time_ms).toBeGreaterThanOrEqual(0)

      // Results should be sorted by score
      expect(result.documents[0].score).toBeGreaterThanOrEqual(result.documents[1].score)
    })

    it('should include metadata when requested', async () => {
      const doc = createTestDocument({
        id: 'doc4',
        content: 'Test with metadata',
        metadata: { author: 'Alice', year: 2024 },
      })
      await store.index(doc)

      const query: RetrievalQuery = {
        query: 'metadata',
        top_k: 1,
        include_metadata: true,
      }

      const result = await store.search(query)

      expect(result.documents[0].metadata).toBeDefined()
      expect(result.documents[0].metadata?.author).toBe('Alice')
    })

    it('should apply filters', async () => {
      const doc = createTestDocument({
        id: 'doc5',
        content: 'Filtered document',
        metadata: { category: 'science' },
      })
      await store.index(doc)

      const query: RetrievalQuery = {
        query: 'document',
        top_k: 10,
        filters: { category: 'science' },
      }

      const result = await store.search(query)

      // Should only return the science document
      expect(result.documents.length).toBe(1)
      expect(result.documents[0].id).toBe('doc5')
    })

    it('should handle empty search results', async () => {
      const query: RetrievalQuery = {
        query: 'nonexistent topic',
        top_k: 5,
        filters: { category: 'nonexistent' },
      }

      const result = await store.search(query)

      expect(result.documents).toHaveLength(0)
      expect(result.total_results).toBe(0)
    })
  })

  describe('delete', () => {
    it('should delete a document by ID', async () => {
      const doc = createTestDocument({ id: 'doc-to-delete' })
      await store.index(doc)

      let stats = await store.getStats()
      const countBefore = stats.documentCount

      await store.delete('doc-to-delete')

      stats = await store.getStats()
      expect(stats.documentCount).toBe(countBefore - 1)

      // Should not find deleted document
      const result = await store.search({
        query: 'doc-to-delete',
        top_k: 10,
      })

      const found = result.documents.find((d) => d.id === 'doc-to-delete')
      expect(found).toBeUndefined()
    })

    it('should handle deleting non-existent document', async () => {
      // Should not throw
      await expect(store.delete('nonexistent')).resolves.toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return store statistics', async () => {
      const docs = [createTestDocument({ id: 'doc1' }), createTestDocument({ id: 'doc2' })]
      await store.indexBatch(docs)

      const stats = await store.getStats()

      expect(stats).toEqual({
        documentCount: 2,
        indexSize: expect.any(Number),
        dimensions: 384,
      })
    })
  })

  describe('similarity calculation', () => {
    it('should calculate cosine similarity correctly', () => {
      const similarity = (store as any).cosineSimilarity([1, 0, 0], [1, 0, 0])
      expect(similarity).toBe(1) // Identical vectors

      const similarity2 = (store as any).cosineSimilarity([1, 0, 0], [0, 1, 0])
      expect(similarity2).toBe(0) // Orthogonal vectors

      const similarity3 = (store as any).cosineSimilarity([1, 0, 0], [-1, 0, 0])
      expect(similarity3).toBe(-1) // Opposite vectors
    })
  })

  describe('embedding generation', () => {
    it('should generate consistent embeddings for same text', async () => {
      const text = 'Test text for embedding'

      const embedding1 = await (store as any).generateEmbedding(text)
      const embedding2 = await (store as any).generateEmbedding(text)

      expect(embedding1).toEqual(embedding2)
      expect(embedding1.length).toBe(384)
    })

    it('should generate different embeddings for different text', async () => {
      const embedding1 = await (store as any).generateEmbedding('Text one')
      const embedding2 = await (store as any).generateEmbedding('Completely different')

      // Should not be identical
      expect(embedding1).not.toEqual(embedding2)
    })
  })
})

describe('createVectorStore', () => {
  it('should create memory store by default', () => {
    const store = createVectorStore()
    expect(store).toBeInstanceOf(InMemoryVectorStore)
  })

  it('should create memory store when specified', () => {
    const store = createVectorStore('memory')
    expect(store).toBeInstanceOf(InMemoryVectorStore)
  })

  it('should support future vector store types', () => {
    // For now, always returns InMemoryVectorStore
    const store = createVectorStore('pinecone' as VectorStoreType)
    expect(store).toBeInstanceOf(InMemoryVectorStore)
  })
})
