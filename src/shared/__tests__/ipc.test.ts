import { describe, expect, it } from 'vitest'
import { IPC_CHANNELS, createIpcSuccess, createIpcError } from '../ipc'
import type { IpcResult, IpcChannelMap } from '../ipc'
import type { DocumentContentDto, AiStreamEvent } from '../types'

describe('IPC_CHANNELS', () => {
  it('should have the expected number of channel entries', () => {
    const channelKeys = Object.keys(IPC_CHANNELS)
    // ping + 5 projects + 4 folders + 6 documents + 4 quizzes + 2 quiz-attempts + 3 files + 2 parsing + 6 ai + 3 settings + 1 progress = 37
    expect(channelKeys).toHaveLength(37)
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

describe('Frontend type contracts for document summarization/extraction', () => {
  it('DocumentContentDto type should include key_terms and summary_style fields', () => {
    // TypeScript compilation test: if these fields are missing, this test file won't compile
    const content: DocumentContentDto = {
      id: 1,
      document_id: 1,
      raw_text: 'Some text',
      summary: 'A summary',
      key_points: ['point 1'],
      key_terms: [{ term: 'React', definition: 'A JavaScript library' }],
      summary_style: 'brief',
      processed_at: '2026-01-01T00:00:00Z',
    }

    expect(content.key_terms).toBeDefined()
    expect(content.key_terms![0].term).toBe('React')
    expect(content.key_terms![0].definition).toBe('A JavaScript library')
    expect(content.summary_style).toBe('brief')
  })

  it('AiStreamEvent with operationType key_terms should compile with chunk progress fields', () => {
    // TypeScript compilation test: operationType 'key_terms' and chunk progress fields
    const event: AiStreamEvent = {
      documentId: 1,
      operationType: 'key_terms',
      chunk: '{"term": "React"}',
      done: false,
      chunkIndex: 2,
      totalChunks: 5,
    }

    expect(event.operationType).toBe('key_terms')
    expect(event.chunkIndex).toBe(2)
    expect(event.totalChunks).toBe(5)
  })

  it('IpcChannelMap ai:summarize should accept optional style parameter in args', () => {
    // TypeScript compilation test: verify the args signature accepts optional style
    type SummarizeArgs = IpcChannelMap['ai:summarize']['args']

    // The second arg should be optional with a style property
    const argsWithStyle: SummarizeArgs = [42, { style: 'academic' }]
    const argsWithoutOptions: SummarizeArgs = [42]

    expect(argsWithStyle[0]).toBe(42)
    expect(argsWithStyle[1]?.style).toBe('academic')
    expect(argsWithoutOptions).toHaveLength(1)
  })

  it('IpcChannelMap ai:extract-key-terms should exist with correct args signature', () => {
    // TypeScript compilation test: verify the channel exists and accepts documentId
    type ExtractKeyTermsArgs = IpcChannelMap['ai:extract-key-terms']['args']

    const args: ExtractKeyTermsArgs = [42]
    expect(args[0]).toBe(42)

    // Also verify the channel constant exists
    expect(IPC_CHANNELS.AI_EXTRACT_KEY_TERMS).toBe('ai:extract-key-terms')
  })

  it('DocumentContentDto with null key_terms and summary_style should be valid', () => {
    // Verify the type accepts null for the new optional fields
    const content: DocumentContentDto = {
      id: 1,
      document_id: 1,
      raw_text: 'Some text',
      summary: null,
      key_points: null,
      key_terms: null,
      summary_style: null,
      processed_at: null,
    }

    // All nullable fields should be null
    expect(content.key_terms).toBeNull()
    expect(content.summary_style).toBeNull()
    expect(content.summary).toBeNull()
    expect(content.key_points).toBeNull()
    expect(content.processed_at).toBeNull()
  })
})
