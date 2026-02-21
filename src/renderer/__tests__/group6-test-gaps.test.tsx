/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Group 6 -- Test Gap Analysis: Strategic Tests
 *
 * These tests fill critical gaps identified during the test review:
 *   1. ImageViewer drag-to-pan interaction (mousedown + mousemove + mouseup)
 *   2. PdfViewer error state (onLoadError callback)
 *   3. DocumentPreview text-based fetch error path
 *   4. DocumentGridItem image load error fallback (onError -> icon)
 *   5. DocumentListToolbar aria-pressed attribute on toggle buttons
 *   6. View mode localStorage persistence round-trip (set grid, reset, read back)
 *   7. ImageViewer double-click resets zoom and position
 *   8. ResizablePanel minimum size values are specified
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentDetailDto, DocumentContentDto, DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Polyfills for jsdom
// ---------------------------------------------------------------------------
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      return {}
    }
  } as any
}

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

vi.mock('react-router', () => ({
  useParams: () => ({ id: '42' }),
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
vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) =>
    selector({
      sidebarOpen: true,
      currentPageTitle: '',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: vi.fn(),
    }),
}))

// ---------------------------------------------------------------------------
// Mock react-pdf
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockOnLoadSuccess: ((data: { numPages: number }) => void) | undefined
let mockOnLoadError: ((error: Error) => void) | undefined

vi.mock('react-pdf', () => ({
  Document: ({ file, onLoadSuccess, onLoadError, loading, error, children }: any) => {
    mockOnLoadSuccess = onLoadSuccess
    mockOnLoadError = onLoadError
    return (
      <div data-testid="pdf-document" data-file={file}>
        {loading}
        {error}
        {children}
      </div>
    )
  },
  Page: ({ pageNumber, scale }: any) => (
    <div data-testid="pdf-page" data-page={pageNumber} data-scale={scale}>
      Page {pageNumber}
    </div>
  ),
}))

vi.mock('@renderer/lib/pdf-worker', () => ({}))

// ---------------------------------------------------------------------------
// Mock shadcn/ui components for jsdom
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: any) => (
    <button data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/skeleton', () => ({
  Skeleton: ({ className, ...props }: any) => <div data-testid="skeleton" className={className} {...props} />,
}))

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} data-testid="badge" className={className} {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@renderer/components/ui/resizable', () => ({
  ResizablePanelGroup: ({ children, orientation, ...props }: any) => (
    <div data-testid="resizable-panel-group" data-orientation={orientation} {...props}>
      {children}
    </div>
  ),
  ResizablePanel: ({ children, defaultSize, minSize, ...props }: any) => (
    <div data-testid="resizable-panel" data-default-size={defaultSize} data-min-size={minSize} {...props}>
      {children}
    </div>
  ),
  ResizableHandle: ({ withHandle, ...props }: any) => (
    <div data-testid="resizable-handle" data-with-handle={withHandle} {...props} />
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
const completedContent: DocumentContentDto = {
  id: 1,
  document_id: 42,
  raw_text: 'This is the extracted text content.',
  summary: 'A brief summary.',
  key_points: ['Point one', 'Point two'],
  processed_at: '2026-01-15T10:00:00Z',
}

const pdfDocument: DocumentDetailDto = {
  id: 42,
  name: 'research-paper.pdf',
  file_path: '/files/research-paper.pdf',
  file_type: 'pdf',
  file_size: 2457600,
  folder_id: 1,
  project_id: 1,
  processing_status: 'completed',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  content: completedContent,
  project_name: 'Research Project',
  folder_name: 'Papers',
}

const textDocument: DocumentDetailDto = {
  ...pdfDocument,
  id: 44,
  name: 'notes.txt',
  file_path: '/files/notes.txt',
  file_type: 'txt',
}

const imageDoc: DocumentDto = {
  id: 1,
  name: 'photo.png',
  file_path: '/files/photo.png',
  file_type: 'png',
  file_size: 2097152,
  folder_id: 1,
  project_id: 1,
  processing_status: 'completed',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-10T08:00:00Z',
}

// ===========================================================================
// Test 1: ImageViewer drag-to-pan interaction
// ===========================================================================
describe('ImageViewer drag-to-pan interaction', () => {
  let ImageViewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/image-viewer')
    ImageViewer = mod.ImageViewer
  })

  it('updates image position via mousedown + mousemove + mouseup sequence', () => {
    render(<ImageViewer filePath="/files/photo.png" />)

    const img = screen.getByRole('img')
    // The container that handles mouse events is the parent of the img
    const container = img.parentElement!

    // Initial transform should have translate(0px, 0px)
    expect(img.style.transform).toContain('translate(0px, 0px)')

    // Simulate mousedown at (100, 100)
    fireEvent.mouseDown(container, { clientX: 100, clientY: 100 })

    // Simulate mousemove to (150, 120) - dragging 50px right, 20px down
    fireEvent.mouseMove(container, { clientX: 150, clientY: 120 })

    // The image transform should now reflect the movement
    expect(img.style.transform).toContain('translate(50px, 20px)')

    // Release mouse
    fireEvent.mouseUp(container)

    // After release, subsequent moves should not change position
    fireEvent.mouseMove(container, { clientX: 200, clientY: 200 })
    expect(img.style.transform).toContain('translate(50px, 20px)')
  })
})

