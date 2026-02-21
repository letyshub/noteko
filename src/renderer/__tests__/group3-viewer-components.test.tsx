/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentDetailDto, DocumentContentDto } from '@shared/types'

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
let mockOnLoadSuccess: ((data: { numPages: number }) => void) | undefined
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let mockOnLoadError: ((error: Error) => void) | undefined

vi.mock('react-pdf', () => ({
  Document: ({ file, onLoadSuccess, onLoadError, children }: any) => {
    // Store callbacks so tests can trigger them
    mockOnLoadSuccess = onLoadSuccess
    mockOnLoadError = onLoadError
    return (
      <div data-testid="pdf-document" data-file={file}>
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

// Mock pdf-worker (side-effect only module)
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

// Mock resizable to avoid ResizeObserver issues
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

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const completedContent: DocumentContentDto = {
  id: 1,
  document_id: 42,
  raw_text: 'This is the extracted text content from the document.',
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

const imageDocument: DocumentDetailDto = {
  ...pdfDocument,
  id: 43,
  name: 'diagram.png',
  file_path: '/files/diagram.png',
  file_type: 'png',
}

const textDocument: DocumentDetailDto = {
  ...pdfDocument,
  id: 44,
  name: 'notes.txt',
  file_path: '/files/notes.txt',
  file_type: 'txt',
}

const exeDocument: DocumentDetailDto = {
  ...pdfDocument,
  id: 45,
  name: 'program.exe',
  file_path: '/files/program.exe',
  file_type: 'exe',
  content: null,
}

const processingDocument: DocumentDetailDto = {
  ...pdfDocument,
  id: 46,
  name: 'uploading.pdf',
  file_type: 'pdf',
  processing_status: 'processing',
  content: null,
}

const failedDocument: DocumentDetailDto = {
  ...pdfDocument,
  id: 47,
  name: 'corrupt.pdf',
  file_type: 'pdf',
  processing_status: 'failed',
  content: null,
}

// ===========================================================================
// PdfViewer Tests
// ===========================================================================
describe('PdfViewer', () => {
  let PdfViewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockOnLoadSuccess = undefined
    mockOnLoadError = undefined
    const mod = await import('@renderer/components/documents/pdf-viewer')
    PdfViewer = mod.PdfViewer
  })

  it('renders Document with noteko-file:// URL', () => {
    render(<PdfViewer filePath="/files/research-paper.pdf" />)

    const doc = screen.getByTestId('pdf-document')
    expect(doc).toBeInTheDocument()
    expect(doc.getAttribute('data-file')).toBe('noteko-file://localhost/files/research-paper.pdf')
  })

  it('supports page navigation: next increments, previous decrements, displays page number', async () => {
    const user = userEvent.setup()
    render(<PdfViewer filePath="/files/research-paper.pdf" />)

    // Simulate PDF load with 5 pages
    if (mockOnLoadSuccess) {
      mockOnLoadSuccess({ numPages: 5 })
    }

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument()
    })

    // Click next
    const nextButton = screen.getByRole('button', { name: /next page/i })
    await user.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText(/page 2 of 5/i)).toBeInTheDocument()
    })

    // Click previous
    const prevButton = screen.getByRole('button', { name: /previous page/i })
    await user.click(prevButton)

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 5/i)).toBeInTheDocument()
    })
  })

  it('zoom controls change the scale', async () => {
    const user = userEvent.setup()
    render(<PdfViewer filePath="/files/research-paper.pdf" />)

    // Simulate PDF load
    if (mockOnLoadSuccess) {
      mockOnLoadSuccess({ numPages: 3 })
    }

    // Default scale should be 100%
    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument()
    })

    // Click zoom in
    const zoomInButton = screen.getByRole('button', { name: /zoom in/i })
    await user.click(zoomInButton)

    await waitFor(() => {
      expect(screen.getByText('110%')).toBeInTheDocument()
    })

    // Click zoom out
    const zoomOutButton = screen.getByRole('button', { name: /zoom out/i })
    await user.click(zoomOutButton)

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// ImageViewer Tests
// ===========================================================================
describe('ImageViewer', () => {
  let ImageViewer: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/image-viewer')
    ImageViewer = mod.ImageViewer
  })

  it('renders img with noteko-file:// URL', () => {
    render(<ImageViewer filePath="/files/diagram.png" />)

    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toBe('noteko-file://localhost/files/diagram.png')
  })

  it('zoom in/out buttons change the zoom percentage', async () => {
    const user = userEvent.setup()
    render(<ImageViewer filePath="/files/diagram.png" />)

    // Default 100%
    expect(screen.getByText('100%')).toBeInTheDocument()

    // Click zoom in
    const zoomInButton = screen.getByRole('button', { name: /zoom in/i })
    await user.click(zoomInButton)

    await waitFor(() => {
      expect(screen.getByText('110%')).toBeInTheDocument()
    })

    // Click zoom out
    const zoomOutButton = screen.getByRole('button', { name: /zoom out/i })
    await user.click(zoomOutButton)

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })

  it('1:1 button sets zoom to 100%', async () => {
    const user = userEvent.setup()
    render(<ImageViewer filePath="/files/diagram.png" />)

    // Zoom in twice first
    const zoomInButton = screen.getByRole('button', { name: /zoom in/i })
    await user.click(zoomInButton)
    await user.click(zoomInButton)

    await waitFor(() => {
      expect(screen.getByText('120%')).toBeInTheDocument()
    })

    // Click 1:1 button
    const oneToOneButton = screen.getByRole('button', { name: /actual size/i })
    await user.click(oneToOneButton)

    await waitFor(() => {
      expect(screen.getByText('100%')).toBeInTheDocument()
    })
  })
})

