import { useEffect, useRef, useCallback, useState } from 'react'
import { MessageCircle, AlertCircle, Send, Trash2, Copy, Loader2 } from 'lucide-react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Textarea } from '@renderer/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'
import { useChatStore } from '@renderer/store/chat-store'
import type { AiStreamEvent } from '@shared/types'
import type { WrappedListener } from '@shared/ipc'

interface ChatPanelProps {
  documentId: number
  aiAvailable: boolean
  hasRawText: boolean
}

export function ChatPanel({ documentId, aiAvailable, hasRawText }: ChatPanelProps) {
  const messages = useChatStore((s) => s.messages)
  const streamingText = useChatStore((s) => s.streamingText)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const clearConversation = useChatStore((s) => s.clearConversation)

  const [inputValue, setInputValue] = useState('')
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const wrappedListenerRef = useRef<WrappedListener | null>(null)

  // Load conversation when document changes
  useEffect(() => {
    useChatStore.getState().loadConversation(documentId)
    return () => {
      useChatStore.getState().reset()
    }
  }, [documentId])

  // Subscribe to ai:stream events for chat
  const handleStreamEvent = useCallback(
    (event: AiStreamEvent) => {
      if (event.operationType !== 'chat') return
      if (event.documentId !== documentId) return

      if (event.done) {
        const fullText = useChatStore.getState().streamingText + (event.chunk || '')
        useChatStore.getState().finalizeStream(fullText, event.conversationId!)
        return
      }

      if (event.error) {
        useChatStore.getState().setError(event.error)
        return
      }

      useChatStore.getState().appendStreamChunk(event.chunk)
    },
    [documentId],
  )

  useEffect(() => {
    const wrapped = window.electronAPI.on('ai:stream', handleStreamEvent)
    wrappedListenerRef.current = wrapped

    return () => {
      if (wrappedListenerRef.current) {
        window.electronAPI.off('ai:stream', wrappedListenerRef.current)
        wrappedListenerRef.current = null
      }
    }
  }, [handleStreamEvent])

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]')
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight
      } else {
        // Fallback: scroll the ref element itself
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
      }
    }
  }, [messages, streamingText])

  // Send message handler
  const handleSend = useCallback(() => {
    const content = inputValue.trim()
    if (!content || isStreaming || !aiAvailable || !hasRawText) return

    sendMessage(documentId, content)
    setInputValue('')
  }, [documentId, inputValue, isStreaming, aiAvailable, hasRawText, sendMessage])

  // Handle key press in textarea
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  // Export conversation to clipboard
  const handleExport = useCallback(async () => {
    const formatted = messages
      .map((m) => {
        const role = m.role === 'user' ? 'You' : 'AI'
        return `${role}: ${m.content}`
      })
      .join('\n\n')

    await navigator.clipboard.writeText(formatted)
    toast.success('Conversation copied to clipboard')
  }, [messages])

  // Clear conversation handler
  const handleClear = useCallback(() => {
    clearConversation(documentId)
  }, [documentId, clearConversation])

  const canSend = !isStreaming && aiAvailable && hasRawText
  const canSubmit = canSend && inputValue.trim().length > 0
  const hasMessages = messages.length > 0

  // Error state: AI not available
  if (!aiAvailable) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <AlertCircle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium">Ollama is not connected</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Configure Ollama in{' '}
            <Link to="/settings" className="text-primary underline">
              Settings
            </Link>{' '}
            to enable chat.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Message area */}
      <ScrollArea className="flex-1" ref={scrollAreaRef}>
        <div className="flex flex-col gap-3 p-4">
          {!hasMessages && !streamingText ? (
            /* Empty state */
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-12 text-center">
              <MessageCircle className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Ask a question about this document</p>
            </div>
          ) : (
            <>
              {/* Message list */}
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 ${
                      message.role === 'user' ? 'bg-primary/10' : 'bg-muted/50 border'
                    }`}
                  >
                    <p className="text-xs text-muted-foreground mb-1">{message.role === 'user' ? 'You' : 'AI'}</p>
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}

              {/* Streaming AI message bubble */}
              {isStreaming && streamingText && (
                <div className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg px-3 py-2 bg-muted/50 border">
                    <p className="text-xs text-muted-foreground mb-1">AI</p>
                    <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Action bar */}
      <div className="flex items-center gap-1 border-t px-3 py-1.5">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" disabled={isStreaming || !hasMessages} aria-label="Clear conversation">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete the entire conversation and all its messages. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClear}>Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button
          variant="ghost"
          size="sm"
          disabled={isStreaming || !hasMessages}
          onClick={handleExport}
          aria-label="Export conversation"
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>

      {/* Input area */}
      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            placeholder="Ask a question..."
            className="min-h-[40px] max-h-[120px] resize-none"
            disabled={!canSend}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <Button size="sm" disabled={!canSubmit} onClick={handleSend} aria-label="Send message">
            {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {!hasRawText ? 'Document has no extracted text.' : 'Press Enter to send, Shift+Enter for new line'}
        </p>
      </div>
    </div>
  )
}
