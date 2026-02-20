import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { IpcResult } from '@shared/ipc'
import type { DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI before importing the store
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'file:open-dialog': vi.fn(),
  'file:upload': vi.fn(),
  'file:validate': vi.fn(),
  // Document store channels (needed because upload store imports document store)
  'db:documents:list': vi.fn(),
  'db:documents:list-by-project': vi.fn(),
  'db:documents:get': vi.fn(),
  'db:documents:create': vi.fn(),
  'db:documents:update': vi.fn(),
  'db:documents:delete': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock crypto.randomUUID
// ---------------------------------------------------------------------------
let uuidCounter = 0
vi.stubGlobal('crypto', {
  randomUUID: () => `test-uuid-${++uuidCounter}`,
})

// ---------------------------------------------------------------------------
// Import stores after mocks are set up
// ---------------------------------------------------------------------------
const { useUploadStore } = await import('../upload-store')
const { useDocumentStore } = await import('../document-store')

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const sampleDoc: DocumentDto = {
  id: 10,
  name: 'report.pdf',
  file_path: '/storage/report.pdf',
  file_type: 'application/pdf',
  file_size: 1024000,
  folder_id: 1,
  project_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const sampleDoc2: DocumentDto = {
  id: 11,
  name: 'photo.png',
  file_path: '/storage/photo.png',
  file_type: 'image/png',
  file_size: 512000,
  folder_id: 1,
  project_id: 1,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

// ===========================================================================
// Upload Store Tests
// ===========================================================================
describe('useUploadStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    uuidCounter = 0
    useUploadStore.setState({ items: [], isUploading: false })
    useDocumentStore.setState({ documents: [], loading: false, error: null })
  })

  it('should have correct initial state', () => {
    const state = useUploadStore.getState()
    expect(state.items).toEqual([])
    expect(state.isUploading).toBe(false)
  })

  describe('addFiles', () => {
    it('should add files to the queue with pending status', () => {
      act(() => {
        useUploadStore.getState().addFiles([
          { name: 'report.pdf', path: '/home/user/report.pdf' },
          { name: 'photo.png', path: '/home/user/photo.png' },
        ])
      })

      const state = useUploadStore.getState()
      expect(state.items).toHaveLength(2)
      expect(state.items[0]).toMatchObject({
        fileName: 'report.pdf',
        filePath: '/home/user/report.pdf',
        status: 'pending',
        progress: 0,
      })
      expect(state.items[1]).toMatchObject({
        fileName: 'photo.png',
        filePath: '/home/user/photo.png',
        status: 'pending',
        progress: 0,
      })
      // Each item should have a unique ID
      expect(state.items[0].id).not.toBe(state.items[1].id)
    })
  })

  describe('uploadNext', () => {
    it('should upload the first pending file and mark it as success', async () => {
      const uploadResult: IpcResult<DocumentDto> = {
        success: true,
        data: sampleDoc,
      }
      mockElectronAPI['file:upload'].mockResolvedValue(uploadResult)

      act(() => {
        useUploadStore.getState().addFiles([{ name: 'report.pdf', path: '/home/user/report.pdf' }])
      })

      await act(async () => {
        await useUploadStore.getState().uploadNext(1, 1)
      })

      const state = useUploadStore.getState()
      expect(state.items[0].status).toBe('success')
      expect(state.items[0].progress).toBe(100)
      expect(mockElectronAPI['file:upload']).toHaveBeenCalledWith({
        filePath: '/home/user/report.pdf',
        projectId: 1,
        folderId: 1,
      })
    })

    it('should add document to document store after successful upload', async () => {
      const uploadResult: IpcResult<DocumentDto> = {
        success: true,
        data: sampleDoc,
      }
      mockElectronAPI['file:upload'].mockResolvedValue(uploadResult)

      act(() => {
        useUploadStore.getState().addFiles([{ name: 'report.pdf', path: '/home/user/report.pdf' }])
      })

      await act(async () => {
        await useUploadStore.getState().uploadNext(1, 1)
      })

      // Cross-store update: document should be added to document store
      const docState = useDocumentStore.getState()
      expect(docState.documents).toContainEqual(sampleDoc)
    })

    it('should mark file as error when upload fails', async () => {
      const uploadResult: IpcResult<DocumentDto> = {
        success: false,
        error: { code: 'UPLOAD_ERROR', message: 'File too large' },
      }
      mockElectronAPI['file:upload'].mockResolvedValue(uploadResult)

      act(() => {
        useUploadStore.getState().addFiles([{ name: 'big-file.zip', path: '/home/user/big-file.zip' }])
      })

      await act(async () => {
        await useUploadStore.getState().uploadNext(1, 1)
      })

      const state = useUploadStore.getState()
      expect(state.items[0].status).toBe('error')
      expect(state.items[0].error).toBe('File too large')
    })

    it('should do nothing when no pending files exist', async () => {
      await act(async () => {
        await useUploadStore.getState().uploadNext(1, 1)
      })

      expect(mockElectronAPI['file:upload']).not.toHaveBeenCalled()
    })
  })

  describe('uploadAll', () => {
    it('should upload all pending files sequentially', async () => {
      const result1: IpcResult<DocumentDto> = { success: true, data: sampleDoc }
      const result2: IpcResult<DocumentDto> = { success: true, data: sampleDoc2 }
      mockElectronAPI['file:upload'].mockResolvedValueOnce(result1).mockResolvedValueOnce(result2)

      act(() => {
        useUploadStore.getState().addFiles([
          { name: 'report.pdf', path: '/home/user/report.pdf' },
          { name: 'photo.png', path: '/home/user/photo.png' },
        ])
      })

      await act(async () => {
        await useUploadStore.getState().uploadAll(1, 1)
      })

      const state = useUploadStore.getState()
      expect(state.items[0].status).toBe('success')
      expect(state.items[1].status).toBe('success')
      expect(state.isUploading).toBe(false)
      expect(mockElectronAPI['file:upload']).toHaveBeenCalledTimes(2)
    })
  })

  describe('removeItem', () => {
    it('should remove a specific item by id', () => {
      act(() => {
        useUploadStore.getState().addFiles([
          { name: 'report.pdf', path: '/home/user/report.pdf' },
          { name: 'photo.png', path: '/home/user/photo.png' },
        ])
      })

      const items = useUploadStore.getState().items
      act(() => {
        useUploadStore.getState().removeItem(items[0].id)
      })

      const state = useUploadStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0].fileName).toBe('photo.png')
    })
  })

  describe('clearCompleted', () => {
    it('should remove only completed and errored items', async () => {
      const uploadResult: IpcResult<DocumentDto> = {
        success: true,
        data: sampleDoc,
      }
      mockElectronAPI['file:upload'].mockResolvedValue(uploadResult)

      act(() => {
        useUploadStore.getState().addFiles([
          { name: 'done.pdf', path: '/home/user/done.pdf' },
          { name: 'pending.pdf', path: '/home/user/pending.pdf' },
        ])
      })

      // Upload only the first file
      await act(async () => {
        await useUploadStore.getState().uploadNext(1, 1)
      })

      act(() => {
        useUploadStore.getState().clearCompleted()
      })

      const state = useUploadStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.items[0].fileName).toBe('pending.pdf')
      expect(state.items[0].status).toBe('pending')
    })
  })

  describe('clearAll', () => {
    it('should remove all items', () => {
      act(() => {
        useUploadStore.getState().addFiles([
          { name: 'a.pdf', path: '/a.pdf' },
          { name: 'b.pdf', path: '/b.pdf' },
        ])
      })

      act(() => {
        useUploadStore.getState().clearAll()
      })

      expect(useUploadStore.getState().items).toHaveLength(0)
    })
  })
})
