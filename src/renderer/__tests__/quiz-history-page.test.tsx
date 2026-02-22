/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { QuizAttemptWithContextDto, QuizOverviewStatsDto, QuizPerQuizStatsDto, WeakAreaDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:quiz-history:list-all': vi.fn(),
  'db:quiz-history:overview-stats': vi.fn(),
  'db:quiz-history:per-quiz-stats': vi.fn(),
  'db:quiz-history:weak-areas': vi.fn(),
  'file:export-json': vi.fn(),
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

const uiStoreState = {
  sidebarOpen: true,
  currentPageTitle: '',
  setSidebarOpen: vi.fn(),
  setCurrentPageTitle: mockSetCurrentPageTitle,
}

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) => selector(uiStoreState),
}))

// ---------------------------------------------------------------------------
// Mock sonner
// ---------------------------------------------------------------------------
const mockToast = { success: vi.fn(), error: vi.fn() }
vi.mock('sonner', () => ({
  toast: mockToast,
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

vi.mock('@renderer/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} role="progressbar" {...props} />
  ),
}))

vi.mock('@renderer/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children }: any) => <div data-testid="dropdown-trigger">{children}</div>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button data-testid="dropdown-item" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

// ---------------------------------------------------------------------------
// Mock quiz sub-components (they are tested independently)
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/quiz/performance-summary', () => ({
  PerformanceSummary: ({ stats }: any) => (
    <div data-testid="performance-summary" data-total={stats.total_attempts}>
      PerformanceSummary
    </div>
  ),
}))

vi.mock('@renderer/components/quiz/score-trend-chart', () => ({
  ScoreTrendChart: ({ attempts }: any) => (
    <div data-testid="score-trend-chart" data-count={attempts.length}>
      ScoreTrendChart
    </div>
  ),
}))

vi.mock('@renderer/components/quiz/quiz-history-toolbar', () => ({
  QuizHistoryToolbar: ({ sortField, sortDirection, onSortFieldChange, onSortDirectionChange }: any) => (
    <div data-testid="quiz-history-toolbar">
      <button data-testid="sort-by-score" onClick={() => onSortFieldChange('score')}>
        Sort by Score
      </button>
      <button
        data-testid="toggle-direction"
        onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
      >
        Toggle {sortDirection}
      </button>
      <span data-testid="current-sort">
        {sortField}-{sortDirection}
      </span>
    </div>
  ),
}))

vi.mock('@renderer/components/quiz/weak-areas-card', () => ({
  WeakAreasCard: ({ weakAreas }: any) => (
    <div data-testid="weak-areas-card" data-count={weakAreas.length}>
      WeakAreasCard
    </div>
  ),
}))

