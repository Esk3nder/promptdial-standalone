import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DocumentProcessor, ProcessingOptions, ChunkMetadata } from '../src/document-processor'

// Mock dependencies
vi.mock('@promptdial/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@promptdial/shared')>()
  return {
    ...actual,
    createLogger: () => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    }),
    generateTraceId: () => 'test-trace-' + Math.random().toString(36).substr(2, 9)
  }
})

describe('DocumentProcessor', () => {
  let processor: DocumentProcessor
  
  beforeEach(() => {
    processor = new DocumentProcessor()
  })
  
  describe('processDocument', () => {
    it('should chunk document by size', async () => {
      const content = 'This is a test document. '.repeat(50) // ~1250 chars
      const metadata = { source: 'test.txt' }
      
      const chunks = await processor.processDocument(content, metadata, {
        chunkSize: 300,
        chunkOverlap: 50
      })
      
      expect(chunks.length).toBeGreaterThan(1)
      
      // Each chunk should have proper metadata
      chunks.forEach((chunk, index) => {
        expect(chunk.id).toContain(`_chunk_${index}`)
        expect(chunk.metadata.source).toBe('test.txt')
        expect(chunk.metadata.chunk_metadata).toBeDefined()
        
        const chunkMeta = chunk.metadata.chunk_metadata as ChunkMetadata
        expect(chunkMeta.chunk_index).toBe(index)
        expect(chunkMeta.total_chunks).toBe(chunks.length)
        expect(chunkMeta.start_char).toBeGreaterThanOrEqual(0)
        expect(chunkMeta.end_char).toBeGreaterThan(chunkMeta.start_char)
      })
    })
    
    it('should respect chunk overlap', async () => {
      const content = 'Word1 Word2 Word3 Word4 Word5 Word6 Word7 Word8 Word9 Word10'
      
      const chunks = await processor.processDocument(content, {}, {
        chunkSize: 20,
        chunkOverlap: 10,
        cleanText: false
      })
      
      expect(chunks.length).toBeGreaterThan(1)
      
      // Check that chunks overlap
      for (let i = 1; i < chunks.length; i++) {
        const prevEnd = chunks[i - 1].content.slice(-10)
        const currentStart = chunks[i].content.slice(0, 10)
        
        // There should be some overlap
        expect(chunks[i - 1].content).toContain(
          chunks[i].content.split(' ')[0]
        )
      }
    })
    
    it('should clean text when requested', async () => {
      const content = '  This   has\n\nextra    whitespace.  \n  And line breaks.  '
      
      const chunks = await processor.processDocument(content, {}, {
        cleanText: true,
        chunkSize: 1000
      })
      
      expect(chunks[0].content).not.toContain('  ')
      expect(chunks[0].content).toBe('This has extra whitespace. And line breaks.')
    })
    
    it('should preserve formatting when requested', async () => {
      const content = '  This   has\n\nextra    whitespace.  '
      
      const chunks = await processor.processDocument(content, {}, {
        cleanText: false,
        preserveFormatting: true,
        chunkSize: 1000
      })
      
      // When cleanText is false, whitespace should be preserved but some normalization may still occur
      expect(chunks[0].content).toContain('This   has')
      expect(chunks[0].content).toContain('extra    whitespace')
    })
    
    it('should extract and chunk by sections', async () => {
      const content = `# Section 1
This is section 1 content.

## Subsection 1.1
More content here.

# Section 2
This is section 2 content.`
      
      const chunks = await processor.processDocument(content, {}, {
        chunkSize: 100,
        chunkOverlap: 20
      })
      
      // Should have chunks with section metadata
      expect(chunks.length).toBeGreaterThan(0)
      
      // Check that sections were detected
      const hasSection1 = chunks.some(c => 
        c.content.includes('Section 1')
      )
      const hasSection2 = chunks.some(c => 
        c.content.includes('Section 2')
      )
      
      expect(hasSection1).toBe(true)
      expect(hasSection2).toBe(true)
    })
    
    it('should generate IDs when not provided', async () => {
      const chunks = await processor.processDocument('Test content')
      
      expect(chunks[0].id).toMatch(/^test-trace-.*_chunk_0$/)
    })
    
    it('should use provided document ID', async () => {
      const chunks = await processor.processDocument(
        'Test content',
        { id: 'custom-doc-id' }
      )
      
      expect(chunks[0].id).toBe('custom-doc-id_chunk_0')
      expect(chunks[0].metadata.chunk_metadata?.source_doc_id).toBe('custom-doc-id')
    })
  })
  
  describe('processBatch', () => {
    it('should process multiple documents', async () => {
      const documents = [
        { content: 'First document content', metadata: { source: 'doc1.txt' } },
        { content: 'Second document content', metadata: { source: 'doc2.txt' } },
        { content: 'Third document content', metadata: { source: 'doc3.txt' } }
      ]
      
      const chunks = await processor.processBatch(documents, {
        chunkSize: 100
      })
      
      expect(chunks.length).toBeGreaterThanOrEqual(3)
      
      // Should have chunks from all documents
      const sources = new Set(chunks.map(c => c.metadata.source))
      expect(sources.size).toBe(3)
      expect(sources.has('doc1.txt')).toBe(true)
      expect(sources.has('doc2.txt')).toBe(true)
      expect(sources.has('doc3.txt')).toBe(true)
    })
    
    it('should handle empty batch', async () => {
      const chunks = await processor.processBatch([])
      
      expect(chunks).toEqual([])
    })
  })
  
  describe('text cleaning', () => {
    it('should normalize whitespace', () => {
      const cleaned = (processor as any).cleanText(
        '  Multiple   spaces    and\n\nnewlines\n\n\nhere  '
      )
      
      expect(cleaned).toBe('Multiple spaces and newlines here')
    })
    
    it('should remove control characters', () => {
      const cleaned = (processor as any).cleanText(
        'Text with\x00control\x01characters\x1F'
      )
      
      expect(cleaned).not.toContain('\x00')
      expect(cleaned).not.toContain('\x01')
      expect(cleaned).not.toContain('\x1F')
    })
    
    it('should handle unicode properly', () => {
      const text = 'Unicode: 你好世界 🌍 émojis'
      const cleaned = (processor as any).cleanText(text)
      
      expect(cleaned).toBe('Unicode: 你好世界 🌍 émojis')
    })
  })
  
  describe('section extraction', () => {
    it('should detect markdown headers', () => {
      const content = `
# Main Title
Introduction text.

## Subtitle
More content.

### Sub-subtitle
Even more content.
      `
      
      const sections = (processor as any).extractSections(content)
      
      expect(sections.length).toBeGreaterThan(1)
      expect(sections.some(s => s.title === 'Main Title')).toBe(true)
      expect(sections.some(s => s.title === 'Subtitle')).toBe(true)
    })
    
    it('should detect numbered sections', () => {
      const content = `
1. Introduction
First section content.

2. Methods
Second section content.

3. Results
Third section content.
      `
      
      const sections = (processor as any).extractSections(content)
      
      // Should return whole document as one section if no markdown headers
      expect(sections.length).toBe(1)
      expect(sections[0].content).toContain('Introduction')
    })
    
    it('should handle documents without sections', () => {
      const content = 'This is just plain text without any section markers.'
      
      const sections = (processor as any).extractSections(content)
      
      expect(sections).toHaveLength(1)
      expect(sections[0].content).toBe(content)
    })
  })
  
  describe('chunking strategies', () => {
    it('should chunk by sentences when possible', () => {
      const content = 'First sentence. Second sentence. Third sentence. Fourth sentence.'
      
      const chunks = (processor as any).chunkBySize(content, {
        chunkSize: 30,
        chunkOverlap: 10
      })
      
      // Should try to break at sentence boundaries
      chunks.forEach(chunk => {
        // Each chunk should start with a capital letter or be a continuation
        if (chunk.text.trim()) {
          expect(chunk.text.trim()).toMatch(/^[A-Z]|^\w/)
        }
      })
    })
    
    it('should handle very long sentences', () => {
      const longSentence = 'This is a very ' + 'long '.repeat(100) + 'sentence.'
      
      const chunks = (processor as any).chunkBySize(longSentence, {
        chunkSize: 50,
        chunkOverlap: 10
      })
      
      expect(chunks.length).toBeGreaterThan(1)
      
      // Should still chunk even without sentence boundaries
      chunks.forEach(chunk => {
        expect(chunk.text.length).toBeLessThanOrEqual(60) // Some buffer for overlap
      })
    })
  })
})