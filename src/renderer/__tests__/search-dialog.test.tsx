/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import type { SearchResultDto, RecentSearchDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:documents:search': vi.fn(),
  'db:search:recent-list': vi.fn(),
  'db:search:recent-save': vi.fn(),
  'db:search:recent-clear': vi.fn(),
  'db:search:recent-delete': vi.fn(),
  'db:projects:list': vi.fn(),
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
const mockNavigate = vi.fn()

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

// ---------------------------------------------------------------------------
// Mock Zustand stores
// ---------------------------------------------------------------------------
vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) =>
    selector({
      sidebarOpen: true,
      currentPageTitle: 'Test Page',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: vi.fn(),
    }),
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

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: ({ orientation, className, ...props }: any) => (
    <div data-testid="separator" data-orientation={orientation} className={className} {...props} />
  ),
}))

vi.mock('@renderer/components/ui/select', () => ({
  Select: ({ children, value, ...props }: any) => (
    <div data-testid="select" data-value={value} {...props}>
      {children}
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
// Mock cmdk-based command component
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/command', () => ({
  Command: ({ children, className, ...props }: any) => (
    <div data-testid="command" className={className} {...props}>
      {children}
    </div>
  ),
  CommandDialog: ({ children, open, onOpenChange, ...props }: any) => {
    if (!open) return null
    return (
      <div data-testid="command-dialog" role="dialog" {...props}>
        <div data-testid="dialog-overlay" onClick={() => onOpenChange?.(false)} />
        {children}
      </div>
    )
  },
  CommandInput: ({ placeholder, value, onValueChange, ...props }: any) => (
    <input
      data-testid="command-input"
      placeholder={placeholder}
      value={value}
      onChange={(e: any) => onValueChange?.(e.target.value)}
      {...props}
    />
  ),
  CommandList: ({ children, ...props }: any) => (
    <div data-testid="command-list" {...props}>
      {children}
    </div>
  ),
  CommandEmpty: ({ children, ...props }: any) => (
    <div data-testid="command-empty" {...props}>
      {children}
    </div>
  ),
  CommandGroup: ({ children, heading, ...props }: any) => (
    <div data-testid="command-group" data-heading={heading} {...props}>
      {heading && <div data-testid="command-group-heading">{heading}</div>}
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect, value, ...props }: any) => (
    <div data-testid="command-item" data-value={value} onClick={() => onSelect?.()} role="option" {...props}>
      {children}
    </div>
  ),
  CommandSeparator: (props: any) => <hr data-testid="command-separator" {...props} />,
  CommandShortcut: ({ children, ...props }: any) => (
    <span data-testid="command-shortcut" {...props}>
      {children}
    </span>
  ),
}))

// ---------------------------------------------------------------------------
// Mock sonner
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const mockSearchResults: SearchResultDto[] = [
  {
    documentId: 1,
    documentName: 'Machine Learning Notes.pdf',
    projectName: 'AI Research',
    fileType: 'pdf',
    snippet: 'This is about <mark>neural networks</mark> and deep learning',
    createdAt: '2026-02-23T10:00:00Z',
    processingStatus: 'completed',
    matchType: 'content',
  },
  {
    documentId: 2,
    documentName: 'Statistics Handbook.docx',
    projectName: 'Math',
    fileType: 'docx',
    snippet: null,
    createdAt: '2026-02-22T09:00:00Z',
    processingStatus: 'pending',
    matchType: 'name',
  },
]

