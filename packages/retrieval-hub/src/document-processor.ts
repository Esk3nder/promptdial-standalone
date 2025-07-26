/**
 * PromptDial 3.0 - Document Processor
 *
 * Handles document chunking, preprocessing, and metadata extraction
 */

import { Document, createLogger, generateTraceId } from '@promptdial/shared'

const logger = createLogger('document-processor')

// ============= Document Processing Options =============

export interface ProcessingOptions {
  chunkSize?: number
  chunkOverlap?: number
  includeMetadata?: boolean
  cleanText?: boolean
  preserveFormatting?: boolean
}

export interface ChunkMetadata {
  source_doc_id: string
  chunk_index: number
  total_chunks: number
  start_char: number
  end_char: number
  section?: string
  page?: number
}

// ============= Document Processor =============

export class DocumentProcessor {
  private defaultOptions: Required<ProcessingOptions> = {
    chunkSize: 512,
    chunkOverlap: 128,
    includeMetadata: true,
    cleanText: true,
    preserveFormatting: false,
  }

  /**
   * Process a single document into chunks
   */
  async processDocument(
    content: string,
    metadata: Record<string, any> = {},
    options: ProcessingOptions = {},
  ): Promise<Document[]> {
    const opts = { ...this.defaultOptions, ...options }

    // Clean text if requested
    const processedContent = opts.cleanText ? this.cleanText(content) : content

    // Extract sections if possible
    const sections = this.extractSections(processedContent)

    // Chunk the content
    const chunks =
      sections.length > 1
        ? this.chunkBySections(sections, opts)
        : this.chunkBySize(processedContent, opts)

    // Create documents
    const baseId = metadata.id || generateTraceId()
    return chunks.map((chunk, index) => ({
      id: `${baseId}_chunk_${index}`,
      content: chunk.text,
      metadata: {
        ...metadata,
        ...chunk.metadata,
        chunk_metadata: {
          source_doc_id: baseId,
          chunk_index: index,
          total_chunks: chunks.length,
          start_char: chunk.start,
          end_char: chunk.end,
          section: chunk.section,
        } as ChunkMetadata,
      },
    }))
  }

  /**
   * Process multiple documents in batch
   */
  async processBatch(
    documents: Array<{ content: string; metadata?: Record<string, any> }>,
    options: ProcessingOptions = {},
  ): Promise<Document[]> {
    const allChunks: Document[] = []

    for (const doc of documents) {
      const chunks = await this.processDocument(doc.content, doc.metadata, options)
      allChunks.push(...chunks)
    }

    logger.info(`Processed ${documents.length} documents into ${allChunks.length} chunks`)
    return allChunks
  }

  /**
   * Clean text by removing excess whitespace and special characters
   */
  private cleanText(text: string): string {
    return (
      text
        // Normalize whitespace
        .replace(/\s+/g, ' ')
        // Remove control characters
        .replace(/[\x00-\x1F\x7F]/g, '')
        // Trim lines
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .join('\n')
    )
  }

