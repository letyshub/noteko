import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { IpcResult } from '@shared/ipc'
import type { TagDto, CreateTagInput } from '@shared/types'

// Mock electronAPI before importing the store
const mockElectronAPI = {
  'db:tags:list': vi.fn(),
  'db:tags:create': vi.fn(),
  'db:tags:update': vi.fn(),
  'db:tags:delete': vi.fn(),
  'db:tags:cloud': vi.fn(),
  'db:document-tags:get': vi.fn(),
  'db:document-tags:set': vi.fn(),
  'db:document-tags:batch-get': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Import store after mock is set up
const { useTagStore } = await import('../tag-store')

const mockTag: TagDto = {
  id: 1,
  name: 'JavaScript',
  color: '#eab308',
  created_at: '2026-01-01T00:00:00Z',
}

const mockTag2: TagDto = {
  id: 2,
  name: 'React',
  color: '#3b82f6',
  created_at: '2026-01-02T00:00:00Z',
}

describe('useTagStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state between tests
    useTagStore.setState({
      tags: [],
      tagCloud: [],
      loading: false,
      error: null,
    })
  })

  describe('fetchTags', () => {
    it('should fetch tags and populate the tags list from IPC', async () => {
      const result: IpcResult<TagDto[]> = {
        success: true,
        data: [mockTag, mockTag2],
      }
      mockElectronAPI['db:tags:list'].mockResolvedValue(result)

      await act(async () => {
        await useTagStore.getState().fetchTags()
      })

      const state = useTagStore.getState()
      expect(state.tags).toEqual([mockTag, mockTag2])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:tags:list']).toHaveBeenCalledOnce()
    })
  })

  describe('createTag', () => {
    it('should create a tag and add it to the store state', async () => {
      const input: CreateTagInput = { name: 'TypeScript', color: '#3b82f6' }
      const createdTag: TagDto = {
        id: 3,
        name: 'TypeScript',
        color: '#3b82f6',
        created_at: '2026-01-03T00:00:00Z',
      }
      const result: IpcResult<TagDto> = { success: true, data: createdTag }
      mockElectronAPI['db:tags:create'].mockResolvedValue(result)

      // Pre-populate with existing tags
      useTagStore.setState({ tags: [mockTag] })

      await act(async () => {
        await useTagStore.getState().createTag(input)
      })

      const state = useTagStore.getState()
      expect(state.tags).toEqual([mockTag, createdTag])
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:tags:create']).toHaveBeenCalledWith(input)
    })
  })
})
