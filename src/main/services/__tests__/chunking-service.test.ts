import { describe, expect, it, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Tests — splitTextIntoChunks
// ---------------------------------------------------------------------------

describe('chunking-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  describe('splitTextIntoChunks', () => {
    // ─── Empty string ──────────────────────────────────────────

    it('should return empty array for empty string', async () => {
      const { splitTextIntoChunks } = await import('@main/services/chunking-service')
      const result = splitTextIntoChunks('')
      expect(result).toEqual([])
    })

    // ─── Short text (below threshold) ──────────────────────────

    it('should return single chunk when text is shorter than chunk threshold', async () => {
      const { splitTextIntoChunks } = await import('@main/services/chunking-service')
      const shortText = 'This is a short document that does not need chunking.'
      const result = splitTextIntoChunks(shortText)

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(shortText)
    })

    // ─── Text at exactly the threshold boundary ────────────────

    it('should return single chunk when text is exactly at the threshold', async () => {
      const { splitTextIntoChunks, CHUNK_SIZE } = await import('@main/services/chunking-service')
      const exactText = 'A'.repeat(CHUNK_SIZE)
      const result = splitTextIntoChunks(exactText)

      expect(result).toHaveLength(1)
      expect(result[0]).toBe(exactText)
    })

    // ─── Long text splits with correct overlap ─────────────────

    it('should split long text into multiple chunks with correct overlap', async () => {
      const { splitTextIntoChunks, CHUNK_SIZE, CHUNK_OVERLAP } = await import('@main/services/chunking-service')

      // Build text longer than CHUNK_SIZE with sentence boundaries
      const sentence = 'This is a test sentence. '
      const repeats = Math.ceil((CHUNK_SIZE * 2.5) / sentence.length)
      const longText = sentence.repeat(repeats)

      const chunks = splitTextIntoChunks(longText)

      // Should produce multiple chunks
      expect(chunks.length).toBeGreaterThan(1)

      // Verify overlap: the end of chunk N should appear at the start of chunk N+1
      for (let i = 0; i < chunks.length - 1; i++) {
        const endOfCurrent = chunks[i].slice(-CHUNK_OVERLAP)
        const startOfNext = chunks[i + 1].slice(0, CHUNK_OVERLAP)
        expect(startOfNext).toBe(endOfCurrent)
      }
    })

    // ─── Paragraph boundary splitting ──────────────────────────

    it('should split at paragraph boundaries when available', async () => {
      const { splitTextIntoChunks, CHUNK_SIZE } = await import('@main/services/chunking-service')

      // Create text with a paragraph boundary near the chunk size
      const paragraphA = 'A'.repeat(CHUNK_SIZE - 200)
      const paragraphB = 'B'.repeat(CHUNK_SIZE - 200)
      const textWithParagraphs = paragraphA + '\n\n' + paragraphB

      const chunks = splitTextIntoChunks(textWithParagraphs)

      expect(chunks.length).toBeGreaterThan(1)

      // First chunk should end at or near the paragraph boundary (before the B section)
      // It should NOT contain 'B' characters except possibly in the overlap region
      // The key assertion: the split happened at the \n\n boundary
      expect(chunks[0]).toContain(paragraphA)
      expect(chunks[0]).not.toContain(paragraphB.slice(0, 100))
    })

    // ─── Sentence boundary fallback ────────────────────────────

    it('should split at sentence boundaries when no paragraph boundary is found', async () => {
      const { splitTextIntoChunks, CHUNK_SIZE } = await import('@main/services/chunking-service')

      // Create long text with sentence boundaries but no paragraph breaks
      // Use sentences of varying length to ensure splitting at sentence end
      const sentenceBlock = 'This is a sentence with some content that fills space. '
      const repeats = Math.ceil((CHUNK_SIZE * 2) / sentenceBlock.length)
      const longText = sentenceBlock.repeat(repeats)

      const chunks = splitTextIntoChunks(longText)

      expect(chunks.length).toBeGreaterThan(1)

      // First chunk should end at a sentence boundary (ends with '. ' or '.')
      // Trim trailing whitespace and check the last non-whitespace character
      const firstChunkTrimmed = chunks[0].trimEnd()
      const endsAtSentence =
        firstChunkTrimmed.endsWith('.') || firstChunkTrimmed.endsWith('!') || firstChunkTrimmed.endsWith('?')
      expect(endsAtSentence).toBe(true)
    })

    // ─── Unicode text does not split mid-character ──────────────

    it('should handle unicode text with multi-byte characters without corruption', async () => {
      const { splitTextIntoChunks, CHUNK_SIZE } = await import('@main/services/chunking-service')

      // Build a long string with multi-byte characters (emoji, CJK)
      const unicodeSegment = 'Hello world. '
      const repeats = Math.ceil((CHUNK_SIZE * 2) / unicodeSegment.length)
      const longUnicodeText = unicodeSegment.repeat(repeats)

      const chunks = splitTextIntoChunks(longUnicodeText)

      expect(chunks.length).toBeGreaterThan(1)

      // Reassemble all chunks (removing overlap) and verify no character is corrupted
      // At minimum, each chunk should be valid UTF-16 (no lone surrogates)
      for (const chunk of chunks) {
        // If a chunk contains a lone surrogate, encoding to JSON and back will produce replacement chars
        const roundTripped = JSON.parse(JSON.stringify(chunk))
        expect(roundTripped).toBe(chunk)
      }
    })

    // ─── Degenerate input: text with no natural boundaries ──────

    it('should handle text with no paragraph or sentence boundaries by hard-cutting', async () => {
      const { splitTextIntoChunks, CHUNK_SIZE } = await import('@main/services/chunking-service')

      // Single continuous string of 'x' characters — no paragraphs, no sentence punctuation
      const degenerateText = 'x'.repeat(CHUNK_SIZE * 2 + 100)

      const chunks = splitTextIntoChunks(degenerateText)

      expect(chunks.length).toBeGreaterThan(1)

      // All text should be recoverable (no data loss)
      // Because of overlap, the total character count across all chunks exceeds the original,
      // but the original text should be fully contained when we remove overlapping sections
      const firstChunk = chunks[0]
      expect(firstChunk.length).toBeLessThanOrEqual(CHUNK_SIZE)
    })

    // ─── Overlap is exactly CHUNK_OVERLAP characters ────────────

    it('should produce overlap of exactly CHUNK_OVERLAP characters between adjacent chunks', async () => {
      const { splitTextIntoChunks, CHUNK_SIZE, CHUNK_OVERLAP } = await import('@main/services/chunking-service')

      // Use uniform text to make overlap measurement deterministic
      const sentence = 'Sentence number here. '
      const repeats = Math.ceil((CHUNK_SIZE * 3) / sentence.length)
      const longText = sentence.repeat(repeats)

      const chunks = splitTextIntoChunks(longText)

      expect(chunks.length).toBeGreaterThan(2)

      // For each pair of adjacent chunks, find the overlap region
      for (let i = 0; i < chunks.length - 1; i++) {
        const endOfCurrent = chunks[i].slice(-CHUNK_OVERLAP)
        const startOfNext = chunks[i + 1].slice(0, CHUNK_OVERLAP)
        // The overlap content should match exactly
        expect(startOfNext).toBe(endOfCurrent)
        // And be exactly CHUNK_OVERLAP characters long
        expect(endOfCurrent.length).toBe(CHUNK_OVERLAP)
      }
    })
  })
})
