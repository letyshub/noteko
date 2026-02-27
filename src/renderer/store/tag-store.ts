import { create } from 'zustand'
import type { TagDto, TagCloudItemDto, CreateTagInput, UpdateTagInput } from '@shared/types'

interface TagStore {
  tags: TagDto[]
  tagCloud: TagCloudItemDto[]
  loading: boolean
  error: string | null

  fetchTags: () => Promise<void>
  fetchTagCloud: () => Promise<void>
  createTag: (input: CreateTagInput) => Promise<TagDto | null>
  updateTag: (id: number, input: UpdateTagInput) => Promise<void>
  deleteTag: (id: number) => Promise<void>

  getDocumentTags: (docId: number) => Promise<TagDto[]>
  setDocumentTags: (docId: number, tagIds: number[]) => Promise<void>
  batchGetDocumentTags: (docIds: number[]) => Promise<Record<number, TagDto[]>>
}

export const useTagStore = create<TagStore>((set) => ({
  tags: [],
  tagCloud: [],
  loading: false,
  error: null,

  fetchTags: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.electronAPI['db:tags:list']()
      if (result.success) {
        set({ tags: result.data, loading: false })
      } else {
        set({ error: result.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false })
    }
  },

  fetchTagCloud: async () => {
    set({ loading: true, error: null })
    try {
      const result = await window.electronAPI['db:tags:cloud']()
      if (result.success) {
        set({ tagCloud: result.data, loading: false })
      } else {
        set({ error: result.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false })
    }
  },

  createTag: async (input) => {
    try {
      const result = await window.electronAPI['db:tags:create'](input)
      if (result.success) {
        set((state) => ({ tags: [...state.tags, result.data] }))
        return result.data
      } else {
        set({ error: result.error.message })
        return null
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
      return null
    }
  },

  updateTag: async (id, input) => {
    try {
      const result = await window.electronAPI['db:tags:update'](id, input)
      if (result.success) {
        set((state) => ({
          tags: state.tags.map((t) => (t.id === id ? result.data : t)),
        }))
      } else {
        set({ error: result.error.message })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  },

  deleteTag: async (id) => {
    try {
      const result = await window.electronAPI['db:tags:delete'](id)
      if (result.success) {
        set((state) => ({ tags: state.tags.filter((t) => t.id !== id) }))
      } else {
        set({ error: result.error.message })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  },

  getDocumentTags: async (docId) => {
    try {
      const result = await window.electronAPI['db:document-tags:get'](docId)
      if (result.success) {
        return result.data
      } else {
        set({ error: result.error.message })
        return []
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
      return []
    }
  },

  setDocumentTags: async (docId, tagIds) => {
    try {
      const result = await window.electronAPI['db:document-tags:set']({
        document_id: docId,
        tag_ids: tagIds,
      })
      if (!result.success) {
        set({ error: result.error.message })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  },

  batchGetDocumentTags: async (docIds) => {
    try {
      const result = await window.electronAPI['db:document-tags:batch-get'](docIds)
      if (result.success) {
        return result.data
      } else {
        set({ error: result.error.message })
        return {}
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
      return {}
    }
  },
}))
