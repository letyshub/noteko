import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { DashboardPage } from '../dashboard-page'
import { ProjectPage } from '../project-page'
import { SettingsPage } from '../settings-page'
import { DocumentPage } from '../document-page'
import { QuizPage } from '../quiz-page'

// Mock window.electronAPI globally for store calls
beforeEach(() => {
  window.electronAPI = {
    ping: vi.fn(),
    'db:projects:list': vi.fn().mockResolvedValue({ success: true, data: [] }),
    'db:projects:get': vi.fn().mockResolvedValue({
      success: true,
      data: { id: 1, name: 'Test Project', description: null, color: null, created_at: '', updated_at: '' },
    }),
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

describe('DashboardPage', () => {
  it('renders welcome content', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText(/welcome to noteko/i)).toBeInTheDocument()
  })
})

describe('ProjectPage', () => {
  it('renders project page with project id from route params', () => {
    render(
      <MemoryRouter initialEntries={['/projects/42']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Project')).toBeInTheDocument()
  })
})

describe('DocumentPage', () => {
  it('renders document page with document id from route params', () => {
    render(
      <MemoryRouter initialEntries={['/documents/7']}>
        <Routes>
          <Route path="/documents/:id" element={<DocumentPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Document')).toBeInTheDocument()
  })
})

describe('QuizPage', () => {
  it('renders quiz page with quiz id from route params', () => {
    render(
      <MemoryRouter initialEntries={['/quizzes/3']}>
        <Routes>
          <Route path="/quizzes/:id" element={<QuizPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Quiz')).toBeInTheDocument()
  })
})

describe('SettingsPage', () => {
  it('renders settings content', () => {
    render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Settings')).toBeInTheDocument()
  })
})
