/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { AppLogDto, LogListResultDto, LogStatisticsDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:logs:list': vi.fn(),
  'db:logs:stats': vi.fn(),
  'db:logs:clear': vi.fn(),
  'file:export-json': vi.fn(),
  'file:export-csv': vi.fn(),
  on: vi.fn().mockReturnValue(vi.fn()),
  off: vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock react-router
// ---------------------------------------------------------------------------
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
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

vi.mock('@renderer/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: any) => (
    <div data-testid="dropdown-trigger" {...props}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <button data-testid="dropdown-item" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogTrigger: ({ children, ...props }: any) => (
    <div data-testid="alert-dialog-trigger" {...props}>
      {children}
    </div>
  ),
  AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogAction: ({ children, onClick, ...props }: any) => (
    <button data-testid="alert-dialog-action" onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, ...props }: any) => (
    <button data-testid="alert-dialog-cancel" {...props}>
      {children}
    </button>
  ),
}))

// ---------------------------------------------------------------------------
// Mock log sub-components (they are tested independently)
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/logs', () => ({
  LogStatsCards: ({ stats }: any) => (
    <div data-testid="log-stats-cards" data-total={stats.total}>
      LogStatsCards
    </div>
  ),
  LogTrendChart: ({ trend }: any) => (
    <div data-testid="log-trend-chart" data-count={trend.length}>
      LogTrendChart
    </div>
  ),
  LogFiltersToolbar: ({ filters, onFiltersChange, autoScroll, onAutoScrollChange }: any) => (
    <div data-testid="log-filters-toolbar">
      <button data-testid="change-level" onClick={() => onFiltersChange({ ...filters, level: 'error' })}>
        Filter Error
      </button>
      <button data-testid="toggle-auto-scroll" onClick={() => onAutoScrollChange(!autoScroll)}>
        Toggle Auto-Scroll
      </button>
    </div>
  ),
  LogList: ({ logs, onLoadMore, hasMore }: any) => (
    <div data-testid="log-list" data-count={logs.length}>
      {logs.map((log: any) => (
        <div key={log.id} data-testid="log-entry">
          {log.message}
        </div>
      ))}
      {hasMore && (
        <button data-testid="load-more" onClick={onLoadMore}>
          Load More
        </button>
      )}
    </div>
  ),
  LogLevelBadge: ({ level }: any) => <span data-testid="log-level-badge">{level}</span>,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockLogs: AppLogDto[] = [
  {
    id: 1,
    level: 'error',
    message: 'Something failed',
    category: 'app',
    context: null,
    created_at: '2026-02-23T10:00:00Z',
  },
  { id: 2, level: 'info', message: 'App started', category: 'app', context: null, created_at: '2026-02-23T09:00:00Z' },
  {
    id: 3,
    level: 'warn',
    message: 'Deprecation notice',
    category: 'document',
    context: null,
    created_at: '2026-02-23T08:00:00Z',
  },
]

const mockLogResult: LogListResultDto = {
  logs: mockLogs,
  total: 3,
  hasMore: false,
}

const mockStats: LogStatisticsDto = {
  total: 100,
  errors: 10,
  warnings: 25,
  infos: 60,
  debugs: 5,
  trend: [
    { date: '2026-02-20', errorCount: 3 },
    { date: '2026-02-21', errorCount: 5 },
    { date: '2026-02-22', errorCount: 2 },
  ],
}

const emptyLogResult: LogListResultDto = {
  logs: [],
  total: 0,
  hasMore: false,
}

const emptyStats: LogStatisticsDto = {
  total: 0,
  errors: 0,
  warnings: 0,
  infos: 0,
  debugs: 0,
  trend: [],
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
async function renderPage() {
  const { LogViewerPage } = await import('@renderer/pages/log-viewer-page')
  return render(<LogViewerPage />)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('LogViewerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI['db:logs:list'].mockResolvedValue({ success: true, data: mockLogResult })
    mockElectronAPI['db:logs:stats'].mockResolvedValue({ success: true, data: mockStats })
    mockElectronAPI['db:logs:clear'].mockResolvedValue({ success: true, data: undefined })
    mockElectronAPI['file:export-json'].mockResolvedValue({ success: true, data: '/tmp/app-logs.json' })
    mockElectronAPI['file:export-csv'].mockResolvedValue({ success: true, data: '/tmp/app-logs.csv' })
  })

  // Test 1: Loading skeletons
  it('should render loading skeletons while data loads', async () => {
    mockElectronAPI['db:logs:list'].mockReturnValue(new Promise(() => {}))
    mockElectronAPI['db:logs:stats'].mockReturnValue(new Promise(() => {}))

    await renderPage()

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0)
    expect(screen.queryByTestId('log-stats-cards')).not.toBeInTheDocument()
    expect(screen.queryByTestId('log-trend-chart')).not.toBeInTheDocument()
    expect(screen.queryByTestId('log-list')).not.toBeInTheDocument()
  })

  // Test 2: Error state
  it('should render error state with try again button', async () => {
    mockElectronAPI['db:logs:list'].mockResolvedValue({
      success: false,
      error: { code: 'DB_ERROR', message: 'Database connection failed' },
    })

    await renderPage()

    await waitFor(() => expect(screen.getByText(/database connection failed/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  // Test 3: Empty state
  it('should render empty state when no logs exist', async () => {
    mockElectronAPI['db:logs:list'].mockResolvedValue({ success: true, data: emptyLogResult })
    mockElectronAPI['db:logs:stats'].mockResolvedValue({ success: true, data: emptyStats })

    await renderPage()

    await waitFor(() => expect(screen.getByText(/no log entries/i)).toBeInTheDocument())
  })

  // Test 4: Content state renders all sections
  it('should render stats cards, chart, toolbar, and log list', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByTestId('log-stats-cards')).toBeInTheDocument())
    expect(screen.getByTestId('log-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('log-filters-toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('log-list')).toBeInTheDocument()

    // Verify log entries are rendered
    expect(screen.getByTestId('log-list').getAttribute('data-count')).toBe('3')
  })

  // Test 5: Export JSON calls IPC and shows toast
  it('should export as JSON and show success toast', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByTestId('log-stats-cards')).toBeInTheDocument())

    // Click the JSON export dropdown item
    const exportItems = screen.getAllByTestId('dropdown-item')
    const jsonItem = exportItems.find((item) => item.textContent?.includes('JSON'))
    expect(jsonItem).toBeDefined()
    fireEvent.click(jsonItem!)

    await waitFor(() => {
      expect(mockElectronAPI['file:export-json']).toHaveBeenCalled()
    })

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringMatching(/export/i), expect.any(Object))
    })
  })

  // Test 6: Clear logs triggers confirmation and refreshes
  it('should clear logs with confirmation dialog', async () => {
    await renderPage()

    await waitFor(() => expect(screen.getByTestId('log-stats-cards')).toBeInTheDocument())

    // Click clear logs button to open alert dialog
    const clearBtn = screen.getByRole('button', { name: /clear logs/i })
    fireEvent.click(clearBtn)

    // Confirm in alert dialog
    await waitFor(() => expect(screen.getByTestId('alert-dialog')).toBeInTheDocument())
    const confirmBtn = screen.getByTestId('alert-dialog-action')
    fireEvent.click(confirmBtn)

    await waitFor(() => {
      expect(mockElectronAPI['db:logs:clear']).toHaveBeenCalled()
    })
  })
})
