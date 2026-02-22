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
const mockSplitTextIntoChunks = vi.fn()
const mockRunChunkedAiGeneration = vi.fn()

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
  retryDocument: vi.fn(),
  checkHealth: vi.fn(async () => ({ connected: true, models: ['llama3'] })),
  listModels: vi.fn(async () => []),
  generate: (...args: unknown[]) => mockGenerate(...args),
  saveDocumentContent: (...args: unknown[]) => mockSaveDocumentContent(...args),
  getSetting: (...args: unknown[]) => mockGetSetting(...args),
  setSetting: vi.fn(),
  getAllSettings: vi.fn(() => ({})),
  splitTextIntoChunks: (...args: unknown[]) => mockSplitTextIntoChunks(...args),
  runChunkedAiGeneration: (...args: unknown[]) => mockRunChunkedAiGeneration(...args),
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

// ---------------------------------------------------------------------------
// Group 3: Style-variant summarization, chunking, and key terms extraction
// ---------------------------------------------------------------------------

describe('AI Document Operations (Group 3 — Prompts & IPC Handlers)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockHandle.mockReset()
    vi.resetModules()
  })

  // ─── Test 1: ai:summarize with style parameter ──────────────────────

  describe('AI_SUMMARIZE with style parameter', () => {
    it('should pass correct style-variant prompt to generate when style is provided', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 10, name: 'test.pdf' },
        content: { raw_text: 'Short document text.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGenerate.mockReturnValue(mockAsyncGenerator(['A detailed summary.']))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)

      // Act: pass style 'detailed'
      await handler({}, 10, { style: 'detailed' })
      await flushPromises()

      // Assert: generate was called with a prompt containing the detailed instruction
      const generateCall = mockGenerate.mock.calls[0][0] as { prompt: string }
      expect(generateCall.prompt).toContain('detailed summary')
      expect(generateCall.prompt).toContain('5-7 paragraphs')
    })
  })

  // ─── Test 2: ai:summarize without style defaults to 'brief' ────────

  describe('AI_SUMMARIZE default style', () => {
    it('should default to brief style when no style option is provided', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 11, name: 'test.pdf' },
        content: { raw_text: 'Short document text.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGenerate.mockReturnValue(mockAsyncGenerator(['Brief summary.']))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)

      // Act: no options passed
      await handler({}, 11)
      await flushPromises()

      // Assert: generate was called with the brief-style prompt (2-3 concise paragraphs)
      const generateCall = mockGenerate.mock.calls[0][0] as { prompt: string }
      expect(generateCall.prompt).toContain('2-3 concise paragraphs')
    })
  })

  // ─── Test 3: ai:summarize with long document uses chunking ─────────

  describe('AI_SUMMARIZE chunking for long documents', () => {
    it('should use chunked generation when document exceeds CHUNK_SIZE', async () => {
      const longText = 'x'.repeat(7000)
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 12, name: 'long.pdf' },
        content: { raw_text: longText },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      // splitTextIntoChunks returns 2 chunks
      mockSplitTextIntoChunks.mockReturnValue(['chunk1-text', 'chunk2-text'])
      // runChunkedAiGeneration resolves successfully
      mockRunChunkedAiGeneration.mockResolvedValue(undefined)

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)

      // Act
      await handler({}, 12)
      await flushPromises()

      // Assert: splitTextIntoChunks was called with the long text
      expect(mockSplitTextIntoChunks).toHaveBeenCalledWith(longText)

      // Assert: runChunkedAiGeneration was called (not runAiGeneration / generate)
      expect(mockRunChunkedAiGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 12,
          operationType: 'summary',
          model: 'llama3',
          chunks: ['chunk1-text', 'chunk2-text'],
        }),
      )

      // Assert: direct generate was NOT called (chunked path used instead)
      expect(mockGenerate).not.toHaveBeenCalled()
    })
  })

  // ─── Test 4: ai:extract-key-terms parses JSON and saves ────────────

  describe('AI_EXTRACT_KEY_TERMS handler', () => {
    it('should stream chunks, parse JSON result, and save key_terms to document_content', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 13, name: 'terms.pdf' },
        content: { raw_text: 'Document with terminology.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      const jsonResult = JSON.stringify([
        { term: 'AI', definition: 'Artificial Intelligence' },
        { term: 'LLM', definition: 'Large Language Model' },
      ])
      mockGenerate.mockReturnValue(mockAsyncGenerator([jsonResult]))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_EXTRACT_KEY_TERMS)

      // Act
      const result = await handler({}, 13)
      expect(result).toEqual({ success: true, data: undefined })

      await flushPromises()

      // Assert: key_terms were parsed from JSON and saved
      expect(mockSaveDocumentContent).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 13,
          key_terms: [
            { term: 'AI', definition: 'Artificial Intelligence' },
            { term: 'LLM', definition: 'Large Language Model' },
          ],
        }),
      )
    })
  })

  // ─── Test 5: ai:extract-key-terms with invalid JSON falls back ─────

  describe('AI_EXTRACT_KEY_TERMS fallback parsing', () => {
    it('should fall back to line-by-line parsing when JSON is invalid', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 14, name: 'terms2.pdf' },
        content: { raw_text: 'Document with terms.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      // LLM returns non-JSON text (line-by-line format)
      const lineResult = 'AI: Artificial Intelligence\nLLM - Large Language Model\nNLP: Natural Language Processing'
      mockGenerate.mockReturnValue(mockAsyncGenerator([lineResult]))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_EXTRACT_KEY_TERMS)

      // Act
      await handler({}, 14)
      await flushPromises()

      // Assert: key_terms were parsed from line-by-line format
      expect(mockSaveDocumentContent).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 14,
          key_terms: expect.arrayContaining([
            expect.objectContaining({ term: 'AI', definition: 'Artificial Intelligence' }),
            expect.objectContaining({ term: 'LLM', definition: 'Large Language Model' }),
            expect.objectContaining({ term: 'NLP', definition: 'Natural Language Processing' }),
          ]),
        }),
      )
    })
  })

  // ─── Test 6: ai:summarize saves summary_style alongside summary ────

  describe('AI_SUMMARIZE saves summary_style', () => {
    it('should save summary_style alongside summary in saveDocumentContent', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 15, name: 'styled.pdf' },
        content: { raw_text: 'Short document text.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGenerate.mockReturnValue(mockAsyncGenerator(['An academic abstract.']))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)

      // Act: pass style 'academic'
      await handler({}, 15, { style: 'academic' })
      await flushPromises()

      // Assert: saveDocumentContent was called with both summary and summary_style
      expect(mockSaveDocumentContent).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 15,
          summary: 'An academic abstract.',
          summary_style: 'academic',
        }),
      )
    })
  })

  // ─── Test 7: ai:summarize with 'academic' uses correct prompt ─────

  describe('AI_SUMMARIZE with academic style prompt', () => {
    it('should use academic prompt template containing formal language instructions', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 20, name: 'paper.pdf' },
        content: { raw_text: 'Short document text.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGenerate.mockReturnValue(mockAsyncGenerator(['Academic output.']))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)

      // Act: pass style 'academic'
      await handler({}, 20, { style: 'academic' })
      await flushPromises()

      // Assert: generate was called with a prompt containing the academic instruction
      const generateCall = mockGenerate.mock.calls[0][0] as { prompt: string }
      expect(generateCall.prompt).toContain('academic abstract')
      expect(generateCall.prompt).toContain('formal language')
    })
  })

  // ─── Test 8: ai:extract-key-terms with completely malformed output ─

  describe('AI_EXTRACT_KEY_TERMS with malformed output', () => {
    it('should save empty key_terms array when LLM returns completely unparseable garbage', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 21, name: 'garbage.pdf' },
        content: { raw_text: 'Document text.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      // LLM returns garbage that is not JSON and has no "term: definition" patterns
      const garbageOutput = 'I cannot extract terms from this document. Please try again later.'
      mockGenerate.mockReturnValue(mockAsyncGenerator([garbageOutput]))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_EXTRACT_KEY_TERMS)

      // Act
      await handler({}, 21)
      await flushPromises()

      // Assert: saveDocumentContent was called with key_terms as empty array
      // (since the text has no parseable "term: definition" or JSON patterns)
      expect(mockSaveDocumentContent).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 21,
          key_terms: expect.any(Array),
        }),
      )

      // The resulting array should be empty (no valid term-definition pairs in the garbage)
      const savedKeyTerms = (mockSaveDocumentContent.mock.calls[0][0] as { key_terms: unknown[] }).key_terms
      expect(savedKeyTerms).toEqual([])
    })
  })

  // ─── Test 9: ai:summarize backward compat (undefined options) ─────

  describe('AI_SUMMARIZE backward compatibility', () => {
    it('should work when called with only documentId and no options argument at all', async () => {
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 22, name: 'old-api.pdf' },
        content: { raw_text: 'Some text for backward compat test.' },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockGenerate.mockReturnValue(mockAsyncGenerator(['Brief result.']))
      mockSaveDocumentContent.mockReturnValue({ id: 1 })

      const handler = await getHandler(IPC_CHANNELS.AI_SUMMARIZE)

      // Act: call with NO third argument (backward compatible call)
      await handler({}, 22, undefined)
      await flushPromises()

      // Assert: should succeed and default to brief style
      expect(mockGenerate).toHaveBeenCalled()
      const generateCall = mockGenerate.mock.calls[0][0] as { prompt: string }
      expect(generateCall.prompt).toContain('2-3 concise paragraphs')

      // Assert: summary should be saved
      expect(mockSaveDocumentContent).toHaveBeenCalledWith(
        expect.objectContaining({
          document_id: 22,
          summary: 'Brief result.',
        }),
      )
    })
  })

  // ─── Test 10: ai:extract-key-terms with chunked long document ─────

  describe('AI_EXTRACT_KEY_TERMS chunking for long documents', () => {
    it('should use chunked generation with correct key terms prompts when document exceeds CHUNK_SIZE', async () => {
      const longText = 'y'.repeat(7000)
      mockGetDocumentWithContent.mockReturnValue({
        document: { id: 23, name: 'long-terms.pdf' },
        content: { raw_text: longText },
      })

      mockGetSetting.mockImplementation((key: string) => {
        if (key === 'ollama.url') return 'http://localhost:11434'
        if (key === 'ollama.model') return 'llama3'
        return null
      })

      mockSplitTextIntoChunks.mockReturnValue(['chunk-a', 'chunk-b'])
      mockRunChunkedAiGeneration.mockResolvedValue(undefined)

      const handler = await getHandler(IPC_CHANNELS.AI_EXTRACT_KEY_TERMS)

      // Act
      await handler({}, 23)
      await flushPromises()

      // Assert: splitTextIntoChunks was called with the long text
      expect(mockSplitTextIntoChunks).toHaveBeenCalledWith(longText)

      // Assert: runChunkedAiGeneration was called with key_terms operation type
      expect(mockRunChunkedAiGeneration).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 23,
          operationType: 'key_terms',
          chunks: ['chunk-a', 'chunk-b'],
        }),
      )

      // Assert: direct generate was NOT called
      expect(mockGenerate).not.toHaveBeenCalled()
    })
  })
})
