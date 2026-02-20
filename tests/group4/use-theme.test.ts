import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTheme } from '@renderer/hooks/use-theme'
import { useThemeStore } from '@renderer/store/theme-store'

describe('useTheme', () => {
  let matchMediaListeners: Array<(e: { matches: boolean }) => void> = []

  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({ theme: 'system' })
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''

    matchMediaListeners = []

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false, // default: light system preference
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn((_event: string, cb: (e: { matches: boolean }) => void) => {
          matchMediaListeners.push(cb)
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    matchMediaListeners = []
  })

  it('applies dark class to documentElement when theme is dark', () => {
    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('dark')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(document.documentElement.style.colorScheme).toBe('dark')
    expect(result.current.resolvedTheme).toBe('dark')
  })

  it('removes dark class from documentElement when theme is light', () => {
    document.documentElement.classList.add('dark')

    const { result } = renderHook(() => useTheme())

    act(() => {
      result.current.setTheme('light')
    })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(result.current.resolvedTheme).toBe('light')
  })

  it('respects system preference when theme is system', () => {
    const { result } = renderHook(() => useTheme())

    // matchMedia returns matches: false (light), so system should resolve to light
    expect(result.current.resolvedTheme).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('returns theme, setTheme, and resolvedTheme from the hook', () => {
    const { result } = renderHook(() => useTheme())

    expect(result.current).toHaveProperty('theme')
    expect(result.current).toHaveProperty('setTheme')
    expect(result.current).toHaveProperty('resolvedTheme')
    expect(typeof result.current.setTheme).toBe('function')
  })

  it('responds to system theme changes via matchMedia listener', () => {
    const { result } = renderHook(() => useTheme())

    // Theme is 'system' by default; simulate system switching to dark
    act(() => {
      matchMediaListeners.forEach((cb) => cb({ matches: true }))
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(result.current.resolvedTheme).toBe('dark')
  })
})
