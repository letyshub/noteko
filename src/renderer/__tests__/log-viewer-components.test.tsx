/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { LogStatisticsDto, AppLogDto, LogFilterInput } from '@shared/types'

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
}))

vi.mock('@renderer/components/ui/input', () => ({
  Input: ({ ...props }: any) => <input data-testid="input" {...props} />,
}))

vi.mock('@renderer/components/ui/select', () => ({
  Select: ({ children, onValueChange, value, ...props }: any) => (
    <div data-testid="select" data-value={value} {...props}>
      {children}
      {/* Store callback for testing */}
      <input type="hidden" data-testid="select-callback" data-onvaluechange={String(onValueChange)} />
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectContent: ({ children, ...props }: any) => (
    <div data-testid="select-content" {...props}>
      {children}
    </div>
  ),
  SelectItem: ({ children, value, ...props }: any) => (
    <div data-testid="select-item" data-value={value} {...props}>
      {children}
    </div>
  ),
  SelectValue: ({ placeholder, ...props }: any) => (
    <span data-testid="select-value" {...props}>
      {placeholder}
    </span>
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
  CartesianGrid: () => <div data-testid="cartesian-grid" />,
}))

// ---------------------------------------------------------------------------
// Mock lucide-react icons
// ---------------------------------------------------------------------------
vi.mock('lucide-react', () => ({
  FileText: (props: any) => <svg data-testid="icon-file-text" {...props} />,
  AlertCircle: (props: any) => <svg data-testid="icon-alert-circle" {...props} />,
  AlertTriangle: (props: any) => <svg data-testid="icon-alert-triangle" {...props} />,
  Info: (props: any) => <svg data-testid="icon-info" {...props} />,
  Search: (props: any) => <svg data-testid="icon-search" {...props} />,
  Play: (props: any) => <svg data-testid="icon-play" {...props} />,
  Pause: (props: any) => <svg data-testid="icon-pause" {...props} />,
}))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LogLevelBadge', () => {
  it('should render correct variant for each level', async () => {
    const { LogLevelBadge } = await import('@renderer/components/logs/log-level-badge')

    // error -> destructive
    const { unmount: u1 } = render(<LogLevelBadge level="error" />)
    let badge = screen.getByTestId('badge')
    expect(badge).toHaveAttribute('data-variant', 'destructive')
    expect(badge).toHaveTextContent('ERROR')
    u1()

    // warn -> outline with yellow text
    const { unmount: u2 } = render(<LogLevelBadge level="warn" />)
    badge = screen.getByTestId('badge')
    expect(badge).toHaveAttribute('data-variant', 'outline')
    expect(badge.className).toContain('text-yellow-600')
    expect(badge).toHaveTextContent('WARN')
    u2()

    // info -> outline with blue text
    const { unmount: u3 } = render(<LogLevelBadge level="info" />)
    badge = screen.getByTestId('badge')
    expect(badge).toHaveAttribute('data-variant', 'outline')
    expect(badge.className).toContain('text-blue-600')
    expect(badge).toHaveTextContent('INFO')
    u3()

    // debug -> secondary
    const { unmount: u4 } = render(<LogLevelBadge level="debug" />)
    badge = screen.getByTestId('badge')
    expect(badge).toHaveAttribute('data-variant', 'secondary')
    expect(badge).toHaveTextContent('DEBUG')
    u4()
  })
})

describe('LogStatsCards', () => {
  it('should render 4 cards with correct values from mock statistics data', async () => {
    const { LogStatsCards } = await import('@renderer/components/logs/log-stats-cards')
    const stats: LogStatisticsDto = {
      total: 1250,
      errors: 42,
      warnings: 108,
      infos: 900,
      debugs: 200,
      trend: [],
    }
    render(<LogStatsCards stats={stats} />)

    // 4 cards rendered
    const cards = screen.getAllByTestId('card')
    expect(cards).toHaveLength(4)

    // Correct labels
    expect(screen.getByText('Total Logs')).toBeInTheDocument()
    expect(screen.getByText('Errors')).toBeInTheDocument()
    expect(screen.getByText('Warnings')).toBeInTheDocument()
    expect(screen.getByText('Info')).toBeInTheDocument()

    // Correct values
    expect(screen.getByText('1250')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('108')).toBeInTheDocument()
    expect(screen.getByText('900')).toBeInTheDocument()
  })
})

