/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:chat:conversations:get': vi.fn(),
  'db:chat:messages:list': vi.fn(),
  'db:chat:conversations:delete': vi.fn(),
  'ai:chat': vi.fn(),
  'db:documents:get': vi.fn(),
  'ai:health-check': vi.fn(),
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
vi.mock('react-router', () => ({
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

// ---------------------------------------------------------------------------
// Mock Zustand chat store
// ---------------------------------------------------------------------------
let chatStoreState: any = {
  messages: [],
  streamingText: '',
  isStreaming: false,
  conversationId: null,
  currentDocumentId: null,
  error: null,
  loadConversation: vi.fn(),
  sendMessage: vi.fn(),
  appendStreamChunk: vi.fn(),
  finalizeStream: vi.fn(),
  clearConversation: vi.fn(),
  setError: vi.fn(),
  reset: vi.fn(),
}

vi.mock('@renderer/store/chat-store', () => ({
  useChatStore: Object.assign((selector: any) => selector(chatStoreState), { getState: () => chatStoreState }),
}))

// ---------------------------------------------------------------------------
// Mock sonner toast
// ---------------------------------------------------------------------------
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Mock shadcn/ui components for jsdom
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, variant, ...props }: any) => (
    <button data-variant={variant} {...props}>
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

vi.mock('@renderer/components/ui/textarea', () => ({
  Textarea: (props: any) => <textarea {...props} />,
}))

vi.mock('@renderer/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: any) => <div data-testid="alert-dialog">{children}</div>,
  AlertDialogTrigger: ({ children, ...props }: any) => (
    <div data-testid="alert-dialog-trigger" {...props}>
      {children}
    </div>
  ),
  AlertDialogContent: ({ children }: any) => <div data-testid="alert-dialog-content">{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogCancel: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogAction: ({ children, ...props }: any) => <button {...props}>{children}</button>,
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

// ---------------------------------------------------------------------------
// Import component under test (after mocks)
// ---------------------------------------------------------------------------
import { ChatPanel } from '@renderer/components/ai/chat-panel'

// ===========================================================================
// ChatPanel Integration Tests
// ===========================================================================
describe('ChatPanel Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chatStoreState = {
      messages: [],
      streamingText: '',
      isStreaming: false,
      conversationId: null,
      currentDocumentId: null,
      error: null,
      loadConversation: vi.fn(),
      sendMessage: vi.fn(),
      appendStreamChunk: vi.fn(),
      finalizeStream: vi.fn(),
      clearConversation: vi.fn(),
      setError: vi.fn(),
      reset: vi.fn(),
    }
  })

  // ─── Test 1: Input disabled when no raw text ───────────────────────

  it('should disable textarea and send button when hasRawText is false', () => {
    render(<ChatPanel documentId={42} aiAvailable={true} hasRawText={false} />)

    const textarea = screen.getByPlaceholderText(/ask a question/i)
    expect(textarea).toBeDisabled()

    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()

    // Should show "no extracted text" message
    expect(screen.getByText(/no extracted text/i)).toBeInTheDocument()
  })

  // ─── Test 2: Input disabled when Ollama unavailable ────────────────

  it('should show Ollama not connected message when aiAvailable is false', () => {
    render(<ChatPanel documentId={42} aiAvailable={false} hasRawText={true} />)

    // Should show the connection error with link to settings
    expect(screen.getByText(/ollama is not connected/i)).toBeInTheDocument()
    const settingsLink = screen.getByRole('link', { name: /settings/i })
    expect(settingsLink).toHaveAttribute('href', '/settings')

    // Input area should NOT be rendered (early return in component)
    expect(screen.queryByPlaceholderText(/ask a question/i)).not.toBeInTheDocument()
  })

  // ─── Test 3: Non-previewable layout tab structure ──────────────────
  // Note: this tests the document-viewer tab structure indirectly through
  // ChatPanel being rendered inside a tab. We verify ChatPanel renders
  // correctly in single-column context (same props regardless of layout).

  it('should render correctly in single-column context with messages displayed', () => {
    chatStoreState.messages = [
      {
        id: 1,
        conversation_id: 5,
        role: 'user',
        content: 'What does this file say?',
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 2,
        conversation_id: 5,
        role: 'assistant',
        content: 'The file contains test data.',
        created_at: '2026-01-01T00:01:00Z',
      },
    ]
    chatStoreState.conversationId = 5
    chatStoreState.currentDocumentId = 42

    render(<ChatPanel documentId={42} aiAvailable={true} hasRawText={true} />)

    // Messages should be visible
    expect(screen.getByText('What does this file say?')).toBeInTheDocument()
    expect(screen.getByText('The file contains test data.')).toBeInTheDocument()

    // Input should be enabled
    const textarea = screen.getByPlaceholderText(/ask a question/i)
    expect(textarea).not.toBeDisabled()
  })

  // ─── Test 4: Both hasRawText=false AND aiAvailable=false ───────────

  it('should prioritize aiAvailable=false over hasRawText=false (shows connection error)', () => {
    render(<ChatPanel documentId={42} aiAvailable={false} hasRawText={false} />)

    // aiAvailable check comes first in the component (early return)
    expect(screen.getByText(/ollama is not connected/i)).toBeInTheDocument()
  })
})
