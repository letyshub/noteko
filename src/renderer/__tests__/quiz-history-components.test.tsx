/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { QuizOverviewStatsDto, WeakAreaDto } from '@shared/types'

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

vi.mock('@renderer/components/ui/card', () => ({
  Card: ({ children, className, ...props }: any) => (
    <div data-testid="card" className={className} {...props}>
      {children}
    </div>
  ),
  CardHeader: ({ children, ...props }: any) => (
    <div data-testid="card-header" {...props}>
      {children}
    </div>
  ),
  CardTitle: ({ children, ...props }: any) => (
    <h3 data-testid="card-title" {...props}>
      {children}
    </h3>
  ),
  CardContent: ({ children, ...props }: any) => (
    <div data-testid="card-content" {...props}>
      {children}
    </div>
  ),
  CardDescription: ({ children, ...props }: any) => (
    <p data-testid="card-description" {...props}>
      {children}
    </p>
  ),
  CardFooter: ({ children, ...props }: any) => (
    <div data-testid="card-footer" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => (
    <div data-testid="progress" data-value={value} role="progressbar" {...props} />
  ),
}))

vi.mock('@renderer/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children, ...props }: any) => (
    <div data-testid="dropdown-menu" {...props}>
      {children}
    </div>
  ),
  DropdownMenuTrigger: ({ children, ...props }: any) => (
    <div data-testid="dropdown-menu-trigger" {...props}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children, ...props }: any) => (
    <div data-testid="dropdown-menu-content" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, className, ...props }: any) => (
    <div data-testid="dropdown-menu-item" role="menuitem" onClick={onClick} className={className} {...props}>
      {children}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Mock recharts (returns simple divs for jsdom)
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
// Mock lucide-react icons
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  ClipboardList: (props: any) => <svg data-testid="icon-clipboard-list" {...props} />,
  Target: (props: any) => <svg data-testid="icon-target" {...props} />,
  Trophy: (props: any) => <svg data-testid="icon-trophy" {...props} />,
  GraduationCap: (props: any) => <svg data-testid="icon-graduation-cap" {...props} />,
  ArrowUpDown: (props: any) => <svg data-testid="icon-arrow-up-down" {...props} />,
  ArrowUp: (props: any) => <svg data-testid="icon-arrow-up" {...props} />,
  ArrowDown: (props: any) => <svg data-testid="icon-arrow-down" {...props} />,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ScoreBadge', () => {
  it('should render green text for score >= 80', async () => {
    const { ScoreBadge } = await import('@renderer/components/quiz/score-badge')
    render(<ScoreBadge percentage={85} />)
    const badge = screen.getByTestId('badge')
    expect(badge.className).toContain('text-green-600')
    expect(badge).toHaveTextContent('85%')
  })

  it('should render yellow text for score 60-79', async () => {
    const { ScoreBadge } = await import('@renderer/components/quiz/score-badge')
    render(<ScoreBadge percentage={65} />)
    const badge = screen.getByTestId('badge')
    expect(badge.className).toContain('text-yellow-600')
    expect(badge).toHaveTextContent('65%')
  })

  it('should render red text for score < 60', async () => {
    const { ScoreBadge } = await import('@renderer/components/quiz/score-badge')
    render(<ScoreBadge percentage={42} />)
    const badge = screen.getByTestId('badge')
    expect(badge.className).toContain('text-red-600')
    expect(badge).toHaveTextContent('42%')
  })
})

describe('PerformanceSummary', () => {
  it('should render 4 stat cards with correct labels', async () => {
    const { PerformanceSummary } = await import('@renderer/components/quiz/performance-summary')
    const stats: QuizOverviewStatsDto = {
      total_attempts: 12,
      average_score: 75,
      best_score: 95,
      quizzes_taken: 5,
    }
    render(<PerformanceSummary stats={stats} />)
    expect(screen.getByText('Total Attempts')).toBeInTheDocument()
    expect(screen.getByText('Average Score')).toBeInTheDocument()
    expect(screen.getByText('Best Score')).toBeInTheDocument()
    expect(screen.getByText('Quizzes Taken')).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    expect(screen.getByText('95%')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })
})

describe('WeakAreasCard', () => {
  it('should render error rate percentages and progress bars', async () => {
    const { WeakAreasCard } = await import('@renderer/components/quiz/weak-areas-card')
    const weakAreas: WeakAreaDto[] = [
      {
        label: 'Multiple Choice',
        category: 'type',
        error_count: 8,
        total_count: 20,
        error_rate: 0.4,
      },
      {
        label: 'Hard',
        category: 'difficulty',
        error_count: 5,
        total_count: 10,
        error_rate: 0.5,
      },
    ]
    render(<WeakAreasCard weakAreas={weakAreas} />)
    // Error rates are displayed as percentages
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
    // Labels are rendered
    expect(screen.getByText('Multiple Choice')).toBeInTheDocument()
    expect(screen.getByText('Hard')).toBeInTheDocument()
    // Progress bars are rendered
    const progressBars = screen.getAllByTestId('progress')
    expect(progressBars).toHaveLength(2)
  })
})

describe('QuizHistoryToolbar', () => {
  it('should call onSortFieldChange when sort option is clicked', async () => {
    const { QuizHistoryToolbar } = await import('@renderer/components/quiz/quiz-history-toolbar')
    const onSortFieldChange = vi.fn()
    const onSortDirectionChange = vi.fn()
    render(
      <QuizHistoryToolbar
        sortField="date"
        sortDirection="desc"
        onSortFieldChange={onSortFieldChange}
        onSortDirectionChange={onSortDirectionChange}
      />,
    )
    // Click a sort option (e.g., "Score")
    const menuItems = screen.getAllByRole('menuitem')
    const scoreItem = menuItems.find((item) => item.textContent === 'Score')
    expect(scoreItem).toBeDefined()
    fireEvent.click(scoreItem!)
    expect(onSortFieldChange).toHaveBeenCalledWith('score')
  })
})
