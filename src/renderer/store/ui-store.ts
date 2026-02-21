import { create } from 'zustand'

interface UIStore {
  sidebarOpen: boolean
  currentPageTitle: string
  documentViewMode: 'list' | 'grid'

  setSidebarOpen: (open: boolean) => void
  setCurrentPageTitle: (title: string) => void
  setDocumentViewMode: (mode: 'list' | 'grid') => void
}

function getInitialSidebarState(): boolean {
  try {
    const stored = localStorage.getItem('noteko-sidebar-state')
    if (stored === 'false') return false
  } catch {
    // localStorage unavailable
  }
  return true
}

function getInitialDocumentViewMode(): 'list' | 'grid' {
  try {
    const stored = localStorage.getItem('noteko-document-view-mode')
    if (stored === 'grid') return 'grid'
  } catch {
    // localStorage unavailable
  }
  return 'list'
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: getInitialSidebarState(),
  currentPageTitle: '',
  documentViewMode: getInitialDocumentViewMode(),

  setSidebarOpen: (open) => {
    try {
      localStorage.setItem('noteko-sidebar-state', String(open))
    } catch {
      // localStorage unavailable
    }
    set({ sidebarOpen: open })
  },

  setCurrentPageTitle: (title) => {
    set({ currentPageTitle: title })
  },

  setDocumentViewMode: (mode) => {
    try {
      localStorage.setItem('noteko-document-view-mode', mode)
    } catch {
      // localStorage unavailable
    }
    set({ documentViewMode: mode })
  },
}))
