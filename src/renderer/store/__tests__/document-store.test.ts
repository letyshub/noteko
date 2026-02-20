import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { IpcResult } from '@shared/ipc'
import type { DocumentDto } from '@shared/types'

// Mock electronAPI before importing the store
const mockElectronAPI = {
  'db:documents:list': vi.fn(),
  'db:documents:list-by-project': vi.fn(),
  'db:documents:delete': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Import store after mock is set up
const { useDocumentStore } = await import('../document-store')

const mockDocument: DocumentDto = {
  id: 1,
  name: 'Test Document',
  file_path: '/path/to/doc.pdf',
  file_type: 'application/pdf',
  file_size: 1024,
  folder_id: 1,
  project_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockDocument2: DocumentDto = {
  id: 2,
  name: 'Second Document',
  file_path: '/path/to/doc2.txt',
  file_type: 'text/plain',
  file_size: 512,
  folder_id: 1,
  project_id: 1,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

describe('useDocumentStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state between tests
    useDocumentStore.setState({
      documents: [],
      loading: false,
      error: null,
    })
  })

  it('should have correct initial state', () => {
    const state = useDocumentStore.getState()

    expect(state.documents).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  describe('fetchDocumentsByProject', () => {
    it('should fetch documents by project and update state on success', async () => {
      const result: IpcResult<DocumentDto[]> = {
        success: true,
        data: [mockDocument, mockDocument2],
      }
      mockElectronAPI['db:documents:list-by-project'].mockResolvedValue(result)

      await act(async () => {
        await useDocumentStore.getState().fetchDocumentsByProject(1)
      })

      const state = useDocumentStore.getState()
      expect(state.documents).toEqual([mockDocument, mockDocument2])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:documents:list-by-project']).toHaveBeenCalledWith(1)
    })

    it('should set error on fetch by project failure', async () => {
      const result: IpcResult<DocumentDto[]> = {
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to load documents' },
      }
      mockElectronAPI['db:documents:list-by-project'].mockResolvedValue(result)

      await act(async () => {
        await useDocumentStore.getState().fetchDocumentsByProject(1)
      })

      const state = useDocumentStore.getState()
      expect(state.documents).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Failed to load documents')
    })
  })

  describe('fetchDocumentsByFolder', () => {
    it('should fetch documents by folder and update state on success', async () => {
      const result: IpcResult<DocumentDto[]> = {
        success: true,
        data: [mockDocument],
      }
      mockElectronAPI['db:documents:list'].mockResolvedValue(result)

      await act(async () => {
        await useDocumentStore.getState().fetchDocumentsByFolder(1)
      })

      const state = useDocumentStore.getState()
      expect(state.documents).toEqual([mockDocument])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:documents:list']).toHaveBeenCalledWith(1)
    })

    it('should set error on fetch by folder failure', async () => {
      const result: IpcResult<DocumentDto[]> = {
        success: false,
        error: { code: 'DB_ERROR', message: 'Database error' },
      }
      mockElectronAPI['db:documents:list'].mockResolvedValue(result)

      await act(async () => {
        await useDocumentStore.getState().fetchDocumentsByFolder(1)
      })

      const state = useDocumentStore.getState()
      expect(state.documents).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Database error')
    })
  })

  describe('addDocument', () => {
    it('should add a document to the list', () => {
      act(() => {
        useDocumentStore.getState().addDocument(mockDocument)
      })

      expect(useDocumentStore.getState().documents).toEqual([mockDocument])
    })

    it('should append to existing documents', () => {
      useDocumentStore.setState({ documents: [mockDocument] })

      act(() => {
        useDocumentStore.getState().addDocument(mockDocument2)
      })

      expect(useDocumentStore.getState().documents).toEqual([mockDocument, mockDocument2])
    })
  })

  describe('removeDocument', () => {
    it('should remove a document from the list', () => {
      useDocumentStore.setState({ documents: [mockDocument, mockDocument2] })

      act(() => {
        useDocumentStore.getState().removeDocument(1)
      })

      expect(useDocumentStore.getState().documents).toEqual([mockDocument2])
    })
  })

  describe('deleteDocument', () => {
    it('should delete a document and remove it from the list', async () => {
      useDocumentStore.setState({ documents: [mockDocument, mockDocument2] })

      const result: IpcResult<void> = { success: true, data: undefined }
      mockElectronAPI['db:documents:delete'].mockResolvedValue(result)

      await act(async () => {
        await useDocumentStore.getState().deleteDocument(1)
      })

      const state = useDocumentStore.getState()
      expect(state.documents).toEqual([mockDocument2])
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:documents:delete']).toHaveBeenCalledWith(1)
    })

    it('should set error on delete failure', async () => {
      useDocumentStore.setState({ documents: [mockDocument] })

      const result: IpcResult<void> = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Document not found' },
      }
      mockElectronAPI['db:documents:delete'].mockResolvedValue(result)

      await act(async () => {
        await useDocumentStore.getState().deleteDocument(1)
      })

      expect(useDocumentStore.getState().documents).toEqual([mockDocument])
      expect(useDocumentStore.getState().error).toBe('Document not found')
    })
  })

  describe('clear', () => {
    it('should reset state to initial values', () => {
      useDocumentStore.setState({
        documents: [mockDocument, mockDocument2],
        loading: true,
        error: 'some error',
      })

      act(() => {
        useDocumentStore.getState().clear()
      })

      const state = useDocumentStore.getState()
      expect(state.documents).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })
  })
})