// ===========================================================================
// DocumentPreview Tests
// ===========================================================================
describe('DocumentPreview', () => {
  let DocumentPreview: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Mock fetch for text file loading
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('Hello text content'),
    }) as any
    const mod = await import('@renderer/components/documents/document-preview')
    DocumentPreview = mod.DocumentPreview
  })

  it('dispatches pdf file type to PdfViewer', () => {
    render(<DocumentPreview document={pdfDocument} />)

    const pdfDoc = screen.getByTestId('pdf-document')
    expect(pdfDoc).toBeInTheDocument()
  })

  it('dispatches image file type to ImageViewer', () => {
    render(<DocumentPreview document={imageDocument} />)

    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img.getAttribute('src')).toBe('noteko-file://localhost/files/diagram.png')
  })

  it('dispatches txt file type to text content display', async () => {
    render(<DocumentPreview document={textDocument} />)

    await waitFor(() => {
      expect(screen.getByText('Hello text content')).toBeInTheDocument()
    })
  })

  it('shows fallback for unsupported file types (exe)', () => {
    render(<DocumentPreview document={exeDocument} />)

    expect(screen.getByText(/preview not available/i)).toBeInTheDocument()
  })

  it('shows loading placeholder for processing/pending status', () => {
    render(<DocumentPreview document={processingDocument} />)

    expect(screen.getByText(/processing/i)).toBeInTheDocument()
  })

  it('shows warning for failed status', () => {
    render(<DocumentPreview document={failedDocument} />)

    expect(screen.getByText(/failed/i)).toBeInTheDocument()
  })
})

// ===========================================================================
// DocumentViewer split layout Tests
// ===========================================================================
describe('DocumentViewer split layout', () => {
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

  it('renders ResizablePanelGroup with two panels for PDF document', () => {
    render(
      <DocumentViewer
        document={pdfDocument}
        onRetry={vi.fn()}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        aiAvailable={false}
      />,
    )

    const panelGroup = screen.getByTestId('resizable-panel-group')
    expect(panelGroup).toBeInTheDocument()
    expect(panelGroup.getAttribute('data-orientation')).toBe('horizontal')

    const panels = screen.getAllByTestId('resizable-panel')
    expect(panels.length).toBe(2)

    const handle = screen.getByTestId('resizable-handle')
    expect(handle).toBeInTheDocument()
  })

  it('renders single column (no split) for unsupported file type', () => {
    render(
      <DocumentViewer
        document={exeDocument}
        onRetry={vi.fn()}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        aiAvailable={false}
      />,
    )

    expect(screen.queryByTestId('resizable-panel-group')).not.toBeInTheDocument()
  })

  it('renders breadcrumb with project_name and folder_name', () => {
    render(
      <DocumentViewer
        document={pdfDocument}
        onRetry={vi.fn()}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        aiAvailable={false}
      />,
    )

    // Project name should be a link
    const projectLink = screen.getByRole('link', { name: /research project/i })
    expect(projectLink).toBeInTheDocument()
    expect(projectLink.getAttribute('href')).toContain('/projects/1')

    // Folder name should be plain text
    expect(screen.getByText('Papers')).toBeInTheDocument()

    // Document name appears in both breadcrumb and metadata
    const docNames = screen.getAllByText('research-paper.pdf')
    expect(docNames.length).toBeGreaterThanOrEqual(1)
  })

  it('has right panel with extracted text and AiActionsPanel', () => {
    render(
      <DocumentViewer
        document={pdfDocument}
        onRetry={vi.fn()}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        aiAvailable={false}
      />,
    )

    // Right panel should have extracted text
    expect(screen.getByText('Extracted Text')).toBeInTheDocument()
    expect(screen.getByText('This is the extracted text content from the document.')).toBeInTheDocument()

    // AI Analysis section should be present
    expect(screen.getByText('AI Analysis')).toBeInTheDocument()
  })
})
