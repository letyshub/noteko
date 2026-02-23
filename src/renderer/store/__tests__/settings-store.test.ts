import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { IpcResult } from '@shared/ipc'

// Mock electronAPI before importing the store
const mockElectronAPI = {
  'settings:get-all': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Import store after mock is set up
const { useSettingsStore } = await import('../settings-store')

// Import constants to verify they're accessible from the shared location
const { PROJECT_COLORS } = await import('../../lib/constants')

describe('useSettingsStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset store state between tests
    useSettingsStore.setState({
      settings: {},
      loaded: false,
      showWizard: false,
    })
  })

  it('should have correct initial state', () => {
    const state = useSettingsStore.getState()

    expect(state.settings).toEqual({})
    expect(state.loaded).toBe(false)
    expect(state.showWizard).toBe(false)
  })

  describe('loadSettings', () => {
    it('should populate state from IPC on success', async () => {
      const mockSettings: Record<string, string> = {
        'general.defaultProject': '1',
        'ai.model': 'llama3',
        'general.theme': 'dark',
      }
      const result: IpcResult<Record<string, string>> = {
        success: true,
        data: mockSettings,
      }
      mockElectronAPI['settings:get-all'].mockResolvedValue(result)

      await act(async () => {
        await useSettingsStore.getState().loadSettings()
      })

      const state = useSettingsStore.getState()
      expect(state.settings).toEqual(mockSettings)
      expect(state.loaded).toBe(true)
      expect(mockElectronAPI['settings:get-all']).toHaveBeenCalledOnce()
    })

    it('should not set loaded on IPC failure', async () => {
      const result: IpcResult<Record<string, string>> = {
        success: false,
        error: { code: 'DB_ERROR', message: 'Database error' },
      }
      mockElectronAPI['settings:get-all'].mockResolvedValue(result)

      await act(async () => {
        await useSettingsStore.getState().loadSettings()
      })

      const state = useSettingsStore.getState()
      expect(state.settings).toEqual({})
      expect(state.loaded).toBe(false)
    })
  })

  describe('getSetting', () => {
    it('should return the correct value for a known key', () => {
      useSettingsStore.setState({
        settings: {
          'general.defaultProject': '42',
          'ai.model': 'llama3',
        },
        loaded: true,
      })

      const value = useSettingsStore.getState().getSetting('general.defaultProject')
      expect(value).toBe('42')
    })

    it('should return null for an unknown key', () => {
      useSettingsStore.setState({
        settings: { 'ai.model': 'llama3' },
        loaded: true,
      })

      const value = useSettingsStore.getState().getSetting('nonexistent.key')
      expect(value).toBeNull()
    })
  })

  describe('showWizard', () => {
    it('should toggle showWizard correctly via setShowWizard', () => {
      expect(useSettingsStore.getState().showWizard).toBe(false)

      act(() => {
        useSettingsStore.getState().setShowWizard(true)
      })
      expect(useSettingsStore.getState().showWizard).toBe(true)

      act(() => {
        useSettingsStore.getState().setShowWizard(false)
      })
      expect(useSettingsStore.getState().showWizard).toBe(false)
    })
  })
})

describe('PROJECT_COLORS constant', () => {
  it('should be importable from the shared location and contain expected colors', () => {
    expect(PROJECT_COLORS).toBeDefined()
    expect(Array.isArray(PROJECT_COLORS)).toBe(true)
    expect(PROJECT_COLORS).toEqual(['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'])
  })
})
