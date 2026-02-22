import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { useIpc, useIpcMutation } from '@renderer/hooks/use-ipc'
import { useUIStore } from '@renderer/store/ui-store'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { DocumentViewer } from '@renderer/components/documents/document-viewer'
import type { AiStreamEvent, SummaryStyle } from '@shared/types'
import type { WrappedListener } from '@shared/ipc'

export function DocumentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  // Fetch document detail
  const {
    data: document,
    loading,
    error,
    refetch,
  } = useIpc(() => window.electronAPI['db:documents:get'](Number(id)), [id])

  // Mutations for retry and AI actions
  const { mutate } = useIpcMutation()

  // AI availability state
  const [aiAvailable, setAiAvailable] = useState(false)

  // Unified AI processing state (replaces individual isSummarizing/isExtractingKeyPoints)
  const [isAiProcessing, setIsAiProcessing] = useState(false)
  const [streamingText, setStreamingText] = useState('')
  const [streamingType, setStreamingType] = useState<'summary' | 'key_points' | 'key_terms' | null>(null)

  // Summary style selection
  const [summaryStyle, setSummaryStyle] = useState<SummaryStyle>('brief')

  // Chunk progress tracking
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null)

  // Ref for the wrapped listener so we can clean up properly
  const wrappedListenerRef = useRef<WrappedListener | null>(null)

  // Track last chunk index to reset streaming text when chunk changes
  const lastChunkIndexRef = useRef<number>(-1)

  // Set page title to document name
  useEffect(() => {
    if (document) {
      setCurrentPageTitle(document.name)
    } else {
      setCurrentPageTitle('Document')
    }
  }, [document, setCurrentPageTitle])

  // Check AI health on mount
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const result = await window.electronAPI['ai:health-check']()
        if (!cancelled && result.success) {
          setAiAvailable(result.data.connected)
        }
      } catch {
        // Ollama not available -- degrade gracefully
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  // Handle incoming AI stream events
  const handleStreamEvent = useCallback(
    (event: AiStreamEvent) => {
      // Only handle events for this document
      if (event.documentId !== Number(id)) return

      if (event.error) {
        // Error: reset all streaming state
        setIsAiProcessing(false)
        setStreamingText('')
        setStreamingType(null)
        setChunkProgress(null)
        return
      }

      if (event.done) {
        // Done: refetch document to get persisted data, reset streaming state
        setIsAiProcessing(false)
        setStreamingText('')
        setStreamingType(null)
        setChunkProgress(null)
        refetch()
        return
      }

      // Update chunk progress if available
      if (event.totalChunks != null && event.chunkIndex != null) {
        // Reset streaming text when entering a new chunk or the combine phase
        if (event.chunkIndex !== lastChunkIndexRef.current) {
          lastChunkIndexRef.current = event.chunkIndex
          setStreamingText('')
        }
        setChunkProgress({ current: event.chunkIndex, total: event.totalChunks })
      }

      // Accumulate streaming text
      setStreamingText((prev) => prev + event.chunk)
      setStreamingType(event.operationType)
    },
    [id, refetch],
  )

  // Subscribe to ai:stream events
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

  // Retry parsing handler
  const handleRetry = async () => {
    if (!document) return
    await mutate(() => window.electronAPI['doc:parse:retry'](document.id))
    refetch()
  }

  // AI action handlers (guard against concurrent operations)
  const handleSummarize = async () => {
    if (!document || isAiProcessing) return
    setIsAiProcessing(true)
    setStreamingText('')
    setStreamingType('summary')
    setChunkProgress(null)
    lastChunkIndexRef.current = -1
    await mutate(() => window.electronAPI['ai:summarize'](document.id, { style: summaryStyle }))
  }

  const handleExtractKeyPoints = async () => {
    if (!document || isAiProcessing) return
    setIsAiProcessing(true)
    setStreamingText('')
    setStreamingType('key_points')
    setChunkProgress(null)
    lastChunkIndexRef.current = -1
    await mutate(() => window.electronAPI['ai:extract-key-points'](document.id))
  }

  const handleExtractKeyTerms = async () => {
    if (!document || isAiProcessing) return
    setIsAiProcessing(true)
    setStreamingText('')
    setStreamingType('key_terms')
    setChunkProgress(null)
    lastChunkIndexRef.current = -1
    await mutate(() => window.electronAPI['ai:extract-key-terms'](document.id))
  }

  const handleSummaryStyleChange = (style: SummaryStyle) => {
    setSummaryStyle(style)
  }

  // Derived values from document content
  const keyTerms = document?.content?.key_terms ?? null
  const summaryStyleUsed = document?.content?.summary_style ?? null

  // Loading state
  if (loading) {
    return (
      <div className="flex flex-1 flex-col">
        {/* Breadcrumb skeleton */}
        <div className="flex items-center gap-2 border-b px-4 py-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-32" />
        </div>
        {/* Two-column skeleton */}
        <div className="flex flex-1">
          {/* Left panel skeleton (preview area) */}
          <div className="flex flex-1 items-center justify-center border-r p-8">
            <Skeleton className="h-[400px] w-[300px]" />
          </div>
          {/* Right panel skeleton (metadata + text) */}
          <div className="flex w-[45%] flex-col gap-4 p-4">
            {/* Metadata skeleton */}
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-3 w-32" />
              </div>
            </div>
            <Skeleton className="h-px w-full" />
            {/* AI actions skeleton */}
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-8 w-28" />
                <Skeleton className="h-8 w-28" />
              </div>
            </div>
            {/* Text area skeleton */}
            <Skeleton className="h-4 w-32" />
            <Skeleton className="flex-1 min-h-[200px]" />
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error loading document</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => refetch()}>Try Again</Button>
        </div>
      </div>
    )
  }

  // No document found
  if (!document) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Document not found</h2>
          <p className="mt-1 text-sm text-muted-foreground">The document you are looking for does not exist.</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-1 h-4 w-4" />
          Go Back
        </Button>
      </div>
    )
  }

  return (
    <DocumentViewer
      document={document}
      onRetry={handleRetry}
      onSummarize={handleSummarize}
      onExtractKeyPoints={handleExtractKeyPoints}
      onExtractKeyTerms={handleExtractKeyTerms}
      onSummaryStyleChange={handleSummaryStyleChange}
      aiAvailable={aiAvailable}
      isAiProcessing={isAiProcessing}
      keyTerms={keyTerms}
      summaryStyle={summaryStyle}
      summaryStyleUsed={summaryStyleUsed}
      chunkProgress={chunkProgress}
      streamingText={streamingText}
      streamingType={streamingType}
    />
  )
}
