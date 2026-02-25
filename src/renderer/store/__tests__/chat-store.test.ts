import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import type { IpcResult } from '@shared/ipc'
import type { ChatConversationDto, ChatMessageDto } from '@shared/types'

// Mock electronAPI before importing the store
const mockElectronAPI = {
  'ai:chat': vi.fn(),
  'db:chat:conversations:get': vi.fn(),
  'db:chat:messages:list': vi.fn(),
  'db:chat:messages:create': vi.fn(),
  'db:chat:conversations:delete': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// Import store after mock is set up
const { useChatStore } = await import('../chat-store')

const mockConversation: ChatConversationDto = {
  id: 10,
  document_id: 1,
  title: 'Test Conversation',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const mockMessage: ChatMessageDto = {
  id: 100,
  conversation_id: 10,
  role: 'user',
  content: 'Hello AI',
  created_at: '2026-01-01T00:00:00Z',
}

const mockAssistantMessage: ChatMessageDto = {
  id: 101,
  conversation_id: 10,
  role: 'assistant',
  content: 'Hello! How can I help?',
  created_at: '2026-01-01T00:00:01Z',
}

const initialState = {
  messages: [],
  streamingText: '',
  isStreaming: false,
  conversationId: null,
  currentDocumentId: null,
  error: null,
}

describe('useChatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useChatStore.setState(initialState)
  })

  describe('loadConversation', () => {
    it('should fetch conversation and messages from IPC and set state', async () => {
      const convResult: IpcResult<ChatConversationDto> = {
        success: true,
        data: mockConversation,
      }
      const msgsResult: IpcResult<ChatMessageDto[]> = {
        success: true,
        data: [mockMessage, mockAssistantMessage],
      }
      mockElectronAPI['db:chat:conversations:get'].mockResolvedValue(convResult)
      mockElectronAPI['db:chat:messages:list'].mockResolvedValue(msgsResult)

      await act(async () => {
        await useChatStore.getState().loadConversation(1)
      })

      const state = useChatStore.getState()
      expect(state.messages).toEqual([mockMessage, mockAssistantMessage])
      expect(state.conversationId).toBe(10)
      expect(state.currentDocumentId).toBe(1)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:chat:conversations:get']).toHaveBeenCalledWith(1)
      expect(mockElectronAPI['db:chat:messages:list']).toHaveBeenCalledWith(10)
    })

    it('should set error when conversation fetch fails', async () => {
      const convResult: IpcResult<ChatConversationDto> = {
        success: false,
        error: { code: 'DB_ERROR', message: 'Failed to load conversation' },
      }
      mockElectronAPI['db:chat:conversations:get'].mockResolvedValue(convResult)

      await act(async () => {
        await useChatStore.getState().loadConversation(1)
      })

      const state = useChatStore.getState()
      expect(state.messages).toEqual([])
      expect(state.error).toBe('Failed to load conversation')
    })
  })

  describe('sendMessage', () => {
    it('should add optimistic user message to state and trigger IPC', async () => {
      useChatStore.setState({ conversationId: 10, currentDocumentId: 1, messages: [] })

      const chatResult: IpcResult<void> = { success: true, data: undefined }
      mockElectronAPI['ai:chat'].mockResolvedValue(chatResult)

      await act(async () => {
        await useChatStore.getState().sendMessage(1, 'What is this document about?')
      })

      const state = useChatStore.getState()
      // Should have the optimistic user message
      expect(state.messages.length).toBe(1)
      expect(state.messages[0].role).toBe('user')
      expect(state.messages[0].content).toBe('What is this document about?')
      expect(state.isStreaming).toBe(true)
      expect(mockElectronAPI['ai:chat']).toHaveBeenCalledWith(
        expect.objectContaining({
          documentId: 1,
          conversationId: 10,
          message: 'What is this document about?',
        }),
      )
    })
  })

  describe('appendStreamChunk', () => {
    it('should accumulate streaming text correctly', () => {
      act(() => {
        useChatStore.getState().appendStreamChunk('Hello')
      })
      expect(useChatStore.getState().streamingText).toBe('Hello')

      act(() => {
        useChatStore.getState().appendStreamChunk(' world')
      })
      expect(useChatStore.getState().streamingText).toBe('Hello world')

      act(() => {
        useChatStore.getState().appendStreamChunk('!')
      })
      expect(useChatStore.getState().streamingText).toBe('Hello world!')
    })
  })

  describe('finalizeStream', () => {
    it('should add assistant message, clear streaming state, and update conversationId', () => {
      useChatStore.setState({
        messages: [mockMessage],
        streamingText: 'Some streamed text',
        isStreaming: true,
        conversationId: null,
      })

      act(() => {
        useChatStore.getState().finalizeStream('Final assistant response', 10)
      })

      const state = useChatStore.getState()
      expect(state.messages.length).toBe(2)
      expect(state.messages[1].role).toBe('assistant')
      expect(state.messages[1].content).toBe('Final assistant response')
      expect(state.streamingText).toBe('')
      expect(state.isStreaming).toBe(false)
      expect(state.conversationId).toBe(10)
    })
  })

  describe('clearConversation', () => {
    it('should call delete IPC and reset state', async () => {
      useChatStore.setState({
        messages: [mockMessage],
        conversationId: 10,
        currentDocumentId: 1,
      })

      const deleteResult: IpcResult<void> = { success: true, data: undefined }
      mockElectronAPI['db:chat:conversations:delete'].mockResolvedValue(deleteResult)

      await act(async () => {
        await useChatStore.getState().clearConversation(1)
      })

      const state = useChatStore.getState()
      expect(state.messages).toEqual([])
      expect(state.conversationId).toBeNull()
      expect(state.streamingText).toBe('')
      expect(state.isStreaming).toBe(false)
      expect(state.error).toBeNull()
      expect(mockElectronAPI['db:chat:conversations:delete']).toHaveBeenCalledWith(10)
    })

    it('should reset state even when no conversation exists', async () => {
      useChatStore.setState({
        messages: [],
        conversationId: null,
        currentDocumentId: null,
      })

      await act(async () => {
        await useChatStore.getState().clearConversation(1)
      })

      const state = useChatStore.getState()
      expect(state.messages).toEqual([])
      expect(state.conversationId).toBeNull()
      expect(mockElectronAPI['db:chat:conversations:delete']).not.toHaveBeenCalled()
    })
  })

  describe('reset', () => {
    it('should clear all state', () => {
      useChatStore.setState({
        messages: [mockMessage],
        streamingText: 'partial',
        isStreaming: true,
        conversationId: 10,
        currentDocumentId: 1,
        error: 'some error',
      })

      act(() => {
        useChatStore.getState().reset()
      })

      const state = useChatStore.getState()
      expect(state.messages).toEqual([])
      expect(state.streamingText).toBe('')
      expect(state.isStreaming).toBe(false)
      expect(state.conversationId).toBeNull()
      expect(state.currentDocumentId).toBeNull()
      expect(state.error).toBeNull()
    })
  })
})
