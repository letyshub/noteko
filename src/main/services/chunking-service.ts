/**
 * Document chunking and map-reduce AI orchestration service.
 *
 * Splits long documents into overlapping chunks for LLM processing,
 * then combines the per-chunk results in a final merge pass.
 *
 * Exported functions:
 *   - splitTextIntoChunks(text)            - split text at paragraph/sentence boundaries
 *   - runChunkedAiGeneration(options)       - orchestrate multi-chunk AI generation
 */

import log from 'electron-log'
import { generate } from './ollama-service'
import type { AiStreamEvent } from '@shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters per chunk before splitting. */
export const CHUNK_SIZE = 6000

/** Number of overlapping characters between adjacent chunks. */
export const CHUNK_OVERLAP = 500

// ---------------------------------------------------------------------------
// splitTextIntoChunks
// ---------------------------------------------------------------------------

/**
 * Split text into overlapping chunks, respecting paragraph and sentence boundaries.
 *
 * - Empty string returns `[]`.
 * - Text at or below `CHUNK_SIZE` returns `[text]`.
 * - Longer text is split by searching backward from `CHUNK_SIZE` for a paragraph
 *   boundary (`\n\n`), then a sentence boundary (`. `, `! `, `? `).
 * - Each subsequent chunk starts `CHUNK_OVERLAP` characters before the previous
 *   chunk's end, ensuring context continuity.
 *
 * @param text - The raw document text to split
 * @returns Array of text chunks (may be empty)
 */
export function splitTextIntoChunks(text: string): string[] {
  if (!text || text.length === 0) {
    return []
  }

  if (text.length <= CHUNK_SIZE) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    // If the remaining text fits in one chunk, take it all
    if (start + CHUNK_SIZE >= text.length) {
      chunks.push(text.slice(start))
      break
    }

    // Find the best split point by searching backward from CHUNK_SIZE
    const end = start + CHUNK_SIZE
    const splitAt = findSplitPoint(text, start, end)

    chunks.push(text.slice(start, splitAt))

    // Next chunk starts CHUNK_OVERLAP characters before the split point
    // to maintain context continuity between chunks
    start = splitAt - CHUNK_OVERLAP
    if (start < 0) start = 0

    // Safety: ensure we always make forward progress
    if (start >= splitAt) {
      start = splitAt
    }
  }

  return chunks
}

/**
 * Find the best split point by searching backward from `end` for natural boundaries.
 *
 * Priority:
 *   1. Paragraph boundary (`\n\n`) — split after the double newline
 *   2. Sentence boundary (`. `, `! `, `? `) — split after the punctuation + space
 *   3. Hard cut at `end` if no boundary found
 */
function findSplitPoint(text: string, start: number, end: number): number {
  // Search backward from end for a paragraph boundary
  // Only search within a reasonable window (last 40% of the chunk) to avoid tiny first chunks
  const searchStart = start + Math.floor((end - start) * 0.6)

  // 1. Try paragraph boundary (\n\n)
  const paragraphIdx = text.lastIndexOf('\n\n', end)
  if (paragraphIdx >= searchStart) {
    // Split after the paragraph boundary
    return paragraphIdx + 2
  }

  // 2. Try sentence boundaries (. ! ?)
  // Search for the last sentence-ending pattern in the search window
  let bestSentenceEnd = -1
  for (let i = end; i >= searchStart; i--) {
    const char = text[i - 1] // character before position i
    if (char === '.' || char === '!' || char === '?') {
      // Verify next char is a space or end of text (to avoid splitting on abbreviations mid-word)
      if (i >= text.length || text[i] === ' ' || text[i] === '\n') {
        bestSentenceEnd = i
        break
      }
    }
  }

  if (bestSentenceEnd > searchStart) {
    return bestSentenceEnd
  }

  // 3. Fallback: hard cut at end
  return end
}

// ---------------------------------------------------------------------------
// runChunkedAiGeneration
// ---------------------------------------------------------------------------

/** Options for the chunked AI generation orchestrator. */
export interface ChunkedAiGenerationOptions {
  documentId: number
  operationType: AiStreamEvent['operationType']
  model: string
  baseUrl?: string
  chunks: string[]
  promptTemplate: string
  combinePromptTemplate: string
  sendStreamEvent: (event: AiStreamEvent) => void
  saveResult: (fullText: string) => void
}

/**
 * Orchestrate multi-chunk AI generation using a map-reduce pattern.
 *
 * For each chunk:
 *   1. Build a prompt from the template (replacing `{text}` with chunk content)
 *   2. Call `generate()` and stream events with `chunkIndex` / `totalChunks`
 *   3. Accumulate the per-chunk result
 *
 * After all chunks:
 *   1. Build a combine prompt with all chunk results
 *   2. Call `generate()` for the merge pass
 *   3. Stream "combining" events
 *   4. Save the final merged result
 *
 * On error: sends an error event and aborts immediately.
 */
export async function runChunkedAiGeneration(options: ChunkedAiGenerationOptions): Promise<void> {
  const {
    documentId,
    operationType,
    model,
    baseUrl,
    chunks,
    promptTemplate,
    combinePromptTemplate,
    sendStreamEvent,
    saveResult,
  } = options

  const totalChunks = chunks.length

  log.info(
    `[chunking-service] Starting chunked ${operationType} generation for document ${documentId} (${totalChunks} chunks)`,
  )

  const chunkResults: string[] = []

  try {
    // ─── Map phase: process each chunk independently ───────────
    for (let i = 0; i < totalChunks; i++) {
      const chunkPrompt = promptTemplate.replace('{text}', chunks[i])
      let chunkText = ''

      const generator = generate({ model, prompt: chunkPrompt, baseUrl })

      for await (const token of generator) {
        chunkText += token
        sendStreamEvent({
          documentId,
          operationType,
          chunk: token,
          done: false,
          chunkIndex: i,
          totalChunks,
        })
      }

      chunkResults.push(chunkText)
    }

    // ─── Reduce phase: combine all chunk results ───────────────
    const combinedInput = chunkResults.map((result, i) => `--- Chunk ${i + 1} ---\n${result}`).join('\n\n')

    const combinePrompt = combinePromptTemplate.replace('{text}', combinedInput)
    let finalText = ''

    const combineGenerator = generate({ model, prompt: combinePrompt, baseUrl })

    for await (const token of combineGenerator) {
      finalText += token
      sendStreamEvent({
        documentId,
        operationType,
        chunk: token,
        done: false,
        chunkIndex: totalChunks, // indicates combining phase
        totalChunks,
      })
    }

    // Save the final combined result
    saveResult(finalText)

    // Send done event
    sendStreamEvent({
      documentId,
      operationType,
      chunk: '',
      done: true,
    })

    log.info(`[chunking-service] Completed chunked ${operationType} generation for document ${documentId}`)
  } catch (error) {
    log.error(
      `[chunking-service] Error during chunked ${operationType} generation for document ${documentId}:`,
      error instanceof Error ? error.message : error,
    )

    sendStreamEvent({
      documentId,
      operationType,
      chunk: '',
      done: true,
      error: error instanceof Error ? error.message : 'Unknown error during chunked AI generation',
    })
  }
}
