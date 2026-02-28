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
import type { GenerateOptions } from './ollama-service'
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
  /**
   * When true, all chunks are processed in parallel via Promise.all().
   * Provides a speedup when Ollama is configured with OLLAMA_NUM_PARALLEL > 1,
   * and eliminates inter-chunk scheduling overhead even when serialized.
   */
  parallelMap?: boolean
  /**
   * When provided, replaces the LLM combine/reduce pass with a synchronous
   * merge function. Eliminates one full LLM call for chunked generation.
   *
   * @param chunkResults - Raw LLM output strings, one per chunk
   * @returns Merged result string passed directly to saveResult
   */
  mergeResults?: (chunkResults: string[]) => string
  /** Ollama model parameters forwarded to every generate() call. */
  ollamaOptions?: GenerateOptions['ollamaOptions']
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
    parallelMap,
    mergeResults,
    ollamaOptions,
  } = options

  const totalChunks = chunks.length

  log.info(
    `[chunking-service] Starting chunked ${operationType} generation for document ${documentId} (${totalChunks} chunks, parallel=${parallelMap ?? false}, programmaticMerge=${!!mergeResults})`,
  )

  const chunkResults: string[] = new Array(totalChunks)

  try {
    // ─── Map phase ─────────────────────────────────────────────
    if (parallelMap && totalChunks > 1) {
      // Parallel: fire all chunk requests simultaneously
      await Promise.all(
        chunks.map(async (chunk, i) => {
          const chunkPrompt = promptTemplate.replace('{text}', chunk)
          let chunkText = ''

          for await (const token of generate({ model, prompt: chunkPrompt, baseUrl, ollamaOptions })) {
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

          chunkResults[i] = chunkText
        }),
      )
    } else {
      // Sequential: process chunks one at a time
      for (let i = 0; i < totalChunks; i++) {
        const chunkPrompt = promptTemplate.replace('{text}', chunks[i])
        let chunkText = ''

        for await (const token of generate({ model, prompt: chunkPrompt, baseUrl, ollamaOptions })) {
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

        chunkResults[i] = chunkText
      }
    }

    // ─── Reduce phase ──────────────────────────────────────────
    let finalText: string

    if (mergeResults) {
      // Programmatic merge: no extra LLM call
      finalText = mergeResults(chunkResults)
    } else {
      // LLM combine pass: merge all chunk results via another generate() call
      const combinedInput = chunkResults.map((result, i) => `--- Chunk ${i + 1} ---\n${result}`).join('\n\n')
      const combinePrompt = combinePromptTemplate.replace('{text}', combinedInput)
      let combineText = ''

      for await (const token of generate({ model, prompt: combinePrompt, baseUrl, ollamaOptions })) {
        combineText += token
        sendStreamEvent({
          documentId,
          operationType,
          chunk: token,
          done: false,
          chunkIndex: totalChunks, // indicates combining phase
          totalChunks,
        })
      }

      finalText = combineText
    }

    // Save the final result
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