  /**
   * Extract sections from structured documents
   */
  private extractSections(text: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = []

    // Try to detect markdown-style headers
    const markdownPattern = /^(#{1,6})\s+(.+)$/gm
    const matches = Array.from(text.matchAll(markdownPattern))

    if (matches.length > 0) {
      let lastIndex = 0

      for (let i = 0; i < matches.length; i++) {
        const match = matches[i]
        const nextMatch = matches[i + 1]

        const title = match[2]
        const start = match.index! + match[0].length
        const end = nextMatch ? nextMatch.index! : text.length
        const content = text.slice(start, end).trim()

        if (content) {
          sections.push({ title, content })
        }
      }
    }

    // If no sections found, return the whole text as one section
    if (sections.length === 0) {
      sections.push({ title: 'Document', content: text })
    }

    return sections
  }

  /**
   * Chunk text by sections while respecting size limits
   */
  private chunkBySections(
    sections: Array<{ title: string; content: string }>,
    options: Required<ProcessingOptions>,
  ): Array<{ text: string; metadata: any; start: number; end: number; section?: string }> {
    const chunks: Array<{
      text: string
      metadata: any
      start: number
      end: number
      section?: string
    }> = []
    let currentPosition = 0

    for (const section of sections) {
      const sectionText = `${section.title}\n\n${section.content}`

      // If section is small enough, keep it as one chunk
      if (sectionText.length <= options.chunkSize) {
        chunks.push({
          text: sectionText,
          metadata: { section: section.title },
          start: currentPosition,
          end: currentPosition + sectionText.length,
          section: section.title,
        })
      } else {
        // Otherwise, chunk the section by size
        const sectionChunks = this.chunkBySize(sectionText, options)
        for (const chunk of sectionChunks) {
          chunks.push({
            ...chunk,
            metadata: { ...chunk.metadata, section: section.title },
            start: currentPosition + chunk.start,
            end: currentPosition + chunk.end,
            section: section.title,
          })
        }
      }

      currentPosition += sectionText.length + 1 // +1 for newline
    }

    return chunks
  }

  /**
   * Chunk text by size with overlap
   */
  private chunkBySize(
    text: string,
    options: Required<ProcessingOptions>,
  ): Array<{ text: string; metadata: any; start: number; end: number }> {
    const chunks: Array<{ text: string; metadata: any; start: number; end: number }> = []
    const { chunkSize, chunkOverlap } = options

    let start = 0
    while (start < text.length) {
      // Find the end position
      let end = Math.min(start + chunkSize, text.length)

      // Try to break at a sentence boundary
      if (end < text.length) {
        const lastPeriod = text.lastIndexOf('.', end)
        const lastNewline = text.lastIndexOf('\n', end)
        const breakPoint = Math.max(lastPeriod, lastNewline)

        if (breakPoint > start + chunkSize / 2) {
          end = breakPoint + 1 // Include the period/newline
        }
      }

      const chunkText = text.slice(start, end).trim()
      if (chunkText) {
        chunks.push({
          text: chunkText,
          metadata: {},
          start,
          end,
        })
      }

      // Move to next chunk with overlap
      start = end - chunkOverlap

      // Ensure we make progress
      if (start <= chunks[chunks.length - 1]?.start) {
        start = end
      }
    }

    return chunks
  }

  /**
   * Extract metadata from document content
   */
  extractMetadata(content: string): Record<string, any> {
    const metadata: Record<string, any> = {}

    // Try to extract title
    const titleMatch = content.match(/^#\s+(.+)$/m) || content.match(/^(.{1,100})/)
    if (titleMatch) {
      metadata.title = titleMatch[1].trim()
    }

    // Count words
    metadata.word_count = content.split(/\s+/).length

    // Detect language (simple heuristic)
    metadata.language = this.detectLanguage(content)

    // Extract dates if present
    const datePattern = /\b(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})\b/g
    const dates = Array.from(content.matchAll(datePattern)).map((m) => m[0])
    if (dates.length > 0) {
      metadata.dates = dates
    }

    return metadata
  }

  /**
   * Simple language detection heuristic
   */
  private detectLanguage(text: string): string {
    // Very basic detection based on common words
    const patterns = {
      en: /\b(the|and|of|to|in|is|was|for|that|with)\b/gi,
      es: /\b(el|la|de|que|y|en|un|una|por|para)\b/gi,
      fr: /\b(le|la|de|et|un|une|pour|que|dans|avec)\b/gi,
      de: /\b(der|die|das|und|in|von|zu|mit|auf|für)\b/gi,
    }

    const scores: Record<string, number> = {}

    for (const [lang, pattern] of Object.entries(patterns)) {
      const matches = text.match(pattern)
      scores[lang] = matches ? matches.length : 0
    }

    // Return language with highest score
    const maxLang = Object.entries(scores).sort(([, a], [, b]) => b - a)[0]

    return maxLang && maxLang[1] > 5 ? maxLang[0] : 'unknown'
  }
}