describe('LogFiltersToolbar', () => {
  const defaultFilters: LogFilterInput = {
    level: undefined,
    category: undefined,
    search: '',
    dateRange: 'all',
  }

  it('should render level pills, category select, search input, and date preset select', async () => {
    const { LogFiltersToolbar } = await import('@renderer/components/logs/log-filters-toolbar')
    const onFiltersChange = vi.fn()
    render(
      <LogFiltersToolbar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        autoScroll={false}
        onAutoScrollChange={vi.fn()}
      />,
    )

    // Level toggle pills
    expect(screen.getByText('error')).toBeInTheDocument()
    expect(screen.getByText('warn')).toBeInTheDocument()
    expect(screen.getByText('info')).toBeInTheDocument()
    expect(screen.getByText('debug')).toBeInTheDocument()

    // Search input
    const searchInput = screen.getByPlaceholderText('Search logs...')
    expect(searchInput).toBeInTheDocument()

    // Select triggers (category + date preset)
    const selectTriggers = screen.getAllByTestId('select-trigger')
    expect(selectTriggers.length).toBeGreaterThanOrEqual(2)
  })

  it('should call onFiltersChange when search input changes (debounced)', async () => {
    vi.useFakeTimers()
    const { LogFiltersToolbar } = await import('@renderer/components/logs/log-filters-toolbar')
    const onFiltersChange = vi.fn()
    render(
      <LogFiltersToolbar
        filters={defaultFilters}
        onFiltersChange={onFiltersChange}
        autoScroll={false}
        onAutoScrollChange={vi.fn()}
      />,
    )

    const searchInput = screen.getByPlaceholderText('Search logs...')
    fireEvent.change(searchInput, { target: { value: 'test query' } })

    // Should not be called immediately (debounced)
    expect(onFiltersChange).not.toHaveBeenCalled()

    // Advance past the 300ms debounce
    vi.advanceTimersByTime(300)

    expect(onFiltersChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'test query' }))
    vi.useRealTimers()
  })
})

describe('LogList', () => {
  const mockLogs: AppLogDto[] = [
    {
      id: 1,
      level: 'error',
      message: 'Something went wrong in the application',
      category: 'app',
      context: { stack: 'Error: Something went wrong\n  at main.ts:42' },
      created_at: '2026-02-23T10:30:00Z',
    },
    {
      id: 2,
      level: 'info',
      message: 'Document processed successfully',
      category: 'document',
      context: null,
      created_at: '2026-02-23T10:31:00Z',
    },
  ]

  it('should render log entries with timestamp, level badge, category badge, and truncated message', async () => {
    const { LogList } = await import('@renderer/components/logs/log-list')
    render(<LogList logs={mockLogs} onLoadMore={vi.fn()} hasMore={false} loadingMore={false} />)

    // Messages are shown
    expect(screen.getByText('Something went wrong in the application')).toBeInTheDocument()
    expect(screen.getByText('Document processed successfully')).toBeInTheDocument()

    // Badges rendered (level + category for each entry)
    const badges = screen.getAllByTestId('badge')
    expect(badges.length).toBeGreaterThanOrEqual(2)
  })

  it('should expand an entry on click to show context JSON', async () => {
    const { LogList } = await import('@renderer/components/logs/log-list')
    render(<LogList logs={mockLogs} onLoadMore={vi.fn()} hasMore={false} loadingMore={false} />)

    // Context JSON should not be visible initially
    expect(screen.queryByText(/"stack"/)).not.toBeInTheDocument()

    // Click the first log entry to expand it
    const firstEntry = screen.getByText('Something went wrong in the application').closest('button')
    expect(firstEntry).toBeTruthy()
    fireEvent.click(firstEntry!)

    // Context JSON should now be visible
    expect(screen.getByText(/"stack"/)).toBeInTheDocument()
  })
})
