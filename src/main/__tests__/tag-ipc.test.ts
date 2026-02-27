import { describe, it, expect, vi, beforeEach } from 'vitest'
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

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@main/main-window', () => ({
  getMainWindow: vi.fn(),
}))

vi.mock('@main/services/ai-prompts', () => ({
  KEY_POINTS_PROMPT: '',
  KEY_TERMS_PROMPT: '',
  DEFAULT_OLLAMA_MODEL: 'llama3',
  RAW_TEXT_MAX_LENGTH: 10000,
  COMBINE_SUMMARIES_PROMPT: '',
  COMBINE_KEY_POINTS_PROMPT: '',
  COMBINE_KEY_TERMS_PROMPT: '',
  QUIZ_GENERATION_PROMPT: '',
  COMBINE_QUIZ_QUESTIONS_PROMPT: '',
  QUIZ_RETRY_PROMPT: '',
  getSummaryPrompt: vi.fn(() => ''),
}))

vi.mock('@main/services/chunking-service', () => ({
  CHUNK_SIZE: 5000,
  splitTextIntoChunks: vi.fn(),
  runChunkedAiGeneration: vi.fn(),
}))

const mockCreateTag = vi.fn()
const mockDeleteTag = vi.fn()
const mockSetDocumentTags = vi.fn()
const mockListDocumentsByTags = vi.fn()

