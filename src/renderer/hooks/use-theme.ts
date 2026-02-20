import { useEffect, useMemo, useState } from 'react'
import { useThemeStore } from '@renderer/store/theme-store'

type ResolvedTheme = 'light' | 'dark'

function getSystemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function applyTheme(resolved: ResolvedTheme) {
  if (resolved === 'dark') {
    document.documentElement.classList.add('dark')
    document.documentElement.style.colorScheme = 'dark'
  } else {
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = 'light'
  }
}

export function useTheme() {
  const theme = useThemeStore((state) => state.theme)
  const storeSetTheme = useThemeStore((state) => state.setTheme)

  // Track the OS-level preference so we can react to matchMedia changes
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(getSystemTheme)

  // Derive the resolved theme from user selection + system preference
  const resolvedTheme = useMemo<ResolvedTheme>(() => {
    if (theme === 'system') {
      return systemTheme
    }
    return theme
  }, [theme, systemTheme])

  // Apply theme to DOM whenever resolvedTheme changes
  useEffect(() => {
    applyTheme(resolvedTheme)
  }, [resolvedTheme])

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    const handleChange = (e: MediaQueryListEvent | { matches: boolean }) => {
      setSystemTheme(e.matches ? 'dark' : 'light')
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [theme])

  return { theme, setTheme: storeSetTheme, resolvedTheme }
}
