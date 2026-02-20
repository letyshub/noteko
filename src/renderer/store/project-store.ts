import { create } from 'zustand'
import type { ProjectDto, CreateProjectInput, UpdateProjectInput } from '@shared/types'

interface ProjectStore {
  projects: ProjectDto[]
  selectedProjectId: number | null
  loading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  selectProject: (id: number | null) => void
  createProject: (input: CreateProjectInput) => Promise<void>
  updateProject: (id: number, input: UpdateProjectInput) => Promise<void>
  deleteProject: (id: number) => Promise<void>
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    const result = await window.electronAPI['db:projects:list']()
    if (result.success) {
      set({ projects: result.data, loading: false })
    } else {
      set({ error: result.error.message, loading: false })
    }
  },

  selectProject: (id) => {
    set({ selectedProjectId: id })
  },

  createProject: async (input) => {
    set({ error: null })
    const result = await window.electronAPI['db:projects:create'](input)
    if (result.success) {
      set({ projects: [...get().projects, result.data] })
    } else {
      set({ error: result.error.message })
    }
  },

  updateProject: async (id, input) => {
    set({ error: null })
    const result = await window.electronAPI['db:projects:update'](id, input)
    if (result.success) {
      set({
        projects: get().projects.map((p) => (p.id === id ? result.data : p)),
      })
    } else {
      set({ error: result.error.message })
    }
  },

  deleteProject: async (id) => {
    set({ error: null })
    const result = await window.electronAPI['db:projects:delete'](id)
    if (result.success) {
      const { selectedProjectId } = get()
      set({
        projects: get().projects.filter((p) => p.id !== id),
        selectedProjectId: selectedProjectId === id ? null : selectedProjectId,
      })
    } else {
      set({ error: result.error.message })
    }
  },
}))
