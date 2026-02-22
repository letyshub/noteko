/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { DashboardStatsDto, RecentDocumentDto, RecentQuizAttemptDto, ProjectWithCountDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:dashboard:stats': vi.fn(),
  'db:dashboard:recent-docs': vi.fn(),
  'db:dashboard:recent-attempts': vi.fn(),
  'db:dashboard:projects-with-counts': vi.fn(),
  'ai:health-check': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock react-router
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn()

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

// ---------------------------------------------------------------------------
// Mock Zustand stores
// ---------------------------------------------------------------------------
const mockSetCurrentPageTitle = vi.fn()

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) =>
    selector({
      sidebarOpen: true,
      currentPageTitle: '',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
    }),
}))

// ---------------------------------------------------------------------------
// Mock sonner
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Mock shadcn/ui components for jsdom
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} data-testid="badge" className={className} {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, variant, size, disabled, ...props }: any) => (
    <button data-variant={variant} data-size={size} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton" className={className} {...props} />,
}))

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, className, ...props }: any) => (
    <div data-testid="scroll-area" className={className} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: (props: any) => <hr data-testid="separator" {...props} />,
}))

vi.mock('@renderer/components/ui/card', () => ({
  Card: ({ children, ...props }: any) => (
    <div data-testid="card" {...props}>
      {children}
    </div>
  ),
  CardContent: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: any) => <h3 {...props}>{children}</h3>,
}))

vi.mock('@renderer/components/ui/dialog', () => ({
  Dialog: ({ children }: any) => <div data-testid="dialog">{children}</div>,
  DialogTrigger: ({ children }: any) => <div data-testid="dialog-trigger">{children}</div>,
  DialogContent: ({ children }: any) => <div data-testid="dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}))

// Mock CreateProjectDialog
vi.mock('@renderer/components/projects/create-project-dialog', () => ({
  CreateProjectDialog: ({ children }: any) => <div data-testid="create-project-dialog">{children}</div>,
}))

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  House: (props: any) => <svg data-testid="icon-house" {...props} />,
  FolderOpen: (props: any) => <svg data-testid="icon-folder-open" {...props} />,
  FileText: (props: any) => <svg data-testid="icon-file-text" {...props} />,
  GraduationCap: (props: any) => <svg data-testid="icon-graduation-cap" {...props} />,
  Target: (props: any) => <svg data-testid="icon-target" {...props} />,
  Plus: (props: any) => <svg data-testid="icon-plus" {...props} />,
  Upload: (props: any) => <svg data-testid="icon-upload" {...props} />,
  BarChart3: (props: any) => <svg data-testid="icon-bar-chart" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="icon-alert-circle" {...props} />,
  Rocket: (props: any) => <svg data-testid="icon-rocket" {...props} />,
  Wifi: (props: any) => <svg data-testid="icon-wifi" {...props} />,
  WifiOff: (props: any) => <svg data-testid="icon-wifi-off" {...props} />,
  Clock: (props: any) => <svg data-testid="icon-clock" {...props} />,
}))

