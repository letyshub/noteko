import { create } from 'zustand'
import type { FolderDto, CreateFolderInput, UpdateFolderInput } from '@shared/types'

interface FolderStore {
  folders: FolderDto[]
  loading: boolean
  error: string | null

  fetchFolders: (projectId: number) => Promise<void>
  createFolder: (input: CreateFolderInput) => Promise<void>
  updateFolder: (id: number, input: UpdateFolderInput) => Promise<void>
  deleteFolder: (id: number) => Promise<void>
}

export const useFolderStore = create<FolderStore>((set, get) => ({
  folders: [],
  loading: false,
  error: null,

  fetchFolders: async (projectId) => {
    set({ loading: true, error: null })
    const result = await window.electronAPI['db:folders:list'](projectId)
    if (result.success) {
      set({ folders: result.data, loading: false })
    } else {
      set({ error: result.error.message, loading: false })
    }
  },

  createFolder: async (input) => {
    set({ error: null })
    const result = await window.electronAPI['db:folders:create'](input)
    if (result.success) {
      set({ folders: [...get().folders, result.data] })
    } else {
      set({ error: result.error.message })
    }
  },

  updateFolder: async (id, input) => {
    set({ error: null })
    const result = await window.electronAPI['db:folders:update'](id, input)
    if (result.success) {
      set({
        folders: get().folders.map((f) => (f.id === id ? result.data : f)),
      })
    } else {
      set({ error: result.error.message })
    }
  },

  deleteFolder: async (id) => {
    set({ error: null })
    const result = await window.electronAPI['db:folders:delete'](id)
    if (result.success) {
      set({ folders: get().folders.filter((f) => f.id !== id) })
    } else {
      set({ error: result.error.message })
    }
  },
}))
