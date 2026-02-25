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
const mockChat = vi.fn()
const mockSplitTextIntoChunks = vi.fn()
const mockRunChunkedAiGeneration = vi.fn()
const mockParseQuizQuestions = vi.fn()
const mockValidateQuizQuestion = vi.fn()
const mockBuildQuizPrompt = vi.fn()
const mockCreateQuiz = vi.fn()
const mockGetOrCreateConversation = vi.fn()
const mockAddMessage = vi.fn()
const mockListMessages = vi.fn()
const mockDeleteConversation = vi.fn()

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
  createQuiz: (...args: unknown[]) => mockCreateQuiz(...args),
  deleteQuiz: vi.fn(),
  listAttempts: vi.fn(() => []),
  recordAttempt: vi.fn((d: unknown) => ({ id: 1, ...(d as object) })),
  validateFile: vi.fn(() => ({ valid: true, name: 'f', size: 0, type: 't' })),
  copyFileToStorage: vi.fn(() => '/stored'),
  openFilePickerDialog: vi.fn(async () => []),
  deleteFileFromStorage: vi.fn(),
  queueDocument: vi.fn(),
  retryDocument: vi.fn(),
  checkHealth: vi.fn(async () => ({ connected: true, models: ['llama3'] })),
  listModels: vi.fn(async () => []),
  generate: (...args: unknown[]) => mockGenerate(...args),
  chat: (...args: unknown[]) => mockChat(...args),
  saveDocumentContent: (...args: unknown[]) => mockSaveDocumentContent(...args),
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
  setSetting: vi.fn(),
  getAllSettings: vi.fn(() => ({})),
  splitTextIntoChunks: (...args: unknown[]) => mockSplitTextIntoChunks(...args),
  runChunkedAiGeneration: (...args: unknown[]) => mockRunChunkedAiGeneration(...args),
  parseQuizQuestions: (...args: unknown[]) => mockParseQuizQuestions(...args),
  validateQuizQuestion: (...args: unknown[]) => mockValidateQuizQuestion(...args),
  buildQuizPrompt: (...args: unknown[]) => mockBuildQuizPrompt(...args),
  QUIZ_GENERATION_PROMPT: 'mock-quiz-prompt {questionCount} {questionTypes} {difficulty} {text}',
  COMBINE_QUIZ_QUESTIONS_PROMPT: 'mock-combine-quiz-prompt {questionCount} {text}',
  QUIZ_RETRY_PROMPT: 'mock-retry-prompt {error} {questionCount} {questionTypes} {difficulty} {text}',
  CHAT_SYSTEM_PROMPT:
    'You are a helpful assistant that answers questions about the following document. Base your answers on the document content provided. If the answer is not found in the document, say so.\n\nDocument content:\n{text}',
  getOrCreateConversation: (...args: unknown[]) => mockGetOrCreateConversation(...args),
  addMessage: (...args: unknown[]) => mockAddMessage(...args),
  listMessages: (...args: unknown[]) => mockListMessages(...args),
  deleteConversation: (...args: unknown[]) => mockDeleteConversation(...args),
  deleteConversationsByDocument: vi.fn(),
  listAllAttempts: vi.fn(() => []),
  getOverviewStats: vi.fn(() => ({})),
  getPerQuizStats: vi.fn(() => []),
  getWeakAreas: vi.fn(() => []),
  getDashboardStats: vi.fn(() => ({})),
  getRecentDocuments: vi.fn(() => []),
  getRecentQuizAttempts: vi.fn(() => []),
  getProjectsWithCounts: vi.fn(() => []),
  exportHistoryAsJson: vi.fn(async () => null),
  exportAsCsv: vi.fn(async () => null),
  listLogs: vi.fn(() => ({ logs: [], total: 0, hasMore: false })),
  getLogStatistics: vi.fn(() => ({})),
  clearLogs: vi.fn(),
  searchDocuments: vi.fn(() => ({ results: [], total: 0, hasMore: false })),
  saveRecentSearch: vi.fn(),
  listRecentSearches: vi.fn(() => []),
  clearRecentSearches: vi.fn(),
  deleteRecentSearch: vi.fn(),
  listTags: vi.fn(() => []),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  getDocumentTags: vi.fn(() => []),
  setDocumentTags: vi.fn(),
  batchGetDocumentTags: vi.fn(() => ({})),
  getTagCloud: vi.fn(() => []),
  suggestTags: vi.fn(() => []),
  listDocumentsByTags: vi.fn(() => []),
  getStorageBase: vi.fn(() => '/tmp'),
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

