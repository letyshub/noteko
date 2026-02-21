import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
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
    'db:documents:list': vi.fn().mockResolvedValue({ success: true, data: [] }),
    'db:documents:list-by-project': vi.fn().mockResolvedValue({ success: true, data: [] }),
    'db:documents:get': vi.fn().mockResolvedValue({
      success: true,
      data: {
        id: 7,
        name: 'Test Document',
        file_path: '/path/test.pdf',
        file_type: 'application/pdf',
        file_size: 1024,
        folder_id: 1,
        project_id: 1,
        processing_status: 'pending',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
        content: null,
      },
    }),
    'db:documents:create': vi.fn(),
    'db:documents:update': vi.fn(),
    'db:documents:delete': vi.fn(),
    'db:quizzes:list': vi.fn(),
    'db:quizzes:get': vi.fn(),
    'db:quizzes:create': vi.fn(),
    'db:quizzes:delete': vi.fn(),
    'db:quiz-attempts:list': vi.fn(),
    'db:quiz-attempts:create': vi.fn(),
    'ai:health-check': vi.fn().mockResolvedValue({
      success: true,
      data: { connected: false, models: [] },
    }),
    'ai:summarize': vi.fn(),
    'ai:extract-key-points': vi.fn(),
    'settings:get-all': vi.fn().mockResolvedValue({
      success: true,
      data: {},
    }),
    on: vi.fn(() => vi.fn()),
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
  it('renders project not found when project is not in store', () => {
    render(
      <MemoryRouter initialEntries={['/projects/42']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(screen.getByText('Project not found')).toBeInTheDocument()
  })
})

describe('DocumentPage', () => {
  it('renders document page with document id from route params', async () => {
    render(
      <MemoryRouter initialEntries={['/documents/7']}>
        <Routes>
          <Route path="/documents/:id" element={<DocumentPage />} />
        </Routes>
      </MemoryRouter>,
    )

    // The rebuilt DocumentPage fetches document data and displays the document name
    await waitFor(() => {
      expect(screen.getByText('Test Document')).toBeInTheDocument()
    })
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
