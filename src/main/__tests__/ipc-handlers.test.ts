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

vi.mock('@main/services', () => ({
  listProjects: vi.fn(() => [{ id: 1, name: 'Test' }]),
  getProject: vi.fn((id: number) => (id === 1 ? { id: 1, name: 'Test' } : undefined)),
  createProject: vi.fn((data: unknown) => ({ id: 1, ...(data as object) })),
  updateProject: vi.fn((id: number, data: unknown) => ({ id, ...(data as object) })),
  deleteProject: vi.fn(),
  listFolders: vi.fn(() => []),
  createFolder: vi.fn((data: unknown) => ({ id: 1, ...(data as object) })),
  updateFolder: vi.fn((id: number, data: unknown) => ({ id, ...(data as object) })),
  deleteFolder: vi.fn(),
  listDocumentsByFolder: vi.fn(() => []),
  getDocumentWithContent: vi.fn((id: number) =>
    id === 1 ? { document: { id: 1, name: 'test.pdf' }, content: undefined } : undefined,
  ),
  createDocument: vi.fn((data: unknown) => ({ id: 1, ...(data as object) })),
  updateDocument: vi.fn((id: number, data: unknown) => ({ id, ...(data as object) })),
  deleteDocument: vi.fn(),
  listQuizzesByDocument: vi.fn(() => []),
  getQuizWithQuestions: vi.fn((id: number) =>
    id === 1 ? { quiz: { id: 1, title: 'Test Quiz' }, questions: [] } : undefined,
  ),
  createQuiz: vi.fn((data: unknown) => ({ id: 1, ...(data as object) })),
  deleteQuiz: vi.fn(),
  listAttempts: vi.fn(() => []),
  recordAttempt: vi.fn((data: unknown) => ({ id: 1, ...(data as object) })),
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('registerIpcHandlers', () => {
  beforeEach(() => {
    mockHandle.mockReset()
    vi.resetModules()
  })

  it('should register a handler for every IPC channel', async () => {
    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const registeredChannels = mockHandle.mock.calls.map((call: unknown[]) => call[0])

    // All request/response channels from IPC_CHANNELS (excluding PROGRESS which is an event)
    const expectedChannels = Object.values(IPC_CHANNELS).filter((ch) => ch !== IPC_CHANNELS.PROGRESS)

    for (const channel of expectedChannels) {
      expect(registeredChannels).toContain(channel)
    }

    expect(registeredChannels).toHaveLength(expectedChannels.length)
  })

  it('should wrap successful service results in IpcResult success format', async () => {
    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    // Find the handler registered for PROJECTS_LIST
    const projectsListCall = mockHandle.mock.calls.find((call: unknown[]) => call[0] === IPC_CHANNELS.PROJECTS_LIST)
    expect(projectsListCall).toBeDefined()

    const handler = projectsListCall![1] as (...args: unknown[]) => unknown
    const result = await handler({}) // pass mock event

    expect(result).toEqual({
      success: true,
      data: [{ id: 1, name: 'Test' }],
    })
  })

  it('should return IpcResult error when service throws', async () => {
    const services = await import('@main/services')
    vi.mocked(services.listProjects).mockImplementation(() => {
      throw new Error('Database connection failed')
    })

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const projectsListCall = mockHandle.mock.calls.find((call: unknown[]) => call[0] === IPC_CHANNELS.PROJECTS_LIST)
    const handler = projectsListCall![1] as (...args: unknown[]) => unknown
    const result = await handler({})

    expect(result).toEqual({
      success: false,
      error: {
        code: 'PROJECTS_LIST_ERROR',
        message: 'Database connection failed',
      },
    })
  })

  it('should return NOT_FOUND error for missing single-entity lookups', async () => {
    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    // getProject returns undefined for id=9999
    const projectsGetCall = mockHandle.mock.calls.find((call: unknown[]) => call[0] === IPC_CHANNELS.PROJECTS_GET)
    expect(projectsGetCall).toBeDefined()

    const handler = projectsGetCall![1] as (...args: unknown[]) => unknown
    const result = await handler({}, 9999) // mock event + non-existent id

    expect(result).toEqual({
      success: false,
      error: expect.objectContaining({
        code: 'NOT_FOUND',
        message: expect.stringContaining('9999'),
      }),
    })
  })

  it('should pass arguments to service functions correctly', async () => {
    const services = await import('@main/services')
    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    // Test PROJECTS_CREATE passes data through
    const createCall = mockHandle.mock.calls.find((call: unknown[]) => call[0] === IPC_CHANNELS.PROJECTS_CREATE)
    const handler = createCall![1] as (...args: unknown[]) => unknown
    await handler({}, { name: 'New Project' })

    expect(services.createProject).toHaveBeenCalledWith({ name: 'New Project' })
  })

  it('should handle the PING channel and return pong', async () => {
    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const pingCall = mockHandle.mock.calls.find((call: unknown[]) => call[0] === IPC_CHANNELS.PING)
    expect(pingCall).toBeDefined()

    const handler = pingCall![1] as (...args: unknown[]) => unknown
    const result = await handler({})

    expect(result).toBe('pong')
  })

  it('should handle unknown error types gracefully', async () => {
    const services = await import('@main/services')
    vi.mocked(services.listProjects).mockImplementation(() => {
      throw 'string error' // non-Error throw
    })

    const { registerIpcHandlers } = await import('@main/ipc-handlers')
    registerIpcHandlers()

    const projectsListCall = mockHandle.mock.calls.find((call: unknown[]) => call[0] === IPC_CHANNELS.PROJECTS_LIST)
    const handler = projectsListCall![1] as (...args: unknown[]) => unknown
    const result = await handler({})

    expect(result).toEqual({
      success: false,
      error: {
        code: 'PROJECTS_LIST_ERROR',
        message: 'Unknown error',
      },
    })
  })
})
