import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { IpcResult } from '@shared/ipc'
import type { ProjectDto, CreateProjectInput } from '@shared/types'

// Mock electronAPI before importing the store
const mockElectronAPI = {
  'db:projects:list': vi.fn(),
  'db:projects:get': vi.fn(),
  'db:projects:create': vi.fn(),
  'db:projects:update': vi.fn(),
  'db:projects:delete': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Import store after mock is set up
const { useProjectStore } = await import('../project-store')

const mockProject: ProjectDto = {
  id: 1,
  name: 'Test Project',
  description: 'A test project',
  color: '#ff0000',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockProject2: ProjectDto = {
  id: 2,
  name: 'Second Project',
  description: null,
  color: null,
  created_at: '2026-01-02T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

describe('useProjectStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state between tests
    useProjectStore.setState({
      projects: [],
      selectedProjectId: null,
      loading: false,
      error: null,
    })
  })

  it('should have correct initial state', () => {
    const state = useProjectStore.getState()

    expect(state.projects).toEqual([])
    expect(state.selectedProjectId).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
  })

  describe('fetchProjects', () => {
    it('should fetch projects and update state on success', async () => {
      const result: IpcResult<ProjectDto[]> = {
        success: true,
        data: [mockProject, mockProject2],
      }
      mockElectronAPI['db:projects:list'].mockResolvedValue(result)

      await act(async () => {
        await useProjectStore.getState().fetchProjects()
      })

      const state = useProjectStore.getState()
      expect(state.projects).toEqual([mockProject, mockProject2])
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should set error on fetch failure', async () => {
      const result: IpcResult<ProjectDto[]> = {
        success: false,
        error: { code: 'DB_ERROR', message: 'Database error' },
      }
      mockElectronAPI['db:projects:list'].mockResolvedValue(result)

      await act(async () => {
        await useProjectStore.getState().fetchProjects()
      })

      const state = useProjectStore.getState()
      expect(state.projects).toEqual([])
      expect(state.loading).toBe(false)
      expect(state.error).toBe('Database error')
    })
  })

  describe('selectProject', () => {
    it('should set selectedProjectId', () => {
      act(() => {
        useProjectStore.getState().selectProject(5)
      })

      expect(useProjectStore.getState().selectedProjectId).toBe(5)
    })

    it('should allow setting selectedProjectId to null', () => {
      useProjectStore.setState({ selectedProjectId: 5 })

      act(() => {
        useProjectStore.getState().selectProject(null)
      })

      expect(useProjectStore.getState().selectedProjectId).toBeNull()
    })
  })

  describe('createProject', () => {
    it('should create a project and add it to the list', async () => {
      const input: CreateProjectInput = { name: 'New Project', description: 'desc' }
      const result: IpcResult<ProjectDto> = { success: true, data: mockProject }
      mockElectronAPI['db:projects:create'].mockResolvedValue(result)

      await act(async () => {
        await useProjectStore.getState().createProject(input)
      })

      const state = useProjectStore.getState()
      expect(state.projects).toContainEqual(mockProject)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:projects:create']).toHaveBeenCalledWith(input)
    })

    it('should set error on create failure', async () => {
      const input: CreateProjectInput = { name: 'New Project' }
      const result: IpcResult<ProjectDto> = {
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Name already exists' },
      }
      mockElectronAPI['db:projects:create'].mockResolvedValue(result)

      await act(async () => {
        await useProjectStore.getState().createProject(input)
      })

      const state = useProjectStore.getState()
      expect(state.projects).toEqual([])
      expect(state.error).toBe('Name already exists')
    })
  })

  describe('deleteProject', () => {
    it('should delete a project and remove it from the list', async () => {
      useProjectStore.setState({ projects: [mockProject, mockProject2] })

      const result: IpcResult<void> = { success: true, data: undefined }
      mockElectronAPI['db:projects:delete'].mockResolvedValue(result)

      await act(async () => {
        await useProjectStore.getState().deleteProject(1)
      })

      const state = useProjectStore.getState()
      expect(state.projects).toEqual([mockProject2])
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:projects:delete']).toHaveBeenCalledWith(1)
    })

    it('should clear selectedProjectId if deleted project was selected', async () => {
      useProjectStore.setState({
        projects: [mockProject, mockProject2],
        selectedProjectId: 1,
      })

      const result: IpcResult<void> = { success: true, data: undefined }
      mockElectronAPI['db:projects:delete'].mockResolvedValue(result)

      await act(async () => {
        await useProjectStore.getState().deleteProject(1)
      })

      expect(useProjectStore.getState().selectedProjectId).toBeNull()
    })

    it('should set error on delete failure', async () => {
      useProjectStore.setState({ projects: [mockProject] })

      const result: IpcResult<void> = {
        success: false,
        error: { code: 'NOT_FOUND', message: 'Project not found' },
      }
      mockElectronAPI['db:projects:delete'].mockResolvedValue(result)

      await act(async () => {
        await useProjectStore.getState().deleteProject(1)
      })

      const state = useProjectStore.getState()
      expect(state.projects).toEqual([mockProject])
      expect(state.error).toBe('Project not found')
    })
  })
})