vi.mock('@renderer/components/quiz/score-badge', () => ({
  ScoreBadge: ({ percentage }: any) => <span data-testid="score-badge">{Math.round(percentage)}%</span>,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockAttempts: QuizAttemptWithContextDto[] = [
  {
    id: 1,
    quiz_id: 10,
    score: 80,
    total_questions: 10,
    answers: null,
    completed_at: '2026-02-20T10:00:00Z',
    quiz_title: 'Biology Basics',
    document_name: 'biology-notes.pdf',
    document_id: 5,
  },
  {
    id: 2,
    quiz_id: 11,
    score: 50,
    total_questions: 10,
    answers: null,
    completed_at: '2026-02-21T14:00:00Z',
    quiz_title: 'Chemistry 101',
    document_name: 'chemistry-intro.pdf',
    document_id: 6,
  },
  {
    id: 3,
    quiz_id: 10,
    score: 90,
    total_questions: 10,
    answers: null,
    completed_at: '2026-02-22T09:00:00Z',
    quiz_title: 'Biology Basics',
    document_name: 'biology-notes.pdf',
    document_id: 5,
  },
]

const mockOverviewStats: QuizOverviewStatsDto = {
  total_attempts: 3,
  average_score: 73,
  best_score: 90,
  quizzes_taken: 2,
}

const mockPerQuizStats: QuizPerQuizStatsDto[] = [
  {
    quiz_id: 10,
    quiz_title: 'Biology Basics',
    document_name: 'biology-notes.pdf',
    average_score: 85,
    attempt_count: 2,
    best_score: 90,
  },
]

const mockWeakAreas: WeakAreaDto[] = [
  { label: 'Short Answer', category: 'type', error_count: 5, total_count: 10, error_rate: 0.5 },
  { label: 'Hard', category: 'difficulty', error_count: 3, total_count: 8, error_rate: 0.375 },
]

const emptyOverviewStats: QuizOverviewStatsDto = {
  total_attempts: 0,
  average_score: 0,
  best_score: 0,
  quizzes_taken: 0,
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function renderPage() {
  const { QuizHistoryPage } = await import('@renderer/pages/quiz-history-page')
  return render(<QuizHistoryPage />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('QuizHistoryPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI['db:quiz-history:list-all'].mockResolvedValue({ success: true, data: mockAttempts })
    mockElectronAPI['db:quiz-history:overview-stats'].mockResolvedValue({ success: true, data: mockOverviewStats })
    mockElectronAPI['db:quiz-history:per-quiz-stats'].mockResolvedValue({ success: true, data: mockPerQuizStats })
    mockElectronAPI['db:quiz-history:weak-areas'].mockResolvedValue({ success: true, data: mockWeakAreas })
    mockElectronAPI['file:export-json'].mockResolvedValue({ success: true, data: '/tmp/export.json' })
  })

  // Test 1: Loading skeletons
  it('should render loading skeletons while data loads', async () => {
    // Make all 4 hooks stay in loading state by never resolving
    mockElectronAPI['db:quiz-history:list-all'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['db:quiz-history:overview-stats'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['db:quiz-history:per-quiz-stats'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['db:quiz-history:weak-areas'].mockReturnValue(new Promise(() => {}))

    await renderPage()

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    // The content sections should NOT be present
    expect(screen.queryByTestId('performance-summary')).not.toBeInTheDocument()
    expect(screen.queryByTestId('score-trend-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('weak-areas-card')).not.toBeInTheDocument()
  })

  // Test 2: Empty state
  it('should render empty state when no attempts exist', async () => {
    mockElectronAPI['db:quiz-history:list-all'].mockResolvedValue({ success: true, data: [] })
    mockElectronAPI['db:quiz-history:overview-stats'].mockResolvedValue({ success: true, data: emptyOverviewStats })
    mockElectronAPI['db:quiz-history:per-quiz-stats'].mockResolvedValue({ success: true, data: [] })
    mockElectronAPI['db:quiz-history:weak-areas'].mockResolvedValue({ success: true, data: [] })

    await renderPage()

    await waitFor(() => expect(screen.getByText(/no quiz attempts/i)).toBeInTheDocument())
    // Export button should be disabled in empty state
    const exportBtn = screen.getByRole('button', { name: /export/i })
    expect(exportBtn).toBeDisabled()
  })

  // Test 3: All sections render with data
  it('should render all sections when data is present', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByTestId('performance-summary')).toBeInTheDocument())
    expect(screen.getByTestId('score-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('quiz-history-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('weak-areas-card')).toBeInTheDocument()

    // Verify attempt list items are rendered (Biology Basics appears twice)
    expect(screen.getAllByText('Biology Basics').length).toBe(2)
    expect(screen.getByText('Chemistry 101')).toBeInTheDocument()
  })

  // Test 4: Sort toolbar changes list order
  it('should re-order attempt list when sort changes', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByTestId('quiz-history-toolbar')).toBeInTheDocument())

    // Change sort to score
    fireEvent.click(screen.getByTestId('sort-by-score'))

    // The default direction is desc, so highest score first: 90% (id=3), 80% (id=1), 50% (id=2)
    await waitFor(() => {
      const badges = screen.getAllByTestId('score-badge')
      expect(badges[0].textContent).toBe('90%')
      expect(badges[badges.length - 1].textContent).toBe('50%')
    })

    // Toggle to ascending
    fireEvent.click(screen.getByTestId('toggle-direction'))

    await waitFor(() => {
      const badges = screen.getAllByTestId('score-badge')
      expect(badges[0].textContent).toBe('50%')
      expect(badges[badges.length - 1].textContent).toBe('90%')
    })
  })

  // Test 5: Export button calls IPC and shows toast
  it('should export data and show success toast', async () => {
    mockElectronAPI['file:export-json'].mockResolvedValue({ success: true, data: '/tmp/quiz-history.json' })

    await renderPage()

    await waitFor(() => expect(screen.getByTestId('performance-summary')).toBeInTheDocument())

    const exportBtn = screen.getByRole('button', { name: /export/i })
    expect(exportBtn).not.toBeDisabled()

    fireEvent.click(exportBtn)

    await waitFor(() => {
      expect(mockElectronAPI['file:export-json']).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringMatching(/export/i), expect.any(Object))
    })
  })
})
