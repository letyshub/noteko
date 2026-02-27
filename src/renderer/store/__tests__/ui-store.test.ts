import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
    get length() {
      return Object.keys(store).length
    },
    key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
  }
})()

Object.defineProperty(window, 'localStorage', { value: localStorageMock })

// Import store after mock is set up
const { useUIStore } = await import('../ui-store')

describe('useUIStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    useUIStore.setState({
      sidebarOpen: true,
      currentPageTitle: '',
    })
  })

  it('should have correct initial state', () => {
    const state = useUIStore.getState()

    expect(state.sidebarOpen).toBe(true)
    expect(state.currentPageTitle).toBe('')
  })

  describe('setSidebarOpen', () => {
    it('should toggle sidebar state to false', () => {
      act(() => {
        useUIStore.getState().setSidebarOpen(false)
      })

      expect(useUIStore.getState().sidebarOpen).toBe(false)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('noteko-sidebar-state', 'false')
    })

    it('should toggle sidebar state to true', () => {
      useUIStore.setState({ sidebarOpen: false })

      act(() => {
        useUIStore.getState().setSidebarOpen(true)
      })

      expect(useUIStore.getState().sidebarOpen).toBe(true)
      expect(localStorageMock.setItem).toHaveBeenCalledWith('noteko-sidebar-state', 'true')
    })
  })

  describe('setCurrentPageTitle', () => {
    it('should set the current page title', () => {
      act(() => {
        useUIStore.getState().setCurrentPageTitle('Dashboard')
      })

      expect(useUIStore.getState().currentPageTitle).toBe('Dashboard')
    })

    it('should update the page title', () => {
      useUIStore.setState({ currentPageTitle: 'Dashboard' })

      act(() => {
        useUIStore.getState().setCurrentPageTitle('Settings')
      })

      expect(useUIStore.getState().currentPageTitle).toBe('Settings')
    })
  })

  describe('localStorage persistence for sidebar', () => {
    it('should read initial sidebar state from localStorage', async () => {
      localStorageMock.setItem('noteko-sidebar-state', 'false')

      // Re-import to test initial state from localStorage
      // We reset module to test the initialization logic
      vi.resetModules()

      const { useUIStore: freshStore } = await import('../ui-store')
      const state = freshStore.getState()

      expect(state.sidebarOpen).toBe(false)
    })
  })
})
