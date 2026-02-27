import { create } from 'zustand'

interface SettingsStore {
  settings: Record<string, string>
  loaded: boolean
  showWizard: boolean
  loadSettings: () => Promise<void>
  getSetting: (key: string) => string | null
  setShowWizard: (show: boolean) => void
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: {},
  loaded: false,
  showWizard: false,

  loadSettings: async () => {
    const result = await window.electronAPI['settings:get-all']()
    if (result.success) {
      set({ settings: result.data, loaded: true })
    }
  },

  getSetting: (key: string) => {
    return get().settings[key] ?? null
  },

  setShowWizard: (show: boolean) => {
    set({ showWizard: show })
  },
}))
