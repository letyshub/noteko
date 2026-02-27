import { create } from 'zustand'
import { useDocumentStore } from './document-store'
import type { DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UploadItem {
  id: string
  fileName: string
  filePath: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  progress: number // 0-100 (for MVP: 0 or 100, no intermediate)
}

interface UploadStore {
  items: UploadItem[]
  isUploading: boolean

  addFiles: (files: Array<{ name: string; path: string }>) => void
  uploadNext: (projectId: number, folderId: number) => Promise<void>
  uploadAll: (projectId: number, folderId: number) => Promise<void>
  removeItem: (id: string) => void
  clearCompleted: () => void
  clearAll: () => void
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useUploadStore = create<UploadStore>((set, get) => ({
  items: [],
  isUploading: false,

  addFiles: (files) => {
    const newItems: UploadItem[] = files.map((f) => ({
      id: crypto.randomUUID(),
      fileName: f.name,
      filePath: f.path,
      status: 'pending' as const,
      progress: 0,
    }))
    set((state) => ({ items: [...state.items, ...newItems] }))
  },

  uploadNext: async (projectId, folderId) => {
    const { items } = get()
    const pending = items.find((item) => item.status === 'pending')
    if (!pending) return

    // Mark as uploading
    set((state) => ({
      items: state.items.map((item) => (item.id === pending.id ? { ...item, status: 'uploading' as const } : item)),
      isUploading: true,
    }))

    try {
      const result = await window.electronAPI['file:upload']({
        filePath: pending.filePath,
        projectId,
        folderId,
      })

      if (result.success) {
        // Mark as success
        set((state) => ({
          items: state.items.map((item) =>
            item.id === pending.id ? { ...item, status: 'success' as const, progress: 100 } : item,
          ),
          isUploading: false,
        }))

        // Cross-store update: add document to the document store
        useDocumentStore.getState().addDocument(result.data as DocumentDto)
      } else {
        set((state) => ({
          items: state.items.map((item) =>
            item.id === pending.id ? { ...item, status: 'error' as const, error: result.error.message } : item,
          ),
          isUploading: false,
        }))
      }
    } catch (err) {
      set((state) => ({
        items: state.items.map((item) =>
          item.id === pending.id
            ? {
                ...item,
                status: 'error' as const,
                error: err instanceof Error ? err.message : 'Upload failed',
              }
            : item,
        ),
        isUploading: false,
      }))
    }
  },

  uploadAll: async (projectId, folderId) => {
    set({ isUploading: true })

    // Process all pending files sequentially
    let hasPending = true
    while (hasPending) {
      const { items } = get()
      const pending = items.find((item) => item.status === 'pending')
      if (!pending) {
        hasPending = false
        break
      }
      await get().uploadNext(projectId, folderId)
    }

    set({ isUploading: false })
  },

  removeItem: (id) => {
    set((state) => ({ items: state.items.filter((item) => item.id !== id) }))
  },

  clearCompleted: () => {
    set((state) => ({
      items: state.items.filter((item) => item.status !== 'success' && item.status !== 'error'),
    }))
  },

  clearAll: () => {
    set({ items: [] })
  },
}))
