/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentDetailDto, DocumentContentDto, AiStreamEvent } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
let streamCallback: ((event: AiStreamEvent) => void) | null = null

const mockElectronAPI = {
  'db:documents:get': vi.fn(),
  'db:quizzes:list': vi.fn(),
  'doc:parse:retry': vi.fn(),
  'ai:health-check': vi.fn(),
  'ai:summarize': vi.fn(),
  'ai:extract-key-points': vi.fn(),
  'ai:extract-key-terms': vi.fn(),
  'ai:generate-quiz': vi.fn(),
  on: vi.fn((channel: string, cb: any) => {
    if (channel === 'ai:stream') {
      streamCallback = cb
    }
    return cb
  }),
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

vi.mock('@renderer/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => <div data-testid="progress" data-value={value} {...props} />,
}))

vi.mock('@renderer/components/ui/select', () => ({
  Select: ({ children, value, disabled }: any) => (
    <div data-testid="select-root" data-value={value} data-disabled={disabled}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children, ...props }: any) => (
    <button data-testid="select-trigger" {...props}>
      {children}
    </button>
  ),
  SelectValue: (props: any) => <span data-testid="select-value" {...props} />,
  SelectContent: ({ children }: any) => <div data-testid="select-content">{children}</div>,
  SelectItem: ({ children, value, ...props }: any) => (
    <div data-testid="select-item" data-value={value} {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div data-testid="alert-dialog">{children}</div>,
  AlertDialogTrigger: ({ children }: any) => <div data-testid="alert-dialog-trigger">{children}</div>,
  AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogCancel: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}))

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => <div data-testid="toaster" />,
}))

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
// Mock react-pdf and pdf-worker
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
// Mock resizable
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
const completedContent: DocumentContentDto = {
  id: 1,
  document_id: 42,
  raw_text: 'This is the extracted text content from the document.',
  summary: 'A brief summary of the document.',
  key_points: ['First key point', 'Second key point'],
  key_terms: null,
  summary_style: null,
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
// Quiz UI Integration Tests
// ===========================================================================
describe('Quiz UI Integration', () => {
  let DocumentPage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    streamCallback = null
    mockUseParams.mockReturnValue({ id: '42' })

    uiStoreState = {
      sidebarOpen: true,
      currentPageTitle: '',
      setSidebarOpen: vi.fn(),
      setCurrentPageTitle: mockSetCurrentPageTitle,
    }

    mockElectronAPI['db:documents:get'].mockResolvedValue({
      success: true,
      data: completedDocument,
    })

    mockElectronAPI['ai:health-check'].mockResolvedValue({
      success: true,
      data: { connected: true, models: ['llama3'] },
    })

    mockElectronAPI['db:quizzes:list'].mockResolvedValue({
      success: true,
      data: [],
    })

    mockElectronAPI['ai:generate-quiz'].mockResolvedValue({
      success: true,
      data: undefined,
    })

    // Reset module cache to pick up fresh mocks
    vi.resetModules()
    const mod = await import('@renderer/pages/document-page')
    DocumentPage = mod.DocumentPage
  })

  it('calls ai:generate-quiz with correct documentId and options when handleGenerateQuiz is triggered', async () => {
    const user = userEvent.setup()
    render(<DocumentPage />)

    // Wait for the document to load
    await waitFor(() => {
      expect(screen.getAllByText('research-paper.pdf').length).toBeGreaterThanOrEqual(1)
    })

    // Find the Generate Quiz button and click it
    const generateQuizBtn = await screen.findByRole('button', { name: /generate quiz/i })
    expect(generateQuizBtn).toBeInTheDocument()

    await user.click(generateQuizBtn)

    // Verify the IPC call was made with the correct documentId and default options
    expect(mockElectronAPI['ai:generate-quiz']).toHaveBeenCalledWith(42, {
      questionCount: 10,
      questionTypes: 'all',
      difficulty: 'medium',
    })
  })

  it('updates streamingText and streamingType state when quiz stream events arrive', async () => {
    render(<DocumentPage />)

    // Wait for the document to load
    await waitFor(() => {
      expect(screen.getAllByText('research-paper.pdf').length).toBeGreaterThanOrEqual(1)
    })

    // The stream callback should have been registered
    expect(streamCallback).not.toBeNull()

    // Simulate a quiz stream event arriving (as if we already clicked generate)
    // First, set up processing state by clicking generate quiz
    const user = userEvent.setup()
    const generateQuizBtn = await screen.findByRole('button', { name: /generate quiz/i })
    await user.click(generateQuizBtn)

    // Simulate streaming chunk events with operationType 'quiz'
    act(() => {
      streamCallback!({
        documentId: 42,
        operationType: 'quiz',
        chunk: 'Question 1: What is ',
        done: false,
      })
    })

    // The streaming text should be visible in the quiz streaming box
    await waitFor(() => {
      expect(screen.getByText(/Generating quiz/i)).toBeInTheDocument()
    })

    // Send another chunk
    act(() => {
      streamCallback!({
        documentId: 42,
        operationType: 'quiz',
        chunk: 'photosynthesis?',
        done: false,
      })
    })

    // Both chunks should be accumulated
    await waitFor(() => {
      expect(screen.getByText(/Question 1: What is photosynthesis\?/)).toBeInTheDocument()
    })
  })

  it('refreshes quiz list after quiz generation completes (done event)', async () => {
    render(<DocumentPage />)

    // Wait for the document to load
    await waitFor(() => {
      expect(screen.getAllByText('research-paper.pdf').length).toBeGreaterThanOrEqual(1)
    })

    // Initial quiz list fetch on mount
    await waitFor(() => {
      expect(mockElectronAPI['db:quizzes:list']).toHaveBeenCalledWith(42)
    })

    // Clear the call history to track the refetch
    mockElectronAPI['db:quizzes:list'].mockClear()

    // Now return a quiz after generation
    mockElectronAPI['db:quizzes:list'].mockResolvedValue({
      success: true,
      data: [
        {
          id: 1,
          document_id: 42,
          title: 'Quiz on Research Paper',
          created_at: '2026-02-22T10:00:00Z',
          question_count: 10,
          difficulty_level: 'medium',
          question_types: 'all',
        },
      ],
    })

    // Click generate quiz to start processing
    const user = userEvent.setup()
    const generateQuizBtn = await screen.findByRole('button', { name: /generate quiz/i })
    await user.click(generateQuizBtn)

    // Simulate done event
    act(() => {
      streamCallback!({
        documentId: 42,
        operationType: 'quiz',
        chunk: '',
        done: true,
        quizId: 1,
      })
    })

    // After done, the quiz list should be refetched
    await waitFor(() => {
      expect(mockElectronAPI['db:quizzes:list']).toHaveBeenCalledWith(42)
    })

    // The quiz title should appear in the list
    await waitFor(() => {
      expect(screen.getByText('Quiz on Research Paper')).toBeInTheDocument()
    })
  })

  it('shows toast notification with "View Quiz" action when quiz generation completes with quizId', async () => {
    const { toast } = await import('sonner')

    render(<DocumentPage />)

    // Wait for the document to load
    await waitFor(() => {
      expect(screen.getAllByText('research-paper.pdf').length).toBeGreaterThanOrEqual(1)
    })

    // Click generate quiz to enter processing state
    const user = userEvent.setup()
    const generateQuizBtn = await screen.findByRole('button', { name: /generate quiz/i })
    await user.click(generateQuizBtn)

    // Simulate done event with quizId
    act(() => {
      streamCallback!({
        documentId: 42,
        operationType: 'quiz',
        chunk: '',
        done: true,
        quizId: 99,
      })
    })

    // Assert: toast.success was called with "Quiz generated!" and an action
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Quiz generated!',
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'View Quiz',
          }),
        }),
      )
    })
  })
})