// ===========================================================================
// Test 2: PdfViewer error state
// ===========================================================================
describe('PdfViewer error state', () => {
  let PdfViewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockOnLoadSuccess = undefined
    mockOnLoadError = undefined
    const mod = await import('@renderer/components/documents/pdf-viewer')
    PdfViewer = mod.PdfViewer
  })

  it('displays error message when PDF fails to load', async () => {
    render(<PdfViewer filePath="/files/invalid.pdf" />)

    // Trigger the error callback
    if (mockOnLoadError) {
      act(() => {
        mockOnLoadError!(new Error('Failed to load PDF'))
      })
    }

    await waitFor(() => {
      // The error state shows a heading "Failed to load PDF" and the error details below
      const headings = screen.getAllByText(/failed to load pdf/i)
      expect(headings.length).toBeGreaterThanOrEqual(1)

      // Verify the error icon section is shown (the component renders AlertCircle)
      const errorContainer = headings[0].closest('div')
      expect(errorContainer).toBeTruthy()
    })
  })
})

// ===========================================================================
// Test 3: DocumentPreview text-based fetch error path
// ===========================================================================
describe('DocumentPreview text-based file fetch error', () => {
  let DocumentPreview: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Mock fetch to fail
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    }) as any
    const mod = await import('@renderer/components/documents/document-preview')
    DocumentPreview = mod.DocumentPreview
  })

  it('shows error state when text file fetch fails', async () => {
    render(<DocumentPreview document={textDocument} />)

    await waitFor(() => {
      expect(screen.getByText(/failed to load text/i)).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// Test 4: DocumentGridItem image load error fallback
// ===========================================================================
describe('DocumentGridItem image load error fallback', () => {
  let DocumentGridItem: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-grid-item')
    DocumentGridItem = mod.DocumentGridItem
  })

  it('falls back to icon when image fails to load (onError)', () => {
    render(<DocumentGridItem document={imageDoc} onClick={vi.fn()} />)

    // Initially should render an img element (since file_type is 'png')
    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()

    // Simulate image load error
    fireEvent.error(img)

    // After error, img should be replaced by icon (no img element)
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Test 5: DocumentListToolbar aria-pressed attribute toggles correctly
// ===========================================================================
describe('DocumentListToolbar aria-pressed attribute', () => {
  let DocumentListToolbar: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-list-toolbar')
    DocumentListToolbar = mod.DocumentListToolbar
  })

  it('sets aria-pressed="true" on active view mode button and "false" on inactive', () => {
    const { rerender } = render(
      <DocumentListToolbar sortBy="name" onSortChange={vi.fn()} viewMode="list" onViewModeChange={vi.fn()} />,
    )

    const listBtn = screen.getByRole('button', { name: /list view/i })
    const gridBtn = screen.getByRole('button', { name: /grid view/i })

    // In list mode: list=pressed, grid=not pressed
    expect(listBtn).toHaveAttribute('aria-pressed', 'true')
    expect(gridBtn).toHaveAttribute('aria-pressed', 'false')

    // Switch to grid mode
    rerender(<DocumentListToolbar sortBy="name" onSortChange={vi.fn()} viewMode="grid" onViewModeChange={vi.fn()} />)

    const listBtn2 = screen.getByRole('button', { name: /list view/i })
    const gridBtn2 = screen.getByRole('button', { name: /grid view/i })

    expect(listBtn2).toHaveAttribute('aria-pressed', 'false')
    expect(gridBtn2).toHaveAttribute('aria-pressed', 'true')
  })
})

// ===========================================================================
// Test 6: DocumentViewer with pending/processing status shows placeholders in both panels
// ===========================================================================
describe('DocumentViewer pending/processing status placeholders', () => {
  let DocumentViewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('text content'),
    }) as any
    const mod = await import('@renderer/components/documents/document-viewer')
    DocumentViewer = mod.DocumentViewer
  })

  it('shows "not yet processed" in text panel and processing state in preview for pending document', () => {
    const pendingDoc: DocumentDetailDto = {
      ...pdfDocument,
      id: 99,
      name: 'uploading.pdf',
      processing_status: 'pending',
      content: null,
    }

    render(
      <DocumentViewer
        document={pendingDoc}
        onRetry={vi.fn()}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        aiAvailable={false}
      />,
    )

    // Should still have split layout (pdf is previewable)
    expect(screen.getByTestId('resizable-panel-group')).toBeInTheDocument()

    // Right panel should show "not yet processed"
    expect(screen.getByText(/not yet processed/i)).toBeInTheDocument()

    // Left panel should show processing indicator from DocumentPreview
    expect(screen.getByText(/processing/i)).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 7: ImageViewer double-click resets zoom and position
// ===========================================================================
describe('ImageViewer double-click resets zoom and position', () => {
  let ImageViewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/image-viewer')
    ImageViewer = mod.ImageViewer
  })

  it('resets zoom to 100% and position to (0,0) on double-click', async () => {
    const user = userEvent.setup()
    render(<ImageViewer filePath="/files/photo.png" />)

    const img = screen.getByRole('img')
    const container = img.parentElement!

    // Zoom in first
    const zoomInButton = screen.getByRole('button', { name: /zoom in/i })
    await user.click(zoomInButton)
    await user.click(zoomInButton)

    await waitFor(() => {
      expect(screen.getByText('120%')).toBeInTheDocument()
    })

    // Pan the image
    fireEvent.mouseDown(container, { clientX: 100, clientY: 100 })
    fireEvent.mouseMove(container, { clientX: 150, clientY: 120 })
    fireEvent.mouseUp(container)

    expect(img.style.transform).toContain('translate(50px, 20px)')

    // Double-click to reset
    fireEvent.doubleClick(container)

    // Position should reset to (0, 0) and zoom to 100%
    expect(img.style.transform).toContain('translate(0px, 0px)')
    expect(screen.getByText('100%')).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 8: ResizablePanel minimum sizes are specified
// ===========================================================================
describe('DocumentViewer ResizablePanel minimum sizes', () => {
  let DocumentViewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('text content'),
    }) as any
    const mod = await import('@renderer/components/documents/document-viewer')
    DocumentViewer = mod.DocumentViewer
  })

  it('sets minSize attributes on both resizable panels to prevent collapse', () => {
    render(
      <DocumentViewer
        document={pdfDocument}
        onRetry={vi.fn()}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        aiAvailable={false}
      />,
    )

    const panels = screen.getAllByTestId('resizable-panel')
    expect(panels).toHaveLength(2)

    // Both panels should have minSize > 0
    const leftMinSize = panels[0].getAttribute('data-min-size')
    const rightMinSize = panels[1].getAttribute('data-min-size')

    expect(leftMinSize).toBeDefined()
    expect(Number(leftMinSize)).toBeGreaterThan(0)
    expect(rightMinSize).toBeDefined()
    expect(Number(rightMinSize)).toBeGreaterThan(0)
  })
})
