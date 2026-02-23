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
  app: {
    getPath: vi.fn(() => '/mock/userData'),
    isPackaged: false,
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

// Mock for app:clear-cache dynamic imports
const mockDbUpdate = vi.fn(() => ({
  set: vi.fn(() => ({
    run: vi.fn(() => ({ changes: 3 })),
  })),
}))

vi.mock('@main/database/connection', () => ({
  getDb: vi.fn(() => ({
    update: mockDbUpdate,
  })),
}))

vi.mock('@main/database/schema', () => ({
  documentContent: 'documentContent',
}))

const mockSetSetting = vi.fn()
const mockGetStorageBase = vi.fn(() => '/mock/storage/files')

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
  getStorageBase: mockGetStorageBase,
  listLogs: vi.fn(() => ({ logs: [], total: 0, hasMore: false })),
  getLogStatistics: vi.fn(() => ({})),
  clearLogs: vi.fn(),
  queueDocument: vi.fn(),
  retryDocument: vi.fn(),
  checkHealth: vi.fn(),
  listModels: vi.fn(),
  generate: vi.fn(),
  getSetting: vi.fn(),
  setSetting: mockSetSetting,
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
  listTags: vi.fn(() => []),
  createTag: vi.fn(() => ({ id: 1 })),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
  getDocumentTags: vi.fn(() => []),
  setDocumentTags: vi.fn(),
  batchGetDocumentTags: vi.fn(() => ({})),
  getTagCloud: vi.fn(() => []),
  suggestTags: vi.fn(() => []),
  listDocumentsByTags: vi.fn(() => []),
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

describe('Settings and App IPC handlers', () => {
  beforeEach(() => {
    mockHandle.mockReset()
    mockSetSetting.mockReset()
    mockGetStorageBase.mockClear()
    mockDbUpdate.mockClear()
    vi.resetModules()
  })

  // ─── Settings: ALLOWED_SETTINGS extension ──────────────────────────

  it('setSetting accepts general.defaultProject key', async () => {
    mockSetSetting.mockReturnValue(undefined)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.SETTINGS_SET)
    const result = await handler({}, 'general.defaultProject', '1')

    expect(mockSetSetting).toHaveBeenCalledWith('general.defaultProject', '1')
    expect(result).toEqual({
      success: true,
      data: undefined,
    })
  })

  it('setSetting accepts onboarding.completed key', async () => {
    mockSetSetting.mockReturnValue(undefined)

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.SETTINGS_SET)
    const result = await handler({}, 'onboarding.completed', 'true')

    expect(mockSetSetting).toHaveBeenCalledWith('onboarding.completed', 'true')
    expect(result).toEqual({
      success: true,
      data: undefined,
    })
  })

  it('setSetting rejects unknown keys with error', async () => {
    mockSetSetting.mockImplementation(() => {
      throw new Error(
        'Unknown setting key: "badkey". Allowed keys: ollama.url, ollama.model, general.defaultProject, onboarding.completed',
      )
    })

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.SETTINGS_SET)
    const result = await handler({}, 'badkey', 'badvalue')

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({
        code: 'SETTINGS_SET_ERROR',
        message: expect.stringContaining('Unknown setting key'),
      }),
    })
  })

  // ─── app:get-storage-path ─────────────────────────────────────────

  it('app:get-storage-path handler returns a string path', async () => {
    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.APP_GET_STORAGE_PATH)
    const result = await handler({})

    expect(mockGetStorageBase).toHaveBeenCalled()
    expect(result).toEqual({
      success: true,
      data: '/mock/storage/files',
    })
  })

  // ─── app:clear-cache ──────────────────────────────────────────────

  it('app:clear-cache handler nulls AI content and returns deletedCount', async () => {
    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const handler = findHandler(IPC_CHANNELS.APP_CLEAR_CACHE)
    const result = await handler({})

    expect(mockDbUpdate).toHaveBeenCalledWith('documentContent')
    expect(result).toEqual({
      success: true,
      data: { deletedCount: 3 },
    })
  })
})
