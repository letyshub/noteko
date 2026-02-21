import { describe, expect, it, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/mock/userData'),
  },
  BrowserWindow: {
    getAllWindows: vi.fn().mockReturnValue([]),
  },
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock fs.promises.readFile (parsing-service uses fs/promises)
const mockReadFile = vi.fn()
vi.mock('node:fs/promises', () => ({
  default: {
    readFile: (...args: unknown[]) => mockReadFile(...args),
  },
  readFile: (...args: unknown[]) => mockReadFile(...args),
}))

// Mock pdf-parse
const mockPdfParse = vi.fn()
vi.mock('pdf-parse', () => ({
  default: (...args: unknown[]) => mockPdfParse(...args),
}))

// Mock mammoth
const mockExtractRawText = vi.fn()
vi.mock('mammoth', () => ({
  extractRawText: (...args: unknown[]) => mockExtractRawText(...args),
}))

// Mock tesseract.js
const mockTesseractRecognize = vi.fn()
const mockTesseractTerminate = vi.fn()
const mockCreateWorker = vi.fn()
vi.mock('tesseract.js', () => ({
  createWorker: (...args: unknown[]) => mockCreateWorker(...args),
}))

// Mock document-service
const mockGetDocument = vi.fn()
const mockSaveDocumentContent = vi.fn()
vi.mock('@main/services/document-service', () => ({
  getDocument: (...args: unknown[]) => mockGetDocument(...args),
  saveDocumentContent: (...args: unknown[]) => mockSaveDocumentContent(...args),
}))

// Mock database connection for direct Drizzle updates (updateProcessingStatus)
const mockUpdate = vi.fn()
const mockSet = vi.fn()
const mockWhere = vi.fn()
const mockRun = vi.fn()
const mockAll = vi.fn()
const mockSelect = vi.fn()
const mockFrom = vi.fn()

vi.mock('@main/database/connection', () => ({
  getDb: () => ({
    update: (...args: unknown[]) => mockUpdate(...args),
    select: (...args: unknown[]) => mockSelect(...args),
  }),
}))

// Mock mainWindow module
vi.mock('@main/main-window', () => ({
  getMainWindow: vi.fn().mockReturnValue(null),
}))

// Chain mock setup helper
function setupDbUpdateChain() {
  mockRun.mockReturnValue(undefined)
  mockWhere.mockReturnValue({ run: mockRun })
  mockSet.mockReturnValue({ where: mockWhere })
  mockUpdate.mockReturnValue({ set: mockSet })
}

function setupDbSelectChain(rows: unknown[]) {
  mockAll.mockReturnValue(rows)
  mockFrom.mockReturnValue({ where: vi.fn().mockReturnValue({ all: mockAll }) })
  mockSelect.mockReturnValue({ from: mockFrom })
}

