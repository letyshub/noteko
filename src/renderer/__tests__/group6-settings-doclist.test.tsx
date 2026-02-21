/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'ai:health-check': vi.fn(),
  'ai:list-models': vi.fn(),
  'settings:get': vi.fn(),
  'settings:set': vi.fn(),
  'settings:get-all': vi.fn(),
  'db:documents:delete': vi.fn(),
  on: vi.fn(() => vi.fn()),
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

vi.mock('react-router', () => ({
  useParams: () => ({ id: '1' }),
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
      currentPageTitle: 'Settings',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
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
  Button: ({ children, variant, ...props }: any) => (
    <button data-variant={variant} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@renderer/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
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
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <div role="menuitem" onClick={onClick} {...props}>
      {children}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const testDocuments: DocumentDto[] = [
  {
    id: 1,
    name: 'alpha-report.pdf',
    file_path: '/files/alpha-report.pdf',
    file_type: 'application/pdf',
    file_size: 1048576,
    folder_id: 1,
    project_id: 1,
    processing_status: 'completed',
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 2,
    name: 'beta-notes.docx',
    file_path: '/files/beta-notes.docx',
    file_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    file_size: 524288,
    folder_id: 1,
    project_id: 1,
    processing_status: 'pending',
    created_at: '2026-01-15T12:00:00Z',
    updated_at: '2026-01-15T12:00:00Z',
  },
  {
    id: 3,
    name: 'gamma-image.png',
    file_path: '/files/gamma-image.png',
    file_type: 'image/png',
    file_size: 2097152,
    folder_id: 1,
    project_id: 1,
    processing_status: 'failed',
    created_at: '2026-01-05T06:00:00Z',
    updated_at: '2026-01-05T06:00:00Z',
  },
]

// ===========================================================================
// OllamaSettings Tests
// ===========================================================================
describe('OllamaSettings', () => {
  let OllamaSettings: any

  beforeEach(async () => {
    vi.clearAllMocks()

    mockElectronAPI['settings:get-all'].mockResolvedValue({
      success: true,
      data: { 'ollama.url': 'http://localhost:11434', 'ollama.model': 'llama3.2' },
    })

    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: true, models: ['llama3.2', 'mistral'] },
    })

    mockElectronAPI['ai:list-models'].mockResolvedValue({
      success: true,
      data: [
        { name: 'llama3.2', size: 4000000000, modified_at: '2026-01-01' },
        { name: 'mistral', size: 3500000000, modified_at: '2026-01-01' },
      ],
    })

    const mod = await import('@renderer/components/settings/ollama-settings')
    OllamaSettings = mod.OllamaSettings
  })

  it('renders URL input, model dropdown, connection status, and test button', async () => {
    render(<OllamaSettings settings={{ 'ollama.url': 'http://localhost:11434', 'ollama.model': 'llama3.2' }} />)

    // URL input
    const urlInput = screen.getByLabelText(/ollama.*url/i)
    expect(urlInput).toBeInTheDocument()
    expect(urlInput).toHaveValue('http://localhost:11434')

    // Model select/dropdown
    expect(screen.getByLabelText(/model/i)).toBeInTheDocument()

    // Test Connection button
    expect(screen.getByRole('button', { name: /test connection/i })).toBeInTheDocument()

    // Connection status indicator
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument()
    })
  })

  it('saves settings via settings:set IPC on save button click', async () => {
    mockElectronAPI['settings:set'].mockResolvedValue({ success: true, data: undefined })

    const user = userEvent.setup()
    render(<OllamaSettings settings={{ 'ollama.url': 'http://localhost:11434', 'ollama.model': 'llama3.2' }} />)

    // Change the URL
    const urlInput = screen.getByLabelText(/ollama.*url/i)
    await user.clear(urlInput)
    await user.type(urlInput, 'http://myserver:11434')

    // Click save
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Should call settings:set for URL
    await waitFor(() => {
      expect(mockElectronAPI['settings:set']).toHaveBeenCalledWith('ollama.url', 'http://myserver:11434')
    })
  })
})

// ===========================================================================
// DocumentList Navigation Tests
// ===========================================================================
describe('DocumentList - click navigation', () => {
  let DocumentList: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-list')
    DocumentList = mod.DocumentList
  })

  it('navigates to /documents/:id when a document row is clicked', async () => {
    const user = userEvent.setup()
    render(<DocumentList documents={testDocuments} onDeleteDocument={vi.fn()} />)

    // Find the first document row by its name text and click the containing row
    const firstDocName = screen.getByText('alpha-report.pdf')
    const firstDocRow = firstDocName.closest('[data-testid="document-row"]')
    expect(firstDocRow).toBeTruthy()

    await user.click(firstDocRow!)

    expect(mockNavigate).toHaveBeenCalledWith('/documents/1')
  })
})

// ===========================================================================
// DocumentList - Processing Status Badge Tests
// ===========================================================================
describe('DocumentList - processing status badge', () => {
  let DocumentList: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-list')
    DocumentList = mod.DocumentList
  })

  it('renders processing status badge on each document item', () => {
    render(<DocumentList documents={testDocuments} onDeleteDocument={vi.fn()} />)

    // Should have badges for each document's processing status
    const badges = screen.getAllByTestId('badge')
    expect(badges.length).toBeGreaterThanOrEqual(3)

    // Check that the statuses match
    expect(badges.some((b) => b.textContent === 'Completed')).toBe(true)
    expect(badges.some((b) => b.textContent === 'Pending')).toBe(true)
    expect(badges.some((b) => b.textContent === 'Failed')).toBe(true)
  })
})

// ===========================================================================
// DocumentListToolbar Tests
// ===========================================================================
describe('DocumentListToolbar', () => {
  let DocumentListToolbar: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-list-toolbar')
    DocumentListToolbar = mod.DocumentListToolbar
  })

  it('renders sort dropdown', () => {
    render(<DocumentListToolbar sortBy="name" onSortChange={vi.fn()} />)

    // Sort dropdown trigger
    expect(screen.getByRole('button', { name: /sort/i })).toBeInTheDocument()
  })
})

// ===========================================================================
// Sorting Tests
// ===========================================================================
describe('DocumentList - sorting via toolbar', () => {
  let DocumentListToolbar: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-list-toolbar')
    DocumentListToolbar = mod.DocumentListToolbar
  })

  it('calls onSortChange with correct field when sort option is clicked', async () => {
    const onSortChange = vi.fn()
    const user = userEvent.setup()

    render(<DocumentListToolbar sortBy="name" onSortChange={onSortChange} />)

    // Find and click sort menu items
    const dateItem = screen.getByRole('menuitem', { name: /date/i })
    await user.click(dateItem)

    expect(onSortChange).toHaveBeenCalledWith('date')
  })
})
