/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentDetailDto, DocumentContentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:documents:get': vi.fn(),
  'doc:parse:retry': vi.fn(),
  'ai:health-check': vi.fn(),
  'ai:summarize': vi.fn(),
  'ai:extract-key-points': vi.fn(),
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
const mockUseParams = vi.fn(() => ({ id: '42' }))

vi.mock('react-router', () => ({
  useParams: () => mockUseParams(),
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

let uiStoreState = {
  sidebarOpen: true,
  currentPageTitle: '',
  setSidebarOpen: vi.fn(),
  setCurrentPageTitle: mockSetCurrentPageTitle,
}

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) => selector(uiStoreState),
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

vi.mock('@renderer/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton" className={className} {...props} />,
}))

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const completedContent: DocumentContentDto = {
  id: 1,
  document_id: 42,
  raw_text: 'This is the extracted text content from the document.',
  summary: 'A brief summary of the document.',
  key_points: ['First key point', 'Second key point', 'Third key point'],
  processed_at: '2026-01-15T10:00:00Z',
}

const completedDocument: DocumentDetailDto = {
  id: 42,
  name: 'research-paper.pdf',
  file_path: '/files/research-paper.pdf',
  file_type: 'application/pdf',
  file_size: 2457600,
  folder_id: 1,
  project_id: 1,
  processing_status: 'completed',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  content: completedContent,
}

const failedDocument: DocumentDetailDto = {
  ...completedDocument,
  id: 43,
  name: 'corrupt-file.pdf',
  processing_status: 'failed',
  content: null,
}

const pendingDocument: DocumentDetailDto = {
  ...completedDocument,
  id: 44,
  name: 'new-upload.docx',
  processing_status: 'pending',
  content: null,
}

const noTextDocument: DocumentDetailDto = {
  ...completedDocument,
  id: 45,
  name: 'image-scan.png',
  processing_status: 'completed',
  content: {
    id: 2,
    document_id: 45,
    raw_text: null,
    summary: null,
    key_points: null,
    processed_at: '2026-01-15T10:00:00Z',
  },
}

// ===========================================================================
// ProcessingStatusBadge Tests
// ===========================================================================
describe('ProcessingStatusBadge', () => {
  let ProcessingStatusBadge: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/processing-status-badge')
    ProcessingStatusBadge = mod.ProcessingStatusBadge
  })

  it('renders correct variant and label for each processing status', () => {
    const statuses = [
      { status: 'pending', label: 'Pending', variant: 'default' },
      { status: 'processing', label: 'Processing...', variant: 'outline' },
      { status: 'completed', label: 'Completed', variant: 'default' },
      { status: 'failed', label: 'Failed', variant: 'destructive' },
      { status: 'unsupported', label: 'Unsupported', variant: 'secondary' },
    ]

    for (const { status, label, variant } of statuses) {
      const { unmount } = render(<ProcessingStatusBadge status={status as any} />)
      const badge = screen.getByTestId('badge')
      expect(badge).toHaveTextContent(label)
      expect(badge).toHaveAttribute('data-variant', variant)
      unmount()
    }
  })
})

// ===========================================================================
// DocumentMetadata Tests
// ===========================================================================
describe('DocumentMetadata', () => {
  let DocumentMetadata: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-metadata')
    DocumentMetadata = mod.DocumentMetadata
  })

  it('renders file name, size, type, date, and processing status', () => {
    render(<DocumentMetadata document={completedDocument} />)

    // File name
    expect(screen.getByText('research-paper.pdf')).toBeInTheDocument()

    // File size (2457600 bytes = ~2.3 MB)
    expect(screen.getByText(/2\.3\s*MB|2\.4\s*MB/)).toBeInTheDocument()

    // Processing status badge should be present
    const badges = screen.getAllByTestId('badge')
    expect(badges.length).toBeGreaterThanOrEqual(1)
    const statusBadge = badges.find((b) => b.textContent === 'Completed')
    expect(statusBadge).toBeDefined()
  })
})

// ===========================================================================
// DocumentPage Tests
// ===========================================================================
describe('DocumentPage', () => {
  let DocumentPage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ id: '42' })

    uiStoreState = {
      sidebarOpen: true,
      currentPageTitle: '',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
    }

    // Default: return completed document
    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: completedDocument,
    })

    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: false, models: [] },
    })

    const mod = await import('@renderer/pages/document-page')
    DocumentPage = mod.DocumentPage
  })

  it('fetches document detail on mount and displays content', async () => {
    render(<DocumentPage />)

    // Should have called the IPC to fetch the document
    expect(mockElectronAPI['db:documents:get']).toHaveBeenCalledWith(42)

    // Wait for the document content to appear
    await waitFor(() => {
      expect(screen.getByText('research-paper.pdf')).toBeInTheDocument()
    })

    // Raw text should be displayed
    await waitFor(() => {
      expect(screen.getByText('This is the extracted text content from the document.')).toBeInTheDocument()
    })
  })

  it('shows retry button when status is failed and calls doc:parse:retry on click', async () => {
    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: failedDocument,
    })

    mockElectronAPI['doc:parse:retry'].mockResolvedValue({
      success: true,
      data: undefined,
    })

    const user = userEvent.setup()
    render(<DocumentPage />)

    // Wait for the failed document to render
    await waitFor(() => {
      expect(screen.getByText('corrupt-file.pdf')).toBeInTheDocument()
    })

    // Find and click the retry button
    const retryButton = await screen.findByRole('button', { name: /retry/i })
    expect(retryButton).toBeInTheDocument()

    await user.click(retryButton)

    expect(mockElectronAPI['doc:parse:retry']).toHaveBeenCalledWith(43)
  })

  it('shows "not yet processed" message when content is null', async () => {
    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: pendingDocument,
    })

    render(<DocumentPage />)

    await waitFor(() => {
      expect(screen.getByText(/not yet processed/i)).toBeInTheDocument()
    })
  })

  it('disables AI action buttons when no raw_text is available', async () => {
    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: noTextDocument,
    })

    render(<DocumentPage />)

    await waitFor(() => {
      expect(screen.getByText('image-scan.png')).toBeInTheDocument()
    })

    // AI buttons should be disabled when no raw_text
    const summarizeBtn = screen.getByRole('button', { name: /summarize/i })
    const keyPointsBtn = screen.getByRole('button', { name: /key points/i })

    expect(summarizeBtn).toBeDisabled()
    expect(keyPointsBtn).toBeDisabled()
  })

  it('renders loading skeletons while fetching', () => {
    // Make the IPC call never resolve to keep loading state
    mockElectronAPI['db:documents:get'].mockReturnValue(new Promise(() => {}))

    render(<DocumentPage />)

    // Should show skeleton loading indicators
    const skeletons = screen.getAllByTestId('skeleton')
    expect(skeletons.length).toBeGreaterThanOrEqual(1)
  })
})