const mockRecentSearches: RecentSearchDto[] = [
  {
    id: 1,
    query: 'neural networks',
    resultCount: 5,
    searchedAt: '2026-02-23T09:00:00Z',
  },
  {
    id: 2,
    query: 'statistics',
    resultCount: 3,
    searchedAt: '2026-02-22T08:00:00Z',
  },
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function setupMocks() {
  mockElectronAPI['db:documents:search'].mockResolvedValue({
    success: true,
    data: { results: mockSearchResults, total: 2, hasMore: false },
  })
  mockElectronAPI['db:search:recent-list'].mockResolvedValue({
    success: true,
    data: mockRecentSearches,
  })
  mockElectronAPI['db:search:recent-save'].mockResolvedValue({
    success: true,
    data: undefined,
  })
  mockElectronAPI['db:search:recent-clear'].mockResolvedValue({
    success: true,
    data: undefined,
  })
  mockElectronAPI['db:projects:list'].mockResolvedValue({
    success: true,
    data: [],
  })
}

async function renderSearchDialog(open = true) {
  const onOpenChange = vi.fn()
  const { SearchDialog } = await import('@renderer/components/search/search-dialog')
  const result = render(
    <MemoryRouter>
      <SearchDialog open={open} onOpenChange={onOpenChange} />
    </MemoryRouter>,
  )
  return { ...result, onOpenChange }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('SearchDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Test 1: Dialog opens on Ctrl+K and closes on Escape
  // Uses real timers (no debounce testing needed)
  it('should open dialog on Ctrl+K and close on Escape', async () => {
    const onOpenChange = vi.fn()
    const { SearchDialog } = await import('@renderer/components/search/search-dialog')

    // Render closed initially
    const { rerender } = render(
      <MemoryRouter>
        <SearchDialog open={false} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    )

    // Dialog should not be visible
    expect(screen.queryByTestId('command-dialog')).not.toBeInTheDocument()

    // Simulate Ctrl+K keydown on window
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    expect(onOpenChange).toHaveBeenCalledWith(true)

    // Re-render with open=true to show the dialog
    onOpenChange.mockClear()
    rerender(
      <MemoryRouter>
        <SearchDialog open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('command-dialog')).toBeInTheDocument()
    })

    // Simulate Escape key to close
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' })
    })

    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // Test 2: Debounced search fires IPC call after 300ms delay
  // Uses fake timers with shouldAdvanceTime to allow Promises to resolve
  it('should debounce search and fire IPC call after 300ms', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    await renderSearchDialog(true)

    const input = screen.getByTestId('command-input')

    // Type short query (below 2 char minimum)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'ne' } })
    })

    // Should not fire (below minimum character count and debounce not elapsed)
    expect(mockElectronAPI['db:documents:search']).not.toHaveBeenCalled()

    // Type longer query to pass minimum
    await act(async () => {
      fireEvent.change(input, { target: { value: 'neural' } })
    })

    // Still should not fire before debounce period
    expect(mockElectronAPI['db:documents:search']).not.toHaveBeenCalled()

    // Advance timer past debounce period
    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    await waitFor(() => {
      expect(mockElectronAPI['db:documents:search']).toHaveBeenCalledWith(expect.objectContaining({ query: 'neural' }))
    })
  })

  // Test 3: Search results render with document name, project name, file type badge, and snippet
  it('should render search results with metadata and snippet', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    await renderSearchDialog(true)

    const input = screen.getByTestId('command-input')

    // Type and trigger search
    await act(async () => {
      fireEvent.change(input, { target: { value: 'neural' } })
    })

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Wait for results to render
    await waitFor(() => {
      expect(screen.getByText('Machine Learning Notes.pdf')).toBeInTheDocument()
    })

    // Check document metadata
    expect(screen.getByText('AI Research')).toBeInTheDocument()

    // Check that file type badge is rendered
    const badges = screen.getAllByTestId('badge')
    const pdfBadge = badges.find((b) => b.textContent?.toUpperCase().includes('PDF'))
    expect(pdfBadge).toBeDefined()

    // Check snippet with highlighted text
    const markElement = screen.getByText('neural networks')
    expect(markElement).toBeInTheDocument()
    expect(markElement.tagName.toLowerCase()).toBe('mark')

    // Check unparsed document indicator
    expect(screen.getByText('Statistics Handbook.docx')).toBeInTheDocument()
    expect(screen.getByText(/not yet parsed/i)).toBeInTheDocument()
  })

  // Test 4: Recent searches display when dialog opens with empty query
  // Uses real timers (no debounce testing)
  it('should display recent searches when query is empty', async () => {
    await renderSearchDialog(true)

    // Wait for recent searches to load
    await waitFor(() => {
      expect(mockElectronAPI['db:search:recent-list']).toHaveBeenCalled()
    })

    // Recent searches should be visible
    await waitFor(() => {
      expect(screen.getByText('neural networks')).toBeInTheDocument()
    })

    expect(screen.getByText('statistics')).toBeInTheDocument()
  })

  // Test 5: Ctrl+K toggles dialog closed when already open
  it('should close dialog when Ctrl+K is pressed while already open', async () => {
    const onOpenChange = vi.fn()
    const { SearchDialog } = await import('@renderer/components/search/search-dialog')

    render(
      <MemoryRouter>
        <SearchDialog open={true} onOpenChange={onOpenChange} />
      </MemoryRouter>,
    )

    // Dialog should be visible
    expect(screen.getByTestId('command-dialog')).toBeInTheDocument()

    // Press Ctrl+K while dialog is open — should toggle it closed
    await act(async () => {
      fireEvent.keyDown(window, { key: 'k', ctrlKey: true })
    })

    // onOpenChange should be called with false (toggle from open=true to closed)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  // Test 6: Search result item renders <mark> tags as React <mark> elements
  it('should render snippet with highlighted text as <mark> elements', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    // Return a result with multiple <mark> tags in the snippet
    mockElectronAPI['db:documents:search'].mockResolvedValue({
      success: true,
      data: {
        results: [
          {
            documentId: 10,
            documentName: 'Deep Learning Guide.pdf',
            projectName: 'AI Research',
            fileType: 'pdf',
            snippet: 'Understanding <mark>deep</mark> <mark>learning</mark> architectures',
            createdAt: '2026-02-23T10:00:00Z',
            processingStatus: 'completed',
            matchType: 'content',
          },
        ],
        total: 1,
        hasMore: false,
      },
    })

    await renderSearchDialog(true)

    const input = screen.getByTestId('command-input')

    await act(async () => {
      fireEvent.change(input, { target: { value: 'deep learning' } })
    })

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Wait for the result to render
    await waitFor(() => {
      expect(screen.getByText('Deep Learning Guide.pdf')).toBeInTheDocument()
    })

    // Both highlighted terms should render as <mark> elements
    const deepMark = screen.getByText('deep')
    expect(deepMark.tagName.toLowerCase()).toBe('mark')

    const learningMark = screen.getByText('learning')
    expect(learningMark.tagName.toLowerCase()).toBe('mark')
  })

  // Test 7: Search filters renders project dropdown with project options
  it('should render filter bar with project options when filters button is clicked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    // Provide projects for the filter dropdown
    mockElectronAPI['db:projects:list'].mockResolvedValue({
      success: true,
      data: [
        { id: 1, name: 'Biology', description: null, color: null, createdAt: '', updatedAt: '' },
        { id: 2, name: 'Chemistry', description: null, color: null, createdAt: '', updatedAt: '' },
      ],
    })

    await renderSearchDialog(true)

    const input = screen.getByTestId('command-input')

    // Need a query >= 2 chars to show the filters button
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test query' } })
    })

    await act(async () => {
      vi.advanceTimersByTime(350)
    })

    // Click the "Filters" button to show the filter bar
    await waitFor(() => {
      expect(screen.getByText('Filters')).toBeInTheDocument()
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Filters'))
    })

    // The filter bar should render with project names in select items
    await waitFor(() => {
      expect(screen.getByText('Biology')).toBeInTheDocument()
    })
    expect(screen.getByText('Chemistry')).toBeInTheDocument()

    // Also verify file type options are present
    expect(screen.getByText('All projects')).toBeInTheDocument()
  })
})