describe('Chat IPC Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHandle.mockReset()
    vi.resetModules()
  })

  // ─── Test 1: AI_CHAT handler happy path ────────────────────────────────

  describe('AI_CHAT handler', () => {
    it('should call getDocumentWithContent, build messages array, kick off chat() generator, and send stream events with operationType chat', async () => {
      // Arrange: document with raw_text
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 1, name: 'test.pdf' },
        content: { raw_text: 'The document talks about quantum computing.' },
        project_name: 'Test Project',
        folder_name: 'Root',
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGetOrCreateConversation.mockReturnValue({ id: 10, document_id: 1 })
      mockAddMessage.mockReturnValue({ id: 1 })
      mockListMessages.mockReturnValue([])
      mockChat.mockReturnValue(mockAsyncGenerator(['Quantum ', 'computing is ', 'fascinating.']))

      const handler = await getHandler(IPC_CHANNELS.AI_CHAT)

      // Act
      const result = await handler(
        {},
        {
          documentId: 1,
          conversationId: null,
          message: 'What is this document about?',
        },
      )

      // The handler returns success immediately (fire-and-forget)
      expect(result).toEqual({ success: true, data: undefined })

      // Wait for the background async operation to complete
      await flushPromises()

      // Assert: getDocumentWithContent was called
      expect(mockGetDocumentWithContent).toHaveBeenCalledWith(1)

      // Assert: getOrCreateConversation was called (conversationId was null)
      expect(mockGetOrCreateConversation).toHaveBeenCalledWith(1)

      // Assert: user message was saved
      expect(mockAddMessage).toHaveBeenCalledWith(10, 'user', 'What is this document about?')

      // Assert: chat() was called with messages array containing system + user message
      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'http://localhost:11434',
          model: 'llama3',
          messages: expect.arrayContaining([
            expect.objectContaining({ role: 'system' }),
            expect.objectContaining({ role: 'user', content: 'What is this document about?' }),
          ]),
        }),
      )

      // Assert: streaming events were sent with operationType 'chat'
      const streamCalls = mockSend.mock.calls.filter((c: unknown[]) => c[0] === 'ai:stream')
      expect(streamCalls.length).toBeGreaterThanOrEqual(3) // at least chunk events + done

      // Verify chunk events have operationType 'chat'
      const chunkEvent = streamCalls[0][1] as { operationType: string; chunk: string; done: boolean }
      expect(chunkEvent.operationType).toBe('chat')
      expect(chunkEvent.done).toBe(false)

      // Assert: done event was sent with conversationId in metadata
      const doneEvent = streamCalls.find((c: unknown[]) => {
        const evt = c[1] as { done: boolean }
        return evt.done === true
      })
      expect(doneEvent).toBeDefined()
      const donePayload = doneEvent![1] as { done: boolean; conversationId?: number }
      expect(donePayload.conversationId).toBe(10)

      // Assert: assistant response was saved to DB
      expect(mockAddMessage).toHaveBeenCalledWith(10, 'assistant', 'Quantum computing is fascinating.')
    })
  })

  // ─── Test 2: AI_CHAT handler error path ────────────────────────────────

  describe('AI_CHAT handler error path', () => {
    it('should send error stream event when document not found', async () => {
      mockGetDocumentWithContent.mockReturnValue(null)

      const handler = await getHandler(IPC_CHANNELS.AI_CHAT)

      const result = (await handler(
        {},
        {
          documentId: 999,
          conversationId: null,
          message: 'Hello?',
        },
      )) as { success: boolean; error?: { code: string } }

      expect(result.success).toBe(false)
      expect(result.error?.code).toBe('NOT_FOUND')
    })

    it('should send error stream event when Ollama chat() throws', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 2, name: 'test.pdf' },
        content: { raw_text: 'Document text.' },
        project_name: 'Test Project',
        folder_name: 'Root',
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGetOrCreateConversation.mockReturnValue({ id: 20, document_id: 2 })
      mockAddMessage.mockReturnValue({ id: 1 })
      mockListMessages.mockReturnValue([])

      // chat() throws an error
      mockChat.mockReturnValue(
        (async function* () {
          yield 'partial'
          throw new Error('Connection refused')
        })(),
      )

      const handler = await getHandler(IPC_CHANNELS.AI_CHAT)

      await handler(
        {},
        {
          documentId: 2,
          conversationId: 20,
          message: 'Hello?',
        },
      )
      await flushPromises()

      // Should have sent an error event via ai:stream
      const streamCalls = mockSend.mock.calls.filter((c: unknown[]) => c[0] === 'ai:stream')
      const errorEvent = streamCalls.find((c: unknown[]) => {
        const evt = c[1] as { error?: string; done: boolean }
        return evt.error !== undefined && evt.done === true
      })
      expect(errorEvent).toBeDefined()
    })
  })

  // ─── Test 3: DB_CHAT_MESSAGES_LIST handler ────────────────────────────

  describe('DB_CHAT_MESSAGES_LIST handler', () => {
    it('should return messages for a conversation', async () => {
      const mockMessages = [
        { id: 1, conversation_id: 5, role: 'user', content: 'Hello', created_at: '2026-01-01' },
        { id: 2, conversation_id: 5, role: 'assistant', content: 'Hi there!', created_at: '2026-01-01' },
      ]
      mockListMessages.mockReturnValue(mockMessages)

      const handler = await getHandler(IPC_CHANNELS.DB_CHAT_MESSAGES_LIST)

      const result = (await handler({}, 5)) as { success: boolean; data: unknown }

      expect(result.success).toBe(true)
      expect(result.data).toEqual(mockMessages)
      expect(mockListMessages).toHaveBeenCalledWith(5)
    })
  })

  // ─── Test 4: DB_CHAT_CONVERSATIONS_DELETE handler ─────────────────────

  describe('DB_CHAT_CONVERSATIONS_DELETE handler', () => {
    it('should remove conversation and return success', async () => {
      mockDeleteConversation.mockReturnValue({ id: 7, document_id: 1 })

      const handler = await getHandler(IPC_CHANNELS.DB_CHAT_CONVERSATIONS_DELETE)

      const result = (await handler({}, 7)) as { success: boolean }

      expect(result.success).toBe(true)
      expect(mockDeleteConversation).toHaveBeenCalledWith(7)
    })
  })
})
