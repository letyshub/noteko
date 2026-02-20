import { create } from 'zustand'

interface UIStore {
  sidebarOpen: boolean
  currentPageTitle: string

  setSidebarOpen: (open: boolean) => void
  setCurrentPageTitle: (title: string) => void
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

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: getInitialSidebarState(),
  currentPageTitle: '',

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
}))
