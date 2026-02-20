import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { SidebarProvider } from '@renderer/components/ui/sidebar'
import { AppSidebar } from '../app-sidebar'

// Mock window.electronAPI
beforeEach(() => {
  window.electronAPI = {
    ping: vi.fn(),
    'db:projects:list': vi.fn().mockResolvedValue({ success: true, data: [] }),
    'db:projects:get': vi.fn(),
    'db:projects:create': vi.fn(),
    'db:projects:update': vi.fn(),
    'db:projects:delete': vi.fn(),
    'db:folders:list': vi.fn().mockResolvedValue({ success: true, data: [] }),
    'db:folders:create': vi.fn(),
    'db:folders:update': vi.fn(),
    'db:folders:delete': vi.fn(),
    'db:documents:list': vi.fn(),
    'db:documents:get': vi.fn(),
    'db:documents:create': vi.fn(),
    'db:documents:update': vi.fn(),
    'db:documents:delete': vi.fn(),
    'db:quizzes:list': vi.fn(),
    'db:quizzes:get': vi.fn(),
    'db:quizzes:create': vi.fn(),
    'db:quizzes:delete': vi.fn(),
    'db:quiz-attempts:list': vi.fn(),
    'db:quiz-attempts:create': vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
  } as unknown as typeof window.electronAPI
})

function renderSidebar(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <SidebarProvider defaultOpen={true}>
        <AppSidebar />
      </SidebarProvider>
    </MemoryRouter>,
  )
}

describe('AppSidebar navigation', () => {
  it('renders Dashboard and Settings navigation links', () => {
    renderSidebar()

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders navigation links as anchor elements with correct hrefs', () => {
    renderSidebar()

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
    const settingsLink = screen.getByRole('link', { name: /settings/i })

    expect(dashboardLink).toHaveAttribute('href', '/')
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('highlights the active route for Dashboard', () => {
    renderSidebar('/')

    const dashboardButton = screen.getByRole('link', { name: /dashboard/i })
    expect(dashboardButton).toHaveAttribute('data-active', 'true')
  })

  it('highlights the active route for Settings', () => {
    renderSidebar('/settings')

    const settingsButton = screen.getByRole('link', { name: /settings/i })
    expect(settingsButton).toHaveAttribute('data-active', 'true')
  })
})
