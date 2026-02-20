import { create } from 'zustand'
import type { DocumentDto } from '@shared/types'

interface DocumentStore {
  documents: DocumentDto[]
  loading: boolean
  error: string | null

  fetchDocumentsByProject: (projectId: number) => Promise<void>
  fetchDocumentsByFolder: (folderId: number) => Promise<void>
  addDocument: (doc: DocumentDto) => void
  removeDocument: (id: number) => void
  deleteDocument: (id: number) => Promise<void>
  clear: () => void
}

export const useDocumentStore = create<DocumentStore>((set) => ({
  documents: [],
  loading: false,
  error: null,

  fetchDocumentsByProject: async (projectId) => {
    set({ loading: true, error: null })
    try {
      const result = await window.electronAPI['db:documents:list-by-project'](projectId)
      if (result.success) {
        set({ documents: result.data, loading: false })
      } else {
        set({ error: result.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false })
    }
  },

  fetchDocumentsByFolder: async (folderId) => {
    set({ loading: true, error: null })
    try {
      const result = await window.electronAPI['db:documents:list'](folderId)
      if (result.success) {
        set({ documents: result.data, loading: false })
      } else {
        set({ error: result.error.message, loading: false })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error', loading: false })
    }
  },

  addDocument: (doc) => {
    set((state) => ({ documents: [...state.documents, doc] }))
  },

  removeDocument: (id) => {
    set((state) => ({ documents: state.documents.filter((d) => d.id !== id) }))
  },

  deleteDocument: async (id) => {
    try {
      const result = await window.electronAPI['db:documents:delete'](id)
      if (result.success) {
        set((state) => ({ documents: state.documents.filter((d) => d.id !== id) }))
      } else {
        set({ error: result.error.message })
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  },

  clear: () => set({ documents: [], loading: false, error: null }),
}))
