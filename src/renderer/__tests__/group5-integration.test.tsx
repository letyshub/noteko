/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Group 5 -- Integration Tests
 *
 * Verifies end-to-end integration of the document viewer feature across
 * Groups 1-4: document-utils helpers, split/single-column layout,
 * breadcrumb data, view mode round-trip, and noteko-file:// URL construction.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { DocumentDetailDto, DocumentContentDto, DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Polyfills for jsdom (needed by react-pdf / react-resizable-panels)
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
const mockSetDocumentViewMode = vi.fn()

let uiStoreState: Record<string, any> = {
  sidebarOpen: true,
  currentPageTitle: '',
  documentViewMode: 'list',
  setSidebarOpen: vi.fn(),
  setCurrentPageTitle: mockSetCurrentPageTitle,
  setDocumentViewMode: mockSetDocumentViewMode,
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
  Button: ({ children, variant, size, ...props }: any) => (
    <button data-variant={variant} data-size={size} {...props}>
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
// Mock react-pdf and pdf-worker
// ---------------------------------------------------------------------------
vi.mock('react-pdf', () => ({
  Document: ({ children, file, ...props }: any) => (
    <div data-testid="pdf-document" data-file={file} {...props}>
      {children}
    </div>
  ),
  Page: ({ pageNumber, scale }: any) => (
    <div data-testid="pdf-page" data-page={pageNumber} data-scale={scale}>
      Page {pageNumber}
    </div>
  ),
}))

vi.mock('@renderer/lib/pdf-worker', () => ({}))

// ---------------------------------------------------------------------------
// Mock resizable panels
// ---------------------------------------------------------------------------
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
const pdfContent: DocumentContentDto = {
  id: 1,
  document_id: 42,
  raw_text: 'Extracted PDF text for integration testing.',
  summary: 'A summary.',
  key_points: ['Point A', 'Point B'],
  processed_at: '2026-01-15T10:00:00Z',
}

const pdfDocument: DocumentDetailDto = {
  id: 42,
  name: 'integration-test.pdf',
  file_path: '/docs/integration-test.pdf',
  file_type: 'pdf',
  file_size: 2457600,
  folder_id: 1,
  project_id: 1,
  processing_status: 'completed',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  content: pdfContent,
  project_name: 'Integration Project',
  folder_name: 'Test Folder',
}

const exeDocument: DocumentDetailDto = {
  ...pdfDocument,
  id: 50,
  name: 'installer.exe',
  file_path: '/files/installer.exe',
  file_type: 'exe',
  content: null,
  project_name: 'Integration Project',
  folder_name: 'Binaries',
}

const testDocumentsForGrid: DocumentDto[] = [
  {
    id: 1,
    name: 'alpha.pdf',
    file_path: '/files/alpha.pdf',
    file_type: 'pdf',
    file_size: 1048576,
    folder_id: 1,
    project_id: 1,
    processing_status: 'completed',
    created_at: '2026-01-10T08:00:00Z',
    updated_at: '2026-01-10T08:00:00Z',
  },
  {
    id: 2,
    name: 'beta.png',
    file_path: '/files/beta.png',
    file_type: 'png',
    file_size: 524288,
    folder_id: 1,
    project_id: 1,
    processing_status: 'completed',
    created_at: '2026-01-15T12:00:00Z',
    updated_at: '2026-01-15T12:00:00Z',
  },
]

// ===========================================================================
// Integration Test 1: DocumentPage renders DocumentViewer with split layout for PDF
// ===========================================================================
describe('Integration: DocumentPage renders split layout for PDF', () => {
  let DocumentPage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ id: '42' })

    uiStoreState = {
      sidebarOpen: true,
      currentPageTitle: '',
      documentViewMode: 'list',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
      setDocumentViewMode: mockSetDocumentViewMode,
    }

    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: pdfDocument,
    })

    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: false, models: [] },
    })

    const mod = await import('@renderer/pages/document-page')
    DocumentPage = mod.DocumentPage
  })

  it('renders DocumentViewer with resizable split layout for a PDF document', async () => {
    render(<DocumentPage />)

    // Wait for document to load
    await waitFor(() => {
      expect(screen.getAllByText('integration-test.pdf').length).toBeGreaterThanOrEqual(1)
    })

    // Split layout: ResizablePanelGroup should be present
    const panelGroup = screen.getByTestId('resizable-panel-group')
    expect(panelGroup).toBeInTheDocument()
    expect(panelGroup.getAttribute('data-orientation')).toBe('horizontal')

    // Two panels (left = preview, right = metadata/ai/text)
    const panels = screen.getAllByTestId('resizable-panel')
    expect(panels.length).toBe(2)

    // Resizable handle should be present
    expect(screen.getByTestId('resizable-handle')).toBeInTheDocument()

    // PDF viewer should be rendered inside left panel
    expect(screen.getByTestId('pdf-document')).toBeInTheDocument()

    // Extracted text should be in right panel
    expect(screen.getByText('Extracted PDF text for integration testing.')).toBeInTheDocument()
  })
})

