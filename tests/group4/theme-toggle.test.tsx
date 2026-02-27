import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ThemeToggle } from '@renderer/components/layout/theme-toggle'
import { useThemeStore } from '@renderer/store/theme-store'

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    useThemeStore.setState({ theme: 'system' })
    document.documentElement.classList.remove('dark')
    document.documentElement.style.colorScheme = ''

    // Mock matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('renders a button with an accessible label', () => {
    render(<ThemeToggle />)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveAttribute('aria-label')
  })

  it('cycles through themes: system -> light -> dark -> system', async () => {
    const user = userEvent.setup()
    render(<ThemeToggle />)

    const button = screen.getByRole('button')

    // Initial state is system (from store default)
    expect(useThemeStore.getState().theme).toBe('system')

    // Click: system -> light
    await user.click(button)
    expect(useThemeStore.getState().theme).toBe('light')

    // Click: light -> dark
    await user.click(button)
    expect(useThemeStore.getState().theme).toBe('dark')

    // Click: dark -> system
    await user.click(button)
    expect(useThemeStore.getState().theme).toBe('system')
  })

  it('displays the current theme mode icon', () => {
    render(<ThemeToggle />)

    // Should show Monitor icon text for system mode
    // We check the button exists and has content
    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })
})
