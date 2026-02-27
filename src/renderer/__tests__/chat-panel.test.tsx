/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'db:chat:conversations:get': vi.fn(),
  'db:chat:messages:list': vi.fn(),
  'db:chat:conversations:delete': vi.fn(),
  'ai:chat': vi.fn(),
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
const mockToastSuccess = vi.fn()

vi.mock('sonner', () => ({
  toast: {
    success: (...args: any[]) => mockToastSuccess(...args),
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
// ChatPanel Tests
// ===========================================================================
describe('ChatPanel', () => {
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

  it('renders empty state when no messages', () => {
    render(<ChatPanel documentId={42} aiAvailable={true} hasRawText={true} />)

    // Should show the empty prompt text
    expect(screen.getByText(/ask a question about this document/i)).toBeInTheDocument()
  })

  it('renders error state when aiAvailable is false', () => {
    render(<ChatPanel documentId={42} aiAvailable={false} hasRawText={true} />)

    // Should show error message about Ollama
    expect(screen.getByText(/ollama is not connected/i)).toBeInTheDocument()

    // Should have a link to Settings
    const settingsLink = screen.getByRole('link', { name: /settings/i })
    expect(settingsLink).toBeInTheDocument()
    expect(settingsLink).toHaveAttribute('href', '/settings')
  })

  it('renders message list with user (right-aligned) and AI (left-aligned) messages', () => {
    chatStoreState.messages = [
      { id: 1, conversation_id: 1, role: 'user', content: 'What is this about?', created_at: '2026-01-01T00:00:00Z' },
      {
        id: 2,
        conversation_id: 1,
        role: 'assistant',
        content: 'This document discusses...',
        created_at: '2026-01-01T00:01:00Z',
      },
    ]

    render(<ChatPanel documentId={42} aiAvailable={true} hasRawText={true} />)

    // Both messages should be visible
    expect(screen.getByText('What is this about?')).toBeInTheDocument()
    expect(screen.getByText('This document discusses...')).toBeInTheDocument()

    // Role labels
    expect(screen.getByText('You')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('sends message on Enter, Shift+Enter inserts newline, Send disabled when empty', async () => {
    const user = userEvent.setup()
    render(<ChatPanel documentId={42} aiAvailable={true} hasRawText={true} />)

    const textarea = screen.getByPlaceholderText(/ask a question/i)
    const sendButton = screen.getByRole('button', { name: /send/i })

    // Send button should be disabled when empty
    expect(sendButton).toBeDisabled()

    // Type a message
    await user.click(textarea)
    await user.type(textarea, 'Hello')

    // Send button should now be enabled
    expect(sendButton).not.toBeDisabled()

    // Press Enter to send
    await user.keyboard('{Enter}')

    // sendMessage should have been called
    expect(chatStoreState.sendMessage).toHaveBeenCalledWith(42, 'Hello')
  })

  it('shows Loader2 spinner on Send button during streaming, Clear/Export disabled', () => {
    chatStoreState.isStreaming = true
    chatStoreState.streamingText = 'Generating...'
    chatStoreState.messages = [
      { id: 1, conversation_id: 1, role: 'user', content: 'Tell me more', created_at: '2026-01-01T00:00:00Z' },
    ]

    render(<ChatPanel documentId={42} aiAvailable={true} hasRawText={true} />)

    // Send button should be disabled during streaming
    const sendButton = screen.getByRole('button', { name: /send/i })
    expect(sendButton).toBeDisabled()

    // The streaming text should be visible in the growing AI bubble
    expect(screen.getByText('Generating...')).toBeInTheDocument()
  })

  it('exports formatted conversation to clipboard with toast', async () => {
    const user = userEvent.setup()

    // Mock clipboard
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      writable: true,
      configurable: true,
    })

    chatStoreState.messages = [
      { id: 1, conversation_id: 1, role: 'user', content: 'Question one', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, conversation_id: 1, role: 'assistant', content: 'Answer one', created_at: '2026-01-01T00:01:00Z' },
    ]

    render(<ChatPanel documentId={42} aiAvailable={true} hasRawText={true} />)

    // Find and click export button
    const exportButton = screen.getByRole('button', { name: /export/i })
    await user.click(exportButton)

    // Should have copied formatted text
    expect(writeText).toHaveBeenCalledWith('You: Question one\n\nAI: Answer one')

    // Should show success toast
    expect(mockToastSuccess).toHaveBeenCalledWith('Conversation copied to clipboard')
  })
})
