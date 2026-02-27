import { create } from 'zustand'
import type { ChatMessageDto } from '@shared/types'

// Guard against permanently-stuck streaming state (e.g. missed done event)
let streamingTimer: ReturnType<typeof setTimeout> | null = null

interface ChatStore {
  messages: ChatMessageDto[]
  streamingText: string
  isStreaming: boolean
  conversationId: number | null
  currentDocumentId: number | null
  error: string | null

  loadConversation: (documentId: number) => Promise<void>
  sendMessage: (documentId: number, content: string) => Promise<void>
  appendStreamChunk: (chunk: string) => void
  finalizeStream: (content: string, conversationId: number) => void
  clearConversation: (documentId: number) => Promise<void>
  setError: (error: string | null) => void
  reset: () => void
}

const initialState = {
  messages: [] as ChatMessageDto[],
  streamingText: '',
  isStreaming: false,
  conversationId: null as number | null,
  currentDocumentId: null as number | null,
  error: null as string | null,
}

export const useChatStore = create<ChatStore>((set, get) => ({
  ...initialState,

  loadConversation: async (documentId) => {
    set({ error: null })
    try {
      const convResult = await window.electronAPI['db:chat:conversations:get'](documentId)
      if (!convResult.success) {
        set({ error: convResult.error.message })
        return
      }

      const msgsResult = await window.electronAPI['db:chat:messages:list'](convResult.data.id)
      if (!msgsResult.success) {
        set({ error: msgsResult.error.message })
        return
      }

      set({
        messages: msgsResult.data,
        conversationId: convResult.data.id,
        currentDocumentId: documentId,
      })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Unknown error' })
    }
  },

  sendMessage: async (documentId, content) => {
    const { conversationId } = get()

    // Add optimistic user message
    const optimisticMessage: ChatMessageDto = {
      id: -Date.now(),
      conversation_id: conversationId ?? 0,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }

    set((state) => ({ messages: [...state.messages, optimisticMessage], isStreaming: true, error: null }))

    // Guard: reset streaming state if done event is never received (e.g. network error)
    if (streamingTimer) clearTimeout(streamingTimer)
    streamingTimer = setTimeout(() => {
      if (useChatStore.getState().isStreaming) {
        useChatStore.setState({ isStreaming: false, streamingText: '', error: 'Response timed out' })
      }
      streamingTimer = null
    }, 120_000)

    try {
      await window.electronAPI['ai:chat']({
        documentId,
        conversationId,
        message: content,
      })
    } catch (err) {
      if (streamingTimer) {
        clearTimeout(streamingTimer)
        streamingTimer = null
      }
      set({
        error: err instanceof Error ? err.message : 'Unknown error',
        isStreaming: false,
      })
    }
  },

  appendStreamChunk: (chunk) => {
    set((state) => ({ streamingText: state.streamingText + chunk }))
  },

  finalizeStream: (content, conversationId) => {
    if (streamingTimer) {
      clearTimeout(streamingTimer)
      streamingTimer = null
    }

    const assistantMessage: ChatMessageDto = {
      id: -Date.now(),
      conversation_id: conversationId,
      role: 'assistant',
      content,
      created_at: new Date().toISOString(),
    }

    set((state) => ({
      messages: [...state.messages, assistantMessage],
      streamingText: '',
      isStreaming: false,
      conversationId,
    }))
  },

  clearConversation: async () => {
    const { conversationId } = get()

    if (conversationId != null) {
      try {
        const result = await window.electronAPI['db:chat:conversations:delete'](conversationId)
        if (!result.success) {
          set({ error: result.error.message })
          return
        }
      } catch (err) {
        set({ error: err instanceof Error ? err.message : 'Unknown error' })
        return
      }
    }

    set({
      messages: [],
      streamingText: '',
      isStreaming: false,
      conversationId: null,
      error: null,
    })
  },

  setError: (error) => set({ error }),

  reset: () => set({ ...initialState }),
}))
