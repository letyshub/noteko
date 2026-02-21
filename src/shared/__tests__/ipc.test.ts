import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS, createIpcSuccess, createIpcError } from '../ipc'
import type { IpcResult } from '../ipc'

describe('IPC_CHANNELS', () => {
  it('should have the expected number of channel entries', () => {
    const channelKeys = Object.keys(IPC_CHANNELS)
    // ping + 5 projects + 4 folders + 6 documents + 4 quizzes + 2 quiz-attempts + 3 files + 2 parsing + 4 ai + 3 settings + 1 progress = 35
    expect(channelKeys).toHaveLength(35)
  })

  it('should include the ping channel for backward compatibility', () => {
    expect(IPC_CHANNELS.PING).toBe('ping')
  })

  it('should include all project CRUD channels', () => {
    expect(IPC_CHANNELS.PROJECTS_LIST).toBe('db:projects:list')
    expect(IPC_CHANNELS.PROJECTS_GET).toBe('db:projects:get')
    expect(IPC_CHANNELS.PROJECTS_CREATE).toBe('db:projects:create')
    expect(IPC_CHANNELS.PROJECTS_UPDATE).toBe('db:projects:update')
    expect(IPC_CHANNELS.PROJECTS_DELETE).toBe('db:projects:delete')
  })

  it('should include all folder CRUD channels', () => {
    expect(IPC_CHANNELS.FOLDERS_LIST).toBe('db:folders:list')
    expect(IPC_CHANNELS.FOLDERS_CREATE).toBe('db:folders:create')
    expect(IPC_CHANNELS.FOLDERS_UPDATE).toBe('db:folders:update')
    expect(IPC_CHANNELS.FOLDERS_DELETE).toBe('db:folders:delete')
  })

  it('should include all document CRUD channels', () => {
    expect(IPC_CHANNELS.DOCUMENTS_LIST).toBe('db:documents:list')
    expect(IPC_CHANNELS.DOCUMENTS_GET).toBe('db:documents:get')
    expect(IPC_CHANNELS.DOCUMENTS_CREATE).toBe('db:documents:create')
    expect(IPC_CHANNELS.DOCUMENTS_UPDATE).toBe('db:documents:update')
    expect(IPC_CHANNELS.DOCUMENTS_DELETE).toBe('db:documents:delete')
  })

  it('should include all quiz channels', () => {
    expect(IPC_CHANNELS.QUIZZES_LIST).toBe('db:quizzes:list')
    expect(IPC_CHANNELS.QUIZZES_GET).toBe('db:quizzes:get')
    expect(IPC_CHANNELS.QUIZZES_CREATE).toBe('db:quizzes:create')
    expect(IPC_CHANNELS.QUIZZES_DELETE).toBe('db:quizzes:delete')
  })

  it('should include quiz attempt channels', () => {
    expect(IPC_CHANNELS.QUIZ_ATTEMPTS_LIST).toBe('db:quiz-attempts:list')
    expect(IPC_CHANNELS.QUIZ_ATTEMPTS_CREATE).toBe('db:quiz-attempts:create')
  })

  it('should include event channels', () => {
    expect(IPC_CHANNELS.PROGRESS).toBe('app:progress')
  })

  it('should have unique channel values (no duplicates)', () => {
    const values = Object.values(IPC_CHANNELS)
    const uniqueValues = new Set(values)
    expect(uniqueValues.size).toBe(values.length)
  })
})

describe('IpcResult helpers', () => {
  it('createIpcSuccess should wrap data in a success result', () => {
    const result = createIpcSuccess({ id: 1, name: 'Test' })
    expect(result.success).toBe(true)
    expect(result).toEqual({
      success: true,
      data: { id: 1, name: 'Test' },
    })
  })

  it('createIpcSuccess should work with primitive types', () => {
    const result = createIpcSuccess('pong')
    expect(result.success).toBe(true)
    expect(result).toEqual({ success: true, data: 'pong' })
  })

  it('createIpcSuccess should work with arrays', () => {
    const items = [{ id: 1 }, { id: 2 }]
    const result = createIpcSuccess(items)
    expect(result.success).toBe(true)
    expect(result).toEqual({ success: true, data: items })
  })

  it('createIpcError should create an error result with code and message', () => {
    const result = createIpcError('NOT_FOUND', 'Project not found')
    expect(result.success).toBe(false)
    expect(result).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Project not found' },
    })
  })

  it('createIpcError should support optional details', () => {
    const details = { entityId: 42 }
    const result = createIpcError('NOT_FOUND', 'Project not found', details)
    expect(result.success).toBe(false)
    expect(result).toEqual({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Project not found',
        details: { entityId: 42 },
      },
    })
  })

  it('IpcResult type should discriminate on success field', () => {
    // Runtime type-check: verify the discriminated union works
    const successResult: IpcResult<string> = createIpcSuccess('hello')
    const errorResult: IpcResult<string> = createIpcError('ERR', 'fail')

    if (successResult.success) {
      // TypeScript should narrow to { success: true; data: string }
      expect(typeof successResult.data).toBe('string')
    }

    if (!errorResult.success) {
      // TypeScript should narrow to { success: false; error: IpcError }
      expect(errorResult.error.code).toBe('ERR')
      expect(errorResult.error.message).toBe('fail')
    }
  })
})
