import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeStore {
  theme: ThemeMode
  setTheme: (theme: ThemeMode) => void
}

function getInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('noteko-theme')
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // localStorage unavailable
  }
  return 'system'
}

export const useThemeStore = create<ThemeStore>((set) => ({
  theme: getInitialTheme(),
  setTheme: (theme: ThemeMode) => {
    localStorage.setItem('noteko-theme', theme)
    set({ theme })
  },
}))
