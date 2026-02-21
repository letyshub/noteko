/**
 * Document parsing service.
 *
 * Dispatches document parsing by file type (PDF, DOCX, plain text, images).
 * Provides a sequential processing queue to prevent resource contention,
 * particularly important for OCR operations.
 *
 * Exported functions:
 *   - parseDocument(documentId)  - parse a single document by ID
 *   - queueDocument(documentId)  - add to sequential processing queue
 *   - retryDocument(documentId)  - reset status to pending and re-queue
 *   - resetStaleProcessingStatus() - reset stuck "processing" docs on startup
 */

import fs from 'node:fs/promises'
import log from 'electron-log'
import { eq } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { documents } from '@main/database/schema'
import { getDocument, saveDocumentContent } from '@main/services/document-service'
import { getMainWindow } from '@main/main-window'
import type { ProcessingStatus } from '@shared/types'

// ---------------------------------------------------------------------------
// Processing status helpers
// ---------------------------------------------------------------------------

/**
 * Update the processing_status column for a document.
 */
function updateProcessingStatus(id: number, status: ProcessingStatus): void {
  getDb()
    .update(documents)
    .set({ processing_status: status, updated_at: new Date().toISOString() })
    .where(eq(documents.id, id))
    .run()
}

// ---------------------------------------------------------------------------
// Individual parsers
// ---------------------------------------------------------------------------

/**
 * Extract text from a PDF file using pdf-parse.
 */
async function parsePdf(filePath: string): Promise<string> {
  const pdfParse = (await import('pdf-parse')).default
  const buffer = await fs.readFile(filePath)
  const data = await pdfParse(buffer)
  return data.text
}

/**
 * Extract text from a DOCX file using mammoth.
 */
async function parseDocx(filePath: string): Promise<string> {
  const mammoth = await import('mammoth')
  const buffer = await fs.readFile(filePath)
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

/**
 * Read plain text files (.txt, .csv, .md) with utf-8 encoding.
 */
async function parseText(filePath: string): Promise<string> {
  return fs.readFile(filePath, 'utf-8')
}

/**
 * Extract text from an image using Tesseract.js OCR.
 *
 * Runs Tesseract in the main thread (async) rather than a worker_thread.
 * This simplifies the implementation while still being non-blocking since
 * Tesseract.js uses its own internal web worker / wasm runtime.
 */
async function parseImage(filePath: string): Promise<string> {
  const { createWorker } = await import('tesseract.js')

  const worker = await createWorker('eng')

  try {
    const result = await worker.recognize(filePath)
    return result.data.text
  } finally {
    await worker.terminate()
  }
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Parse a document by its database ID.
 *
 * Looks up the document, dispatches to the appropriate parser based on
 * file_type, stores extracted text via saveDocumentContent(), and updates
 * the processing_status column.
 */
export async function parseDocument(documentId: number): Promise<void> {
  const doc = getDocument(documentId)
  if (!doc) {
    log.error(`[parsing-service] Document ${documentId} not found`)
    return
  }

  log.info(`[parsing-service] Parsing document ${documentId} (type: ${doc.file_type})`)
  updateProcessingStatus(documentId, 'processing')

  try {
    let extractedText: string | null = null

    switch (doc.file_type) {
      case 'pdf':
        extractedText = await parsePdf(doc.file_path)
        break

      case 'docx':
        extractedText = await parseDocx(doc.file_path)
        break

      case 'txt':
      case 'csv':
      case 'md':
        extractedText = await parseText(doc.file_path)
        break

      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
        extractedText = await parseImage(doc.file_path)
        break

      case 'doc':
        log.warn(`[parsing-service] .doc format not supported for document ${documentId}`)
        updateProcessingStatus(documentId, 'unsupported')
        return

      default:
        log.warn(`[parsing-service] Unknown file type "${doc.file_type}" for document ${documentId}`)
        updateProcessingStatus(documentId, 'unsupported')
        return
    }

    // Store extracted text
    saveDocumentContent({
      document_id: documentId,
      raw_text: extractedText,
    })

    updateProcessingStatus(documentId, 'completed')
    log.info(`[parsing-service] Document ${documentId} parsed successfully`)

    // Notify renderer of completion
    const win = getMainWindow()
    if (win) {
      win.webContents.send('app:progress', {
        taskId: `parse-${documentId}`,
        progress: 100,
        message: `Document ${documentId} parsed successfully`,
      })
    }
  } catch (error) {
    log.error(`[parsing-service] Failed to parse document ${documentId}:`, error)
    updateProcessingStatus(documentId, 'failed')
  }
}

// ---------------------------------------------------------------------------
// Sequential processing queue
// ---------------------------------------------------------------------------

const queue: number[] = []
let isProcessing = false

/**
 * Add a document to the sequential processing queue.
 * Processing starts immediately if the queue is idle.
 */
export function queueDocument(documentId: number): void {
  log.info(`[parsing-service] Queuing document ${documentId} for parsing`)
  queue.push(documentId)
  if (!isProcessing) {
    processNext()
  }
}

/**
 * Reset a document's status to pending and re-queue it for parsing.
 * Used for retry operations on failed documents.
 */
export function retryDocument(documentId: number): void {
  log.info(`[parsing-service] Retrying document ${documentId} (resetting to pending)`)
  updateProcessingStatus(documentId, 'pending')
  queueDocument(documentId)
}

/**
 * Process the queue iteratively until empty.
 */
async function processNext(): Promise<void> {
  if (isProcessing) return
  isProcessing = true

  while (queue.length > 0) {
    const documentId = queue.shift()!
    try {
      await parseDocument(documentId)
    } catch (error) {
      log.error(`[parsing-service] Queue processing error for document ${documentId}:`, error)
    }
  }

  isProcessing = false
}

// ---------------------------------------------------------------------------
// Startup cleanup
// ---------------------------------------------------------------------------

/**
 * Reset documents stuck in "processing" status back to "pending".
 * Called on app startup to recover from unclean shutdowns.
 */
export function resetStaleProcessingStatus(): void {
  log.info('[parsing-service] Checking for stale processing documents...')

  const staleDocuments = getDb().select().from(documents).where(eq(documents.processing_status, 'processing')).all()

  if (staleDocuments.length === 0) {
    log.info('[parsing-service] No stale documents found')
    return
  }

  log.info(`[parsing-service] Resetting ${staleDocuments.length} stale document(s) to pending`)

  for (const doc of staleDocuments) {
    updateProcessingStatus(doc.id, 'pending')
  }
}

// ---------------------------------------------------------------------------
// Test helpers (only used in tests)
// ---------------------------------------------------------------------------

/** @internal Exposed for test assertions on queue state */
export function _getQueueStateForTesting(): { queue: number[]; isProcessing: boolean } {
  return { queue: [...queue], isProcessing }
}
