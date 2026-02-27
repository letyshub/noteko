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
// Mock quiz sub-components (tested independently)
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
// Mock lucide-react icons
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  BarChart3: (props: any) => <svg data-testid="icon-bar-chart" {...props} />,
  Download: (props: any) => <svg data-testid="icon-download" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="icon-alert-circle" {...props} />,
  ClipboardList: (props: any) => <svg data-testid="icon-clipboard-list" {...props} />,
  Target: (props: any) => <svg data-testid="icon-target" {...props} />,
  Trophy: (props: any) => <svg data-testid="icon-trophy" {...props} />,
  GraduationCap: (props: any) => <svg data-testid="icon-graduation-cap" {...props} />,
  ArrowUpDown: (props: any) => <svg data-testid="icon-arrow-up-down" {...props} />,
  ArrowUp: (props: any) => <svg data-testid="icon-arrow-up" {...props} />,
  ArrowDown: (props: any) => <svg data-testid="icon-arrow-down" {...props} />,
}))

// ---------------------------------------------------------------------------
// Mock recharts (for component tests)
// ---------------------------------------------------------------------------
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div data-testid="responsive-container">{children}</div>,
  LineChart: ({ children }: any) => <div data-testid="line-chart">{children}</div>,
  Line: () => <div data-testid="line" />,
  XAxis: () => <div data-testid="x-axis" />,
  YAxis: () => <div data-testid="y-axis" />,
  Tooltip: () => <div data-testid="tooltip" />,
  ReferenceLine: () => <div data-testid="reference-line" />,
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
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
]

const mockOverviewStats: QuizOverviewStatsDto = {
  total_attempts: 2,
  average_score: 65,
  best_score: 80,
  quizzes_taken: 2,
}

const mockPerQuizStats: QuizPerQuizStatsDto[] = [
  {
    quiz_id: 10,
    quiz_title: 'Biology Basics',
    document_name: 'biology-notes.pdf',
    average_score: 80,
    attempt_count: 1,
    best_score: 80,
  },
]

const mockWeakAreas: WeakAreaDto[] = [
  { label: 'Short Answer', category: 'type', error_count: 5, total_count: 10, error_rate: 0.5 },
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function renderPage() {
  const { QuizHistoryPage } = await import('@renderer/pages/quiz-history-page')
  return render(<QuizHistoryPage />)
}

// ---------------------------------------------------------------------------
// Component gap tests (using vi.importActual to get real component implementations)
// ---------------------------------------------------------------------------

describe('WeakAreasCard - empty state', () => {
  it('should display "No weak areas identified" when weakAreas is empty', async () => {
    // Import the real component bypassing the mock
    const { WeakAreasCard } = await vi.importActual<typeof import('@renderer/components/quiz/weak-areas-card')>(
      '@renderer/components/quiz/weak-areas-card',
    )
    render(<WeakAreasCard weakAreas={[]} />)
    expect(screen.getByText('No weak areas identified')).toBeInTheDocument()
  })
})

describe('PerformanceSummary - zero scores', () => {
  it('should render 0% for average and best score when stats are zero', async () => {
    const { PerformanceSummary } = await vi.importActual<
      typeof import('@renderer/components/quiz/performance-summary')
    >('@renderer/components/quiz/performance-summary')
    const zeroStats: QuizOverviewStatsDto = {
      total_attempts: 0,
      average_score: 0,
      best_score: 0,
      quizzes_taken: 0,
    }
    render(<PerformanceSummary stats={zeroStats} />)
    expect(screen.getByText('Total Attempts')).toBeInTheDocument()
    // 0 is rendered for total attempts and quizzes taken
    const zeros = screen.getAllByText('0')
    expect(zeros.length).toBe(2)
    // 0% is rendered for average and best score
    const zeroPercents = screen.getAllByText('0%')
    expect(zeroPercents.length).toBe(2)
  })
})

describe('ScoreTrendChart - single data point', () => {
  it('should render without error when given a single attempt', async () => {
    const { ScoreTrendChart } = await vi.importActual<typeof import('@renderer/components/quiz/score-trend-chart')>(
      '@renderer/components/quiz/score-trend-chart',
    )
    const singleAttempt: QuizAttemptWithContextDto[] = [
      {
        id: 1,
        quiz_id: 1,
        score: 70,
        total_questions: 10,
        answers: null,
        completed_at: '2026-02-22T10:00:00Z',
        quiz_title: 'Solo Quiz',
        document_name: 'notes.pdf',
        document_id: 1,
      },
    ]
    render(<ScoreTrendChart attempts={singleAttempt} />)
    // Should render chart container and reference lines without crashing
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
    expect(screen.getAllByTestId('reference-line')).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Page-level gap tests (using mocked sub-components)
// ---------------------------------------------------------------------------

describe('QuizHistoryPage - gap scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI['db:quiz-history:list-all'].mockResolvedValue({ success: true, data: mockAttempts })
    mockElectronAPI['db:quiz-history:overview-stats'].mockResolvedValue({ success: true, data: mockOverviewStats })
    mockElectronAPI['db:quiz-history:per-quiz-stats'].mockResolvedValue({ success: true, data: mockPerQuizStats })
    mockElectronAPI['db:quiz-history:weak-areas'].mockResolvedValue({ success: true, data: mockWeakAreas })
    mockElectronAPI['file:export-json'].mockResolvedValue({ success: true, data: '/tmp/export.json' })
  })

  it('should show no toast when export is cancelled (returns null)', async () => {
    // When user cancels the save dialog, the main process returns null data
    mockElectronAPI['file:export-json'].mockResolvedValue({ success: true, data: null })

    await renderPage()

    await waitFor(() => expect(screen.getByTestId('performance-summary')).toBeInTheDocument())

    const exportBtn = screen.getByRole('button', { name: /export/i })
    fireEvent.click(exportBtn)

    // Wait for the export to complete
    await waitFor(() => {
      expect(mockElectronAPI['file:export-json']).toHaveBeenCalled()
    })

    // Neither success nor error toast should be shown on cancel
    expect(mockToast.success).not.toHaveBeenCalled()
    expect(mockToast.error).not.toHaveBeenCalled()
  })

  it('should navigate to quiz route when attempt row is clicked', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByText('Biology Basics')).toBeInTheDocument())

    // Click the first attempt row (Biology Basics, quiz_id=10)
    const biologyRow = screen.getByRole('button', { name: /view quiz: biology basics/i })
    fireEvent.click(biologyRow)

    expect(mockNavigate).toHaveBeenCalledWith('/quizzes/10')
  })

  it('should render error state when IPC returns an error', async () => {
    mockElectronAPI['db:quiz-history:list-all'].mockResolvedValue({
      success: false,
      error: { code: 'DB_ERROR', message: 'Database connection failed' },
    })

    await renderPage()

    await waitFor(() => {
      expect(screen.getByText('Error loading quiz history')).toBeInTheDocument()
    })
    expect(screen.getByText('Database connection failed')).toBeInTheDocument()
    // Data sections should not render
    expect(screen.queryByTestId('performance-summary')).not.toBeInTheDocument()
  })

  it('should set page title to "Quiz History" on mount', async () => {
    await renderPage()

    expect(mockSetCurrentPageTitle).toHaveBeenCalledWith('Quiz History')
  })
})