describe('parsing-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    setupDbUpdateChain()
  })

  // ─── PDF extraction ─────────────────────────────────────────

  describe('parseDocument - PDF', () => {
    it('should extract text from PDF, store raw_text, and set status to completed', async () => {
      const pdfBuffer = Buffer.from('fake pdf content')
      mockReadFile.mockResolvedValue(pdfBuffer)
      mockPdfParse.mockResolvedValue({ text: 'Extracted PDF text content' })
      mockGetDocument.mockReturnValue({
        id: 1,
        file_path: '/mock/path/doc.pdf',
        file_type: 'pdf',
        processing_status: 'pending',
      })
      mockSaveDocumentContent.mockReturnValue({ id: 1, document_id: 1, raw_text: 'Extracted PDF text content' })

      const { parseDocument } = await import('@main/services/parsing-service')
      await parseDocument(1)

      // Should read the file
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/doc.pdf')
      // Should call pdf-parse with the buffer
      expect(mockPdfParse).toHaveBeenCalledWith(pdfBuffer)
      // Should save the extracted text
      expect(mockSaveDocumentContent).toHaveBeenCalledWith({
        document_id: 1,
        raw_text: 'Extracted PDF text content',
      })
      // Should update status to completed (at least 2 calls: processing, then completed)
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  // ─── DOCX extraction ────────────────────────────────────────

  describe('parseDocument - DOCX', () => {
    it('should extract text from DOCX via mammoth and store raw_text', async () => {
      const docxBuffer = Buffer.from('fake docx content')
      mockReadFile.mockResolvedValue(docxBuffer)
      mockExtractRawText.mockResolvedValue({ value: 'Extracted DOCX text content' })
      mockGetDocument.mockReturnValue({
        id: 2,
        file_path: '/mock/path/doc.docx',
        file_type: 'docx',
        processing_status: 'pending',
      })
      mockSaveDocumentContent.mockReturnValue({ id: 1, document_id: 2, raw_text: 'Extracted DOCX text content' })

      const { parseDocument } = await import('@main/services/parsing-service')
      await parseDocument(2)

      // Should read the file
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/doc.docx')
      // Should call mammoth with the buffer
      expect(mockExtractRawText).toHaveBeenCalledWith({ buffer: docxBuffer })
      // Should save the extracted text
      expect(mockSaveDocumentContent).toHaveBeenCalledWith({
        document_id: 2,
        raw_text: 'Extracted DOCX text content',
      })
    })
  })

  // ─── Plain text reading ─────────────────────────────────────

  describe('parseDocument - Plain text', () => {
    it('should read .txt/.csv/.md files with utf-8 encoding and store raw_text', async () => {
      mockReadFile.mockResolvedValue('Plain text file content')
      mockGetDocument.mockReturnValue({
        id: 3,
        file_path: '/mock/path/notes.txt',
        file_type: 'txt',
        processing_status: 'pending',
      })
      mockSaveDocumentContent.mockReturnValue({ id: 1, document_id: 3, raw_text: 'Plain text file content' })

      const { parseDocument } = await import('@main/services/parsing-service')
      await parseDocument(3)

      // Should read with utf-8 encoding
      expect(mockReadFile).toHaveBeenCalledWith('/mock/path/notes.txt', 'utf-8')
      // Should save the content
      expect(mockSaveDocumentContent).toHaveBeenCalledWith({
        document_id: 3,
        raw_text: 'Plain text file content',
      })
    })
  })

  // ─── .doc files (unsupported) ───────────────────────────────

  describe('parseDocument - .doc unsupported', () => {
    it('should mark .doc files as unsupported', async () => {
      mockGetDocument.mockReturnValue({
        id: 4,
        file_path: '/mock/path/old.doc',
        file_type: 'doc',
        processing_status: 'pending',
      })

      const { parseDocument } = await import('@main/services/parsing-service')
      await parseDocument(4)

      // Should NOT attempt to read the file
      expect(mockReadFile).not.toHaveBeenCalled()
      // Should NOT call pdf-parse or mammoth
      expect(mockPdfParse).not.toHaveBeenCalled()
      expect(mockExtractRawText).not.toHaveBeenCalled()
      // Should update status to unsupported
      expect(mockUpdate).toHaveBeenCalled()
    })
  })

  // ─── Image OCR ──────────────────────────────────────────────

  describe('parseDocument - Image OCR', () => {
    it('should extract text from images via Tesseract.js and store raw_text', async () => {
      mockGetDocument.mockReturnValue({
        id: 5,
        file_path: '/mock/path/scan.png',
        file_type: 'png',
        processing_status: 'pending',
      })
      mockTesseractRecognize.mockResolvedValue({
        data: { text: 'OCR extracted text from image' },
      })
      mockTesseractTerminate.mockResolvedValue(undefined)
      mockCreateWorker.mockResolvedValue({
        recognize: mockTesseractRecognize,
        terminate: mockTesseractTerminate,
      })
      mockSaveDocumentContent.mockReturnValue({ id: 1, document_id: 5, raw_text: 'OCR extracted text from image' })

      const { parseDocument } = await import('@main/services/parsing-service')
      await parseDocument(5)

      // Should create a Tesseract worker
      expect(mockCreateWorker).toHaveBeenCalledWith('eng')
      // Should call recognize with the file path
      expect(mockTesseractRecognize).toHaveBeenCalledWith('/mock/path/scan.png')
      // Should save the extracted text
      expect(mockSaveDocumentContent).toHaveBeenCalledWith({
        document_id: 5,
        raw_text: 'OCR extracted text from image',
      })
      // Should terminate the worker
      expect(mockTesseractTerminate).toHaveBeenCalled()
    })
  })

  // ─── Error handling ─────────────────────────────────────────

  describe('parseDocument - Error handling', () => {
    it('should set status to failed and log error when parsing throws', async () => {
      const log = (await import('electron-log')).default
      mockGetDocument.mockReturnValue({
        id: 6,
        file_path: '/mock/path/corrupt.pdf',
        file_type: 'pdf',
        processing_status: 'pending',
      })
      mockReadFile.mockResolvedValue(Buffer.from('corrupt'))
      mockPdfParse.mockRejectedValue(new Error('Invalid PDF structure'))

      const { parseDocument } = await import('@main/services/parsing-service')
      await parseDocument(6)

      // Should update status to failed
      expect(mockUpdate).toHaveBeenCalled()
      // Should log the error
      expect(log.error).toHaveBeenCalled()
    })
  })

  // ─── Queue sequential processing ───────────────────────────

  describe('queueDocument - Sequential processing', () => {
    it('should process queued documents one at a time sequentially', async () => {
      const processingOrder: number[] = []

      // Set up documents that track their processing order
      mockGetDocument.mockImplementation((id: number) => {
        return {
          id,
          file_path: `/mock/path/doc${id}.txt`,
          file_type: 'txt',
          processing_status: 'pending',
        }
      })
      mockReadFile.mockImplementation((filePath: string) => {
        const id = parseInt(filePath.match(/doc(\d+)/)?.[1] ?? '0')
        processingOrder.push(id)
        return Promise.resolve(`Content of document ${id}`)
      })
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const { queueDocument } = await import('@main/services/parsing-service')

      // Queue two documents
      queueDocument(10)
      queueDocument(11)

      // Wait for processing to complete
      await vi.waitFor(
        () => {
          expect(processingOrder).toContain(10)
          expect(processingOrder).toContain(11)
        },
        { timeout: 2000 },
      )

      // Documents should be processed in order
      expect(processingOrder.indexOf(10)).toBeLessThan(processingOrder.indexOf(11))
    })
  })

  // ─── Stale status reset ─────────────────────────────────────

  describe('resetStaleProcessingStatus', () => {
    it('should reset documents stuck in processing status back to pending', async () => {
      // Set up the select chain to return stale documents
      setupDbSelectChain([
        { id: 100, processing_status: 'processing' },
        { id: 101, processing_status: 'processing' },
      ])

      const { resetStaleProcessingStatus } = await import('@main/services/parsing-service')
      resetStaleProcessingStatus()

      // Should query for documents with processing status
      expect(mockSelect).toHaveBeenCalled()
      // Should update their status
      expect(mockUpdate).toHaveBeenCalled()
    })
  })
})
