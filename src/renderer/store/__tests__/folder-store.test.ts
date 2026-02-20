import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { IpcResult } from '@shared/ipc'
import type { FolderDto, CreateFolderInput } from '@shared/types'

// Mock electronAPI before importing the store
const mockElectronAPI = {
  'db:folders:list': vi.fn(),
  'db:folders:create': vi.fn(),
  'db:folders:update': vi.fn(),
  'db:folders:delete': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Import store after mock is set up
const { useFolderStore } = await import('../folder-store')

const mockFolder: FolderDto = {
  id: 1,
  name: 'Test Folder',
  project_id: 1,
  parent_folder_id: null,
  created_at: '2026-01-01T00:00:00Z',
}

const mockFolder2: FolderDto = {
  id: 2,
  name: 'Subfolder',
  project_id: 1,
  parent_folder_id: 1,
  created_at: '2026-01-02T00:00:00Z',
}

describe('useFolderStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useFolderStore.setState({
      folders: [],
      loading: false,
      error: null,
    })
  })

  it('should have correct initial state', () => {
    const state = useFolderStore.getState()

    expect(state.folders).toEqual([])
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  describe('fetchFolders', () => {
    it('should fetch folders for a project and update state', async () => {
      const result: IpcResult<FolderDto[]> = {
        success: true,
        data: [mockFolder, mockFolder2],
      }
      mockElectronAPI['db:folders:list'].mockResolvedValue(result)

      await act(async () => {
        await useFolderStore.getState().fetchFolders(1)
      })

      const state = useFolderStore.getState()
      expect(state.folders).toEqual([mockFolder, mockFolder2])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:folders:list']).toHaveBeenCalledWith(1)
    })

    it('should set error on fetch failure', async () => {
      const result: IpcResult<FolderDto[]> = {
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to load folders' },
      }
      mockElectronAPI['db:folders:list'].mockResolvedValue(result)

      await act(async () => {
        await useFolderStore.getState().fetchFolders(1)
      })

      const state = useFolderStore.getState()
      expect(state.folders).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Failed to load folders')
    })
  })

  describe('createFolder', () => {
    it('should create a folder and add it to the list', async () => {
      const input: CreateFolderInput = { name: 'New Folder', project_id: 1 }
      const result: IpcResult<FolderDto> = { success: true, data: mockFolder }
      mockElectronAPI['db:folders:create'].mockResolvedValue(result)

      await act(async () => {
        await useFolderStore.getState().createFolder(input)
      })

      const state = useFolderStore.getState()
      expect(state.folders).toContainEqual(mockFolder)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:folders:create']).toHaveBeenCalledWith(input)
    })

    it('should set error on create failure', async () => {
      const input: CreateFolderInput = { name: 'New Folder', project_id: 1 }
      const result: IpcResult<FolderDto> = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Folder name required' },
      }
      mockElectronAPI['db:folders:create'].mockResolvedValue(result)

      await act(async () => {
        await useFolderStore.getState().createFolder(input)
      })

      expect(useFolderStore.getState().error).toBe('Folder name required')
    })
  })

  describe('deleteFolder', () => {
    it('should delete a folder and remove it from the list', async () => {
      useFolderStore.setState({ folders: [mockFolder, mockFolder2] })

      const result: IpcResult<void> = { success: true, data: undefined }
      mockElectronAPI['db:folders:delete'].mockResolvedValue(result)

      await act(async () => {
        await useFolderStore.getState().deleteFolder(1)
      })

      const state = useFolderStore.getState()
      expect(state.folders).toEqual([mockFolder2])
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:folders:delete']).toHaveBeenCalledWith(1)
    })

    it('should set error on delete failure', async () => {
      useFolderStore.setState({ folders: [mockFolder] })

      const result: IpcResult<void> = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Folder not found' },
      }
      mockElectronAPI['db:folders:delete'].mockResolvedValue(result)

      await act(async () => {
        await useFolderStore.getState().deleteFolder(1)
      })

      expect(useFolderStore.getState().folders).toEqual([mockFolder])
      expect(useFolderStore.getState().error).toBe('Folder not found')
    })
  })
})