// ===========================================================================
// Integration Test 2: DocumentPage renders without split layout for unsupported type
// ===========================================================================
describe('Integration: DocumentPage renders single-column for unsupported file type', () => {
  let DocumentPage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUseParams.mockReturnValue({ id: '50' })

    uiStoreState = {
      sidebarOpen: true,
      currentPageTitle: '',
      documentViewMode: 'list',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
      setDocumentViewMode: mockSetDocumentViewMode,
    }

    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: exeDocument,
    })

    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: false, models: [] },
    })

    const mod = await import('@renderer/pages/document-page')
    DocumentPage = mod.DocumentPage
  })

  it('renders DocumentViewer without split layout for an unsupported file type', async () => {
    render(<DocumentPage />)

    // Wait for document to load
    await waitFor(() => {
      expect(screen.getAllByText('installer.exe').length).toBeGreaterThanOrEqual(1)
    })

    // No split layout: no ResizablePanelGroup
    expect(screen.queryByTestId('resizable-panel-group')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Integration Test 3: Breadcrumb displays project_name and folder_name
// ===========================================================================
describe('Integration: Breadcrumb displays project and folder names', () => {
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

  it('displays project_name as a link and folder_name in the breadcrumb', () => {
    render(
      <DocumentViewer
        document={pdfDocument}
        onRetry={vi.fn()}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        aiAvailable={false}
      />,
    )

    // Project name should be a link to the project page
    const projectLink = screen.getByRole('link', { name: /integration project/i })
    expect(projectLink).toBeInTheDocument()
    expect(projectLink.getAttribute('href')).toContain('/projects/1')

    // Folder name should appear as text
    expect(screen.getByText('Test Folder')).toBeInTheDocument()

    // Document name should appear in the breadcrumb
    const docNames = screen.getAllByText('integration-test.pdf')
    expect(docNames.length).toBeGreaterThanOrEqual(1)
  })
})

// ===========================================================================
// Integration Test 4: View mode round-trip (grid <-> list)
// ===========================================================================
describe('Integration: View mode round-trip via DocumentList', () => {
  let DocumentList: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('@renderer/components/documents/document-list')
    DocumentList = mod.DocumentList
  })

  it('renders list rows when viewMode is "list" and grid cards when viewMode is "grid"', () => {
    // First render with viewMode='list'
    const { unmount } = render(
      <DocumentList documents={testDocumentsForGrid} onDeleteDocument={vi.fn()} viewMode="list" />,
    )

    // List mode: should have document-row data-testid elements
    const rows = screen.getAllByTestId('document-row')
    expect(rows.length).toBe(2)
    expect(screen.queryByTestId('grid-card')).not.toBeInTheDocument()
    unmount()

    // Now render with viewMode='grid'
    render(<DocumentList documents={testDocumentsForGrid} onDeleteDocument={vi.fn()} viewMode="grid" />)

    // Grid mode: should have grid-card data-testid elements
    const cards = screen.getAllByTestId('grid-card')
    expect(cards.length).toBe(2)
    expect(screen.queryByTestId('document-row')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Integration Test 5: noteko-file:// URLs are correctly constructed
// ===========================================================================
describe('Integration: noteko-file:// URLs are correctly constructed', () => {
  it('document-utils helpers classify bare extensions correctly', async () => {
    const { isPdf, isImage, isTextBased, isPreviewable } = await import('@renderer/components/documents/document-utils')

    // PDF
    expect(isPdf('pdf')).toBe(true)
    expect(isPdf('application/pdf')).toBe(false)

    // Image
    expect(isImage('png')).toBe(true)
    expect(isImage('jpg')).toBe(true)
    expect(isImage('image/png')).toBe(false)

    // Text-based
    expect(isTextBased('txt')).toBe(true)
    expect(isTextBased('md')).toBe(true)
    expect(isTextBased('text/plain')).toBe(false)

    // Previewable
    expect(isPreviewable('pdf')).toBe(true)
    expect(isPreviewable('png')).toBe(true)
    expect(isPreviewable('txt')).toBe(true)
    expect(isPreviewable('exe')).toBe(false)
    expect(isPreviewable('zip')).toBe(false)
  })

  it('PdfViewer constructs noteko-file:// URL from file_path', async () => {
    const { PdfViewer } = await import('@renderer/components/documents/pdf-viewer')
    render(<PdfViewer filePath="/documents/sample.pdf" />)

    const pdfDoc = screen.getByTestId('pdf-document')
    expect(pdfDoc.getAttribute('data-file')).toBe('noteko-file://localhost/documents/sample.pdf')
  })

  it('ImageViewer constructs noteko-file:// URL from file_path', async () => {
    const { ImageViewer } = await import('@renderer/components/documents/image-viewer')
    render(<ImageViewer filePath="/images/photo.jpg" />)

    const img = screen.getByRole('img')
    expect(img.getAttribute('src')).toBe('noteko-file://localhost/images/photo.jpg')
  })
})
