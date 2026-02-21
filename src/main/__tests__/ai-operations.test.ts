import { describe, expect, it, vi, beforeEach } from 'vitest'
import { IPC_CHANNELS } from '@shared/ipc'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockHandle = vi.fn()

vi.mock('electron', () => ({
  ipcMain: {
    handle: (...args: unknown[]) => mockHandle(...args),
  },
}))

// Mock electron-log
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Mock main-window module
const mockSend = vi.fn()
const mockMainWindow = {
  webContents: { send: mockSend },
  isDestroyed: () => false,
}

vi.mock('@main/main-window', () => ({
  getMainWindow: () => mockMainWindow,
}))

// Service mocks
const mockGetDocumentWithContent = vi.fn()
const mockSaveDocumentContent = vi.fn()
const mockGetSetting = vi.fn()
const mockGenerate = vi.fn()

vi.mock('@main/services', () => ({
  // Minimal stubs for all services used by registerIpcHandlers
  listProjects: vi.fn(() => []),
  getProject: vi.fn(),
  createProject: vi.fn((d: unknown) => ({ id: 1, ...(d as object) })),
  updateProject: vi.fn((id: number, d: unknown) => ({ id, ...(d as object) })),
  deleteProject: vi.fn(),
  cascadeDeleteProject: vi.fn(),
  listFolders: vi.fn(() => []),
  createFolder: vi.fn((d: unknown) => ({ id: 1, ...(d as object) })),
  updateFolder: vi.fn((id: number, d: unknown) => ({ id, ...(d as object) })),
  deleteFolder: vi.fn(),
  cascadeDeleteFolder: vi.fn(),
  listDocumentsByProject: vi.fn(() => []),
  listDocumentsByFolder: vi.fn(() => []),
  getDocumentWithContent: (...args: unknown[]) => mockGetDocumentWithContent(...args),
  createDocument: vi.fn((d: unknown) => ({ id: 1, ...(d as object) })),
  updateDocument: vi.fn((id: number, d: unknown) => ({ id, ...(d as object) })),
  deleteDocument: vi.fn(),
  listQuizzesByDocument: vi.fn(() => []),
  getQuizWithQuestions: vi.fn(),
  createQuiz: vi.fn((d: unknown) => ({ id: 1, ...(d as object) })),
  deleteQuiz: vi.fn(),
  listAttempts: vi.fn(() => []),
  recordAttempt: vi.fn((d: unknown) => ({ id: 1, ...(d as object) })),
  validateFile: vi.fn(() => ({ valid: true, name: 'f', size: 0, type: 't' })),
  copyFileToStorage: vi.fn(() => '/stored'),
  openFilePickerDialog: vi.fn(async () => []),
  deleteFileFromStorage: vi.fn(),
  queueDocument: vi.fn(),
  checkHealth: vi.fn(async () => ({ connected: true, models: ['llama3'] })),
  listModels: vi.fn(async () => []),
  generate: (...args: unknown[]) => mockGenerate(...args),
  saveDocumentContent: (...args: unknown[]) => mockSaveDocumentContent(...args),
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
  setSetting: vi.fn(),
  getAllSettings: vi.fn(() => ({})),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Register handlers and return a function to invoke a specific channel's handler.
 */
async function getHandler(channel: string) {
  const { registerIpcHandlers } = await import('@main/ipc-handlers')
  registerIpcHandlers()

  const call = mockHandle.mock.calls.find((c: unknown[]) => c[0] === channel)
  if (!call) throw new Error(`Handler not registered for channel: ${channel}`)
  return call[1] as (...args: unknown[]) => Promise<unknown>
}

/**
 * Create a mock async generator that yields the given chunks.
 */
async function* mockAsyncGenerator(chunks: string[]): AsyncGenerator<string> {
  for (const chunk of chunks) {
    yield chunk
  }
}

/**
 * Wait for background async operations to flush (since handlers fire-and-forget).
 */
function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 50))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AI Document Operations (Group 5)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHandle.mockReset()
    vi.resetModules()
  })

  // ─── Test 1: Summarize flow ────────────────────────────────────────

  describe('AI_SUMMARIZE handler', () => {
    it('should stream chunks, accumulate text, and save summary to document_content', async () => {
      // Arrange: document with raw_text
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 1, name: 'test.pdf' },
        content: { raw_text: 'Some document text to summarize.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGenerate.mockReturnValue(mockAsyncGenerator(['This is ', 'a summary.']))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)

      // Act
      const result = await handler({}, 1)

      // The handler returns success immediately (fire-and-forget)
      expect(result).toEqual({ success: true, data: undefined })

      // Wait for the background async operation to complete
      await flushPromises()

      // Assert: generate was called with the right model and a prompt containing the text
      expect(mockGenerate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'llama3',
          baseUrl: 'http://localhost:11434',
        }),
      )

      // Assert: streaming events were sent
      const streamCalls = mockSend.mock.calls.filter((c: unknown[]) => c[0] === 'ai:stream')
      expect(streamCalls.length).toBeGreaterThanOrEqual(2) // at least chunk events + done

      // Assert: done event was sent
      const doneEvent = streamCalls.find((c: unknown[]) => {
        const evt = c[1] as { done: boolean }
        return evt.done === true
      })
      expect(doneEvent).toBeDefined()

      // Assert: summary was saved
      expect(mockSaveDocumentContent).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 1,
          summary: 'This is a summary.',
        }),
      )
    })
  })

  // ─── Test 2: Key points extraction ─────────────────────────────────

  describe('AI_EXTRACT_KEY_POINTS handler', () => {
    it('should stream chunks, parse key points, and save as string array', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 2, name: 'doc.pdf' },
        content: { raw_text: 'Document text for key points.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      const keyPointsText = '- First key point\n- Second key point\n- Third key point'
      mockGenerate.mockReturnValue(mockAsyncGenerator([keyPointsText]))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_EXTRACT_KEY_POINTS)

      // Act
      const result = await handler({}, 2)
      expect(result).toEqual({ success: true, data: undefined })

      await flushPromises()

      // Assert: key points were parsed and saved as array
      expect(mockSaveDocumentContent).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 2,
          key_points: ['First key point', 'Second key point', 'Third key point'],
        }),
      )
    })
  })

  // ─── Test 3: Streaming events sent to renderer ─────────────────────

  describe('streaming events', () => {
    it('should send ai:stream events with correct shape to renderer', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 3, name: 'doc.pdf' },
        content: { raw_text: 'Text' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGenerate.mockReturnValue(mockAsyncGenerator(['chunk1', 'chunk2']))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)
      await handler({}, 3)
      await flushPromises()

      // Verify all ai:stream calls
      const streamCalls = mockSend.mock.calls.filter((c: unknown[]) => c[0] === 'ai:stream')

      // Should have chunk events + done event
      expect(streamCalls.length).toBeGreaterThanOrEqual(3)

      // First chunk event should have correct shape
      const firstChunk = streamCalls[0][1] as {
        documentId: number
        operationType: string
        chunk: string
        done: boolean
      }
      expect(firstChunk.documentId).toBe(3)
      expect(firstChunk.operationType).toBe('summary')
      expect(firstChunk.chunk).toBe('chunk1')
      expect(firstChunk.done).toBe(false)

      // Done event
      const doneEvent = streamCalls[streamCalls.length - 1][1] as {
        done: boolean
        error?: string
      }
      expect(doneEvent.done).toBe(true)
      expect(doneEvent.error).toBeUndefined()
    })
  })

  // ─── Test 4: Missing raw_text returns error ────────────────────────

  describe('missing raw_text', () => {
    it('should return error when document has no raw_text', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 4, name: 'empty.pdf' },
        content: { raw_text: null },
      })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)
      const result = (await handler({}, 4)) as { success: boolean; error?: { code: string } }

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NO_CONTENT')
    })

    it('should return error when document content is undefined', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 5, name: 'no-content.pdf' },
        content: undefined,
      })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)
      const result = (await handler({}, 5)) as { success: boolean; error?: { code: string } }

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NO_CONTENT')
    })
  })

  // ─── Test 5: Error during generation ───────────────────────────────

  describe('error during generation', () => {
    it('should send error event via ai:stream when generate throws', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 6, name: 'doc.pdf' },
        content: { raw_text: 'Text' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      // Generate throws an error
      mockGenerate.mockReturnValue(
        (async function* () {
          yield 'partial'
          throw new Error('Connection lost')
        })(),
      )

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)
      await handler({}, 6)
      await flushPromises()

      // Should have sent an error event
      const streamCalls = mockSend.mock.calls.filter((c: unknown[]) => c[0] === 'ai:stream')
      const errorEvent = streamCalls.find((c: unknown[]) => {
        const evt = c[1] as { error?: string; done: boolean }
        return evt.error !== undefined && evt.done === true
      })
      expect(errorEvent).toBeDefined()

      // Should NOT have saved content
      expect(mockSaveDocumentContent).not.toHaveBeenCalled()
    })
  })
})