// Mock score-badge
vi.mock('@renderer/components/quiz/score-badge', () => ({
  ScoreBadge: ({ percentage }: any) => <span data-testid="score-badge">{Math.round(percentage)}%</span>,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockStats: DashboardStatsDto = {
  total_projects: 3,
  total_documents: 12,
  total_quizzes_taken: 8,
  average_score: 75,
}

const mockRecentDocs: RecentDocumentDto[] = [
  { id: 1, name: 'bio-notes.pdf', file_type: 'pdf', project_name: 'Biology', created_at: '2026-02-22T10:00:00Z' },
  { id: 2, name: 'chem-intro.pdf', file_type: 'pdf', project_name: 'Chemistry', created_at: '2026-02-21T10:00:00Z' },
]

const mockRecentAttempts: RecentQuizAttemptDto[] = [
  {
    id: 1,
    quiz_id: 10,
    quiz_title: 'Bio Quiz 1',
    document_name: 'bio-notes.pdf',
    score: 85,
    completed_at: '2026-02-22T14:00:00Z',
  },
  {
    id: 2,
    quiz_id: 11,
    quiz_title: 'Chem Quiz 1',
    document_name: 'chem-intro.pdf',
    score: 60,
    completed_at: '2026-02-21T14:00:00Z',
  },
]

const mockProjects: ProjectWithCountDto[] = [
  { id: 1, name: 'Biology', color: '#22c55e', document_count: 5 },
  { id: 2, name: 'Chemistry', color: '#3b82f6', document_count: 3 },
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function renderPage() {
  const { DashboardPage } = await import('@renderer/pages/dashboard-page')
  return render(<DashboardPage />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI['db:dashboard:stats'].mockResolvedValue({ success: true, data: mockStats })
    mockElectronAPI['db:dashboard:recent-docs'].mockResolvedValue({ success: true, data: mockRecentDocs })
    mockElectronAPI['db:dashboard:recent-attempts'].mockResolvedValue({ success: true, data: mockRecentAttempts })
    mockElectronAPI['db:dashboard:projects-with-counts'].mockResolvedValue({ success: true, data: mockProjects })
    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: true, models: ['llama3'] },
    })
  })

  it('should set page title to "Dashboard" on mount', async () => {
    await renderPage()
    expect(mockSetCurrentPageTitle).toHaveBeenCalledWith('Dashboard')
  })

  it('should render loading skeletons while data loads', async () => {
    mockElectronAPI['db:dashboard:stats'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['db:dashboard:recent-docs'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['db:dashboard:recent-attempts'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['db:dashboard:projects-with-counts'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['ai:health-check'].mockReturnValue(new Promise(() => {}))

    await renderPage()

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
  })

  it('should render stats cards with correct values', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument())
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('should render recent documents', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getAllByText('bio-notes.pdf').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('chem-intro.pdf').length).toBeGreaterThanOrEqual(1)
  })

  it('should render recent quiz attempts with score badges', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bio Quiz 1')).toBeInTheDocument())
    expect(screen.getByText('Chem Quiz 1')).toBeInTheDocument()
    const badges = screen.getAllByTestId('score-badge')
    expect(badges.length).toBe(2)
  })

  it('should render project cards', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getAllByText('Biology').length).toBeGreaterThanOrEqual(1))
    expect(screen.getAllByText('Chemistry').length).toBeGreaterThanOrEqual(1)
  })

  it('should show Ollama connected status', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText(/connected/i)).toBeInTheDocument())
  })

  it('should show Ollama disconnected status when health check fails', async () => {
    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: false, models: [] },
    })

    await renderPage()

    await waitFor(() => expect(screen.getByText(/disconnected/i)).toBeInTheDocument())
  })

  it('should render empty state when no projects exist', async () => {
    mockElectronAPI['db:dashboard:stats'].mockResolvedValue({
      success: true,
      data: { total_projects: 0, total_documents: 0, total_quizzes_taken: 0, average_score: 0 },
    })
    mockElectronAPI['db:dashboard:recent-docs'].mockResolvedValue({ success: true, data: [] })
    mockElectronAPI['db:dashboard:recent-attempts'].mockResolvedValue({ success: true, data: [] })
    mockElectronAPI['db:dashboard:projects-with-counts'].mockResolvedValue({ success: true, data: [] })

    await renderPage()

    await waitFor(() => expect(screen.getByText(/get started/i)).toBeInTheDocument())
  })

  it('should render error state when IPC fails', async () => {
    mockElectronAPI['db:dashboard:stats'].mockResolvedValue({
      success: false,
      error: { code: 'DB_ERROR', message: 'Database connection failed' },
    })

    await renderPage()

    await waitFor(() => expect(screen.getByText(/error/i)).toBeInTheDocument())
  })

  it('should navigate to document page when recent doc is clicked', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getAllByText('bio-notes.pdf').length).toBeGreaterThanOrEqual(1))

    const docLink = screen.getByRole('button', { name: /view document: bio-notes/i })
    fireEvent.click(docLink)

    expect(mockNavigate).toHaveBeenCalledWith('/documents/1')
  })

  it('should navigate to quiz page when recent attempt is clicked', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText('Bio Quiz 1')).toBeInTheDocument())

    const attemptLink = screen.getByRole('button', { name: /bio quiz 1/i })
    fireEvent.click(attemptLink)

    expect(mockNavigate).toHaveBeenCalledWith('/quizzes/10')
  })

  it('should navigate to project page when project card is clicked', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getAllByText('Biology').length).toBeGreaterThanOrEqual(1))

    const projectCard = screen.getByRole('button', { name: /open project: biology/i })
    fireEvent.click(projectCard)

    expect(mockNavigate).toHaveBeenCalledWith('/projects/1')
  })
})