vi.mock('@main/services', () => ({
  // Existing service mocks (required for ipc-handlers to register all handlers)
  listProjects: vi.fn(() => []),
  getProject: vi.fn(),
  createProject: vi.fn(() => ({ id: 1 })),
  updateProject: vi.fn(),
  deleteProject: vi.fn(),
  cascadeDeleteProject: vi.fn(),
  listFolders: vi.fn(() => []),
  createFolder: vi.fn(() => ({ id: 1 })),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
  cascadeDeleteFolder: vi.fn(),
  listDocumentsByProject: vi.fn(() => []),
  listDocumentsByFolder: vi.fn(() => []),
  getDocumentWithContent: vi.fn(),
  createDocument: vi.fn(() => ({ id: 1 })),
  updateDocument: vi.fn(),
  deleteDocument: vi.fn(),
  saveDocumentContent: vi.fn(),
  listQuizzesByDocument: vi.fn(() => []),
  getQuizWithQuestions: vi.fn(),
  createQuiz: vi.fn(() => ({ id: 1 })),
  deleteQuiz: vi.fn(),
  listAttempts: vi.fn(() => []),
  recordAttempt: vi.fn(() => ({ id: 1 })),
  listAllAttempts: vi.fn(() => []),
  getOverviewStats: vi.fn(() => ({})),
  getPerQuizStats: vi.fn(() => []),
  getWeakAreas: vi.fn(() => []),
  getDashboardStats: vi.fn(() => ({})),
  getRecentDocuments: vi.fn(() => []),
  getRecentQuizAttempts: vi.fn(() => []),
  getProjectsWithCounts: vi.fn(() => []),
  validateFile: vi.fn(),
  copyFileToStorage: vi.fn(),
  openFilePickerDialog: vi.fn(),
  deleteFileFromStorage: vi.fn(),
  exportHistoryAsJson: vi.fn(),
  exportAsCsv: vi.fn(),
  listLogs: vi.fn(() => ({ logs: [], total: 0, hasMore: false })),
  getLogStatistics: vi.fn(() => ({})),
  clearLogs: vi.fn(),
  queueDocument: vi.fn(),
  retryDocument: vi.fn(),
  checkHealth: vi.fn(),
  listModels: vi.fn(),
  generate: vi.fn(),
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  getAllSettings: vi.fn(),
  splitTextIntoChunks: vi.fn(),
  runChunkedAiGeneration: vi.fn(),
  parseQuizQuestions: vi.fn(),
  validateQuizQuestion: vi.fn(),
  buildQuizPrompt: vi.fn(),
  searchDocuments: vi.fn(() => ({ results: [], total: 0, hasMore: false })),
  saveRecentSearch: vi.fn(),
  listRecentSearches: vi.fn(() => []),
  clearRecentSearches: vi.fn(),
  deleteRecentSearch: vi.fn(),
  // Tag service mocks (the focus of this test)
  listTags: vi.fn(() => []),
  createTag: mockCreateTag,
  updateTag: vi.fn(),
  deleteTag: mockDeleteTag,
  getDocumentTags: vi.fn(() => []),
  setDocumentTags: mockSetDocumentTags,
  batchGetDocumentTags: vi.fn(() => ({})),
  getTagCloud: vi.fn(() => []),
  suggestTags: vi.fn(() => []),
  listDocumentsByTags: mockListDocumentsByTags,
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Find the handler function registered for a given IPC channel.
 */
function findHandler(channel: string): (...args: unknown[]) => unknown {
  const call = mockHandle.mock.calls.find((c: unknown[]) => c[0] === channel)
  if (!call) throw new Error(`No handler registered for channel: ${channel}`)
  return call[1] as (...args: unknown[]) => unknown
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Tag IPC handlers', () => {
  beforeEach(() => {
    mockHandle.mockReset()
    mockCreateTag.mockReset()
    mockDeleteTag.mockReset()
    mockSetDocumentTags.mockReset()
    mockListDocumentsByTags.mockReset()
    vi.resetModules()
  })

  it('TAGS_CREATE handler returns IpcResult with created tag', async () => {
    const mockTag = { id: 1, name: 'Biology', color: '#22c55e', created_at: '2026-02-23T00:00:00.000Z' }
    mockCreateTag.mockReturnValue(mockTag)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.TAGS_CREATE)
    const result = await handler({}, { name: 'Biology', color: '#22c55e' })

    expect(mockCreateTag).toHaveBeenCalledWith({ name: 'Biology', color: '#22c55e' })
    expect(result).toEqual({
      success: true,
      data: mockTag,
    })
  })

  it('TAGS_DELETE handler returns IpcResult with affected document count', async () => {
    const mockDeleteResult = {
      tag: { id: 3, name: 'Old Tag', color: null, created_at: '2026-02-20T00:00:00.000Z' },
      affectedDocumentCount: 5,
    }
    mockDeleteTag.mockReturnValue(mockDeleteResult)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.TAGS_DELETE)
    const result = await handler({}, 3)

    expect(mockDeleteTag).toHaveBeenCalledWith(3)
    expect(result).toEqual({
      success: true,
      data: { affectedDocumentCount: 5 },
    })
  })

  it('DOCUMENT_TAGS_SET handler accepts SetDocumentTagsInput and returns success', async () => {
    mockSetDocumentTags.mockReturnValue(undefined)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.DOCUMENT_TAGS_SET)
    const input = { document_id: 42, tag_ids: [1, 2, 3] }
    const result = await handler({}, input)

    expect(mockSetDocumentTags).toHaveBeenCalledWith(42, [1, 2, 3])
    expect(result).toEqual({
      success: true,
      data: undefined,
    })
  })

  it('DOCUMENTS_BY_TAGS handler returns filtered documents via IpcResult', async () => {
    const mockDocs = [
      {
        id: 1,
        name: 'biology-notes.pdf',
        file_path: '/storage/1/biology-notes.pdf',
        file_type: 'pdf',
        file_size: 1024,
        folder_id: 1,
        project_id: 1,
        processing_status: 'completed',
        created_at: '2026-02-23T00:00:00.000Z',
        updated_at: '2026-02-23T00:00:00.000Z',
      },
    ]
    mockListDocumentsByTags.mockReturnValue(mockDocs)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.DOCUMENTS_BY_TAGS)
    const result = await handler({}, [1, 2])

    expect(mockListDocumentsByTags).toHaveBeenCalledWith([1, 2])
    expect(result).toEqual({
      success: true,
      data: mockDocs,
    })
  })
})
