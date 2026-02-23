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

const mockSearchDocuments = vi.fn()
const mockSaveRecentSearch = vi.fn()
const mockListRecentSearches = vi.fn()
const mockClearRecentSearches = vi.fn()
const mockDeleteRecentSearch = vi.fn()

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
  // Search service mocks (the focus of this test)
  searchDocuments: mockSearchDocuments,
  saveRecentSearch: mockSaveRecentSearch,
  listRecentSearches: mockListRecentSearches,
  clearRecentSearches: mockClearRecentSearches,
  deleteRecentSearch: mockDeleteRecentSearch,
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

describe('Search IPC handlers', () => {
  beforeEach(() => {
    mockHandle.mockReset()
    mockSearchDocuments.mockReset()
    mockSaveRecentSearch.mockReset()
    mockListRecentSearches.mockReset()
    mockClearRecentSearches.mockReset()
    mockDeleteRecentSearch.mockReset()
    vi.resetModules()
  })

  it('DOCUMENTS_SEARCH handler returns IpcResult<SearchListResultDto> with correct shape', async () => {
    const mockResult = {
      results: [
        {
          documentId: 1,
          documentName: 'test.pdf',
          projectName: 'My Project',
          fileType: 'pdf',
          snippet: 'highlighted <mark>text</mark>',
          createdAt: '2026-02-23T00:00:00.000Z',
          processingStatus: 'completed' as const,
          matchType: 'content' as const,
        },
      ],
      total: 1,
      hasMore: false,
    }
    mockSearchDocuments.mockReturnValue(mockResult)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.DOCUMENTS_SEARCH)
    const result = await handler({}, { query: 'test', projectId: 1 })

    expect(mockSearchDocuments).toHaveBeenCalledWith({ query: 'test', projectId: 1 })
    expect(result).toEqual({
      success: true,
      data: mockResult,
    })
  })

  it('DOCUMENTS_SEARCH handler returns createIpcError on service exception', async () => {
    mockSearchDocuments.mockImplementation(() => {
      throw new Error('FTS5 table not found')
    })

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.DOCUMENTS_SEARCH)
    const result = await handler({}, { query: 'test' })

    expect(result).toEqual({
      success: false,
      error: {
        code: 'DOCUMENTS_SEARCH_ERROR',
        message: 'FTS5 table not found',
      },
    })
  })

  it('SEARCH_RECENT_LIST handler returns IpcResult<RecentSearchDto[]>', async () => {
    const mockRecent = [
      { id: 1, query: 'react hooks', resultCount: 5, searchedAt: '2026-02-23T00:00:00.000Z' },
      { id: 2, query: 'typescript', resultCount: 3, searchedAt: '2026-02-22T00:00:00.000Z' },
    ]
    mockListRecentSearches.mockReturnValue(mockRecent)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.SEARCH_RECENT_LIST)
    const result = await handler({})

    expect(mockListRecentSearches).toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      data: mockRecent,
    })
  })

  it('SEARCH_RECENT_SAVE handler calls service and returns success', async () => {
    mockSaveRecentSearch.mockReturnValue(undefined)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.SEARCH_RECENT_SAVE)
    const result = await handler({}, 'react hooks', 5)

    expect(mockSaveRecentSearch).toHaveBeenCalledWith('react hooks', 5)
    expect(result).toEqual({
      success: true,
      data: undefined,
    })
  })
})
