/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Group 7 — Strategic Gap Tests
 *
 * These tests fill coverage gaps identified during the test review & gap analysis.
 * Focus areas:
 *   - Event subscription cleanup (no leaks after unmount)
 *   - Document store processing_status handling
 *   - Settings page handles Ollama unavailable
 *   - AiActionsPanel messaging for various states
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, act } from '@testing-library/react'
import type { DocumentDetailDto, DocumentContentDto } from '@shared/types'

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
// Mock electronAPI — shared across renderer tests in this file
// ---------------------------------------------------------------------------
const mockElectronAPI: Record<string, any> = {
  'db:documents:get': vi.fn(),
  'doc:parse:retry': vi.fn(),
  'ai:health-check': vi.fn(),
  'ai:summarize': vi.fn(),
  'ai:extract-key-points': vi.fn(),
  'ai:list-models': vi.fn(),
  'settings:get': vi.fn(),
  'settings:set': vi.fn(),
  'settings:get-all': vi.fn(),
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

vi.mock('@renderer/store/ui-store', () => ({
  useUIStore: (selector: any) =>
    selector({
      sidebarOpen: true,
      currentPageTitle: '',
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

vi.mock('@renderer/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@renderer/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

// ---------------------------------------------------------------------------
// Mock react-pdf and pdf-worker (used transitively by DocumentViewer)
// ---------------------------------------------------------------------------
vi.mock('react-pdf', () => ({
  Document: ({ children, ...props }: any) => (
    <div data-testid="pdf-document" {...props}>
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
// Mock resizable to avoid ResizeObserver issues
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
// Test data helpers
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
  file_type: 'pdf',
  file_size: 2457600,
  folder_id: 1,
  project_id: 1,
  processing_status: 'completed',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-15T10:00:00Z',
  content: completedContent,
  project_name: 'Test Project',
  folder_name: 'Test Folder',
}

// ===========================================================================
// Test 1: DocumentPage - cleans up ai:stream event subscription on unmount
// ===========================================================================
describe('DocumentPage event subscription cleanup', () => {
  let DocumentPage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()
    mockUseParams.mockReturnValue({ id: '42' })

    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: completedDocument,
    })

    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: false, models: [] },
    })

    // Track the wrapped listener returned by on()
    const wrappedListener = vi.fn()
    mockElectronAPI.on.mockReturnValue(wrappedListener)

    const mod = await import('@renderer/pages/document-page')
    DocumentPage = mod.DocumentPage
  })

  afterEach(() => {
    cleanup()
  })

  it('calls off() with the wrapped listener reference when unmounting', async () => {
    const wrappedRef = vi.fn()
    mockElectronAPI.on.mockReturnValue(wrappedRef)

    const { unmount } = render(<DocumentPage />)

    // Wait for component to mount and subscribe
    await waitFor(() => {
      expect(mockElectronAPI.on).toHaveBeenCalledWith('ai:stream', expect.any(Function))
    })

    // Unmount should call off() with the same wrapped listener reference
    unmount()

    expect(mockElectronAPI.off).toHaveBeenCalledWith('ai:stream', wrappedRef)
  })
})

// ===========================================================================
// Test 2: Settings page renders Ollama unavailable message
// ===========================================================================
describe('Settings page handles Ollama unavailable', () => {
  let OllamaSettings: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    // Ollama is NOT connected
    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: false, models: [] },
    })

    // No models available
    mockElectronAPI['ai:list-models'].mockResolvedValue({
      success: true,
      data: [],
    })

    const mod = await import('@renderer/components/settings/ollama-settings')
    OllamaSettings = mod.OllamaSettings
  })

  it('shows setup guide and "Disconnected" when Ollama is not connected', async () => {
    render(<OllamaSettings settings={{}} />)

    // Wait for health check to complete
    await waitFor(() => {
      expect(screen.getByText(/disconnected/i)).toBeInTheDocument()
    })

    // Setup guide should be shown
    expect(screen.getByText(/ollama setup guide/i)).toBeInTheDocument()
    expect(screen.getByText(/ollama.ai/i)).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 3: Document store handles processing_status in documents
// ===========================================================================
describe('Document store processing_status handling', () => {
  let useDocumentStore: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    const mod = await import('@renderer/store/document-store')
    useDocumentStore = mod.useDocumentStore
  })

  it('stores and retrieves documents with processing_status field', async () => {
    const docWithStatus = {
      id: 1,
      name: 'Test Doc',
      file_path: '/test.pdf',
      file_type: 'pdf',
      file_size: 1024,
      folder_id: 1,
      project_id: 1,
      processing_status: 'completed' as const,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }

    act(() => {
      useDocumentStore.getState().addDocument(docWithStatus)
    })

    const state = useDocumentStore.getState()
    expect(state.documents[0].processing_status).toBe('completed')
  })

  it('handles mixed processing_status values in document list', async () => {
    const docs = [
      {
        id: 1,
        name: 'Doc A',
        file_path: '/a.pdf',
        file_type: 'pdf',
        file_size: 100,
        folder_id: 1,
        project_id: 1,
        processing_status: 'pending' as const,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 2,
        name: 'Doc B',
        file_path: '/b.pdf',
        file_type: 'pdf',
        file_size: 200,
        folder_id: 1,
        project_id: 1,
        processing_status: 'failed' as const,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: 3,
        name: 'Doc C',
        file_path: '/c.pdf',
        file_type: 'pdf',
        file_size: 300,
        folder_id: 1,
        project_id: 1,
        processing_status: 'completed' as const,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ]

    mockElectronAPI['db:documents:list-by-project'] = vi.fn().mockResolvedValue({
      success: true,
      data: docs,
    })
    // Re-set on the window object
    ;(window.electronAPI as any)['db:documents:list-by-project'] = mockElectronAPI['db:documents:list-by-project']

    await act(async () => {
      await useDocumentStore.getState().fetchDocumentsByProject(1)
    })

    const state = useDocumentStore.getState()
    expect(state.documents).toHaveLength(3)
    const statuses = state.documents.map((d: any) => d.processing_status)
    expect(statuses).toContain('pending')
    expect(statuses).toContain('failed')
    expect(statuses).toContain('completed')
  })
})

// ===========================================================================
// Test 4: AiActionsPanel shows correct messages for various states
// ===========================================================================
describe('AiActionsPanel messaging', () => {
  let AiActionsPanel: any

  beforeEach(async () => {
    vi.clearAllMocks()
    vi.resetModules()

    const mod = await import('@renderer/components/ai/ai-actions-panel')
    AiActionsPanel = mod.AiActionsPanel
  })

  it('shows Ollama not connected message when AI is unavailable', () => {
    render(
      <AiActionsPanel
        hasRawText={true}
        aiAvailable={false}
        summary={null}
        keyPoints={null}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        isSummarizing={false}
        isExtractingKeyPoints={false}
      />,
    )

    expect(screen.getByText(/ollama is not connected/i)).toBeInTheDocument()
  })

  it('shows "parse the document first" message when no raw text', () => {
    render(
      <AiActionsPanel
        hasRawText={false}
        aiAvailable={true}
        summary={null}
        keyPoints={null}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        isSummarizing={false}
        isExtractingKeyPoints={false}
      />,
    )

    expect(screen.getByText(/requires extracted text/i)).toBeInTheDocument()
  })

  it('displays existing summary and key points when available', () => {
    render(
      <AiActionsPanel
        hasRawText={true}
        aiAvailable={true}
        summary="This is the summary of the document."
        keyPoints={['Point A', 'Point B']}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        isSummarizing={false}
        isExtractingKeyPoints={false}
      />,
    )

    expect(screen.getByText('This is the summary of the document.')).toBeInTheDocument()
    expect(screen.getByText('Point A')).toBeInTheDocument()
    expect(screen.getByText('Point B')).toBeInTheDocument()
  })

  it('shows streaming text during active summarization', () => {
    render(
      <AiActionsPanel
        hasRawText={true}
        aiAvailable={true}
        summary={null}
        keyPoints={null}
        onSummarize={vi.fn()}
        onExtractKeyPoints={vi.fn()}
        isSummarizing={true}
        isExtractingKeyPoints={false}
        streamingText="Partial summary text..."
        streamingType="summary"
      />,
    )

    expect(screen.getByText('Partial summary text...')).toBeInTheDocument()
    expect(screen.getByText(/generating summary/i)).toBeInTheDocument()
  })
})
