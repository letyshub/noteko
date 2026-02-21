import { RotateCcw, FileWarning } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { DocumentMetadata } from '@renderer/components/documents/document-metadata'
import { AiActionsPanel } from '@renderer/components/ai/ai-actions-panel'
import type { DocumentDetailDto } from '@shared/types'

interface DocumentViewerProps {
  document: DocumentDetailDto
  onRetry: () => void
  onSummarize: () => void
  onExtractKeyPoints: () => void
  aiAvailable: boolean
  isSummarizing?: boolean
  isExtractingKeyPoints?: boolean
  streamingText?: string
  streamingType?: 'summary' | 'key_points' | null
}

export function DocumentViewer({
  document,
  onRetry,
  onSummarize,
  onExtractKeyPoints,
  aiAvailable,
  isSummarizing = false,
  isExtractingKeyPoints = false,
  streamingText,
  streamingType,
}: DocumentViewerProps) {
  const content = document.content
  const hasRawText = !!content?.raw_text
  const isFailed = document.processing_status === 'failed'
  const isNotProcessed = !content || (!content.raw_text && document.processing_status !== 'completed')

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Metadata header */}
      <DocumentMetadata document={document} />

      {/* Failed status: retry button */}
      {isFailed && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 p-3">
          <FileWarning className="h-5 w-5 text-destructive" />
          <div className="flex-1">
            <p className="text-sm font-medium">Processing failed</p>
            <p className="text-xs text-muted-foreground">An error occurred while parsing this document.</p>
          </div>
          <Button variant="outline" size="sm" onClick={onRetry} aria-label="Retry parsing">
            <RotateCcw className="mr-1 h-4 w-4" />
            Retry
          </Button>
        </div>
      )}

      {/* AI Actions Panel */}
      <AiActionsPanel
        hasRawText={hasRawText}
        aiAvailable={aiAvailable}
        summary={content?.summary ?? null}
        keyPoints={content?.key_points ?? null}
        onSummarize={onSummarize}
        onExtractKeyPoints={onExtractKeyPoints}
        isSummarizing={isSummarizing}
        isExtractingKeyPoints={isExtractingKeyPoints}
        streamingText={streamingText}
        streamingType={streamingType}
      />

      {/* Extracted text panel */}
      <div className="flex flex-1 flex-col">
        <h3 className="mb-2 text-sm font-semibold">Extracted Text</h3>
        {isNotProcessed ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-md border bg-muted/30 p-8 text-center">
            <p className="text-sm text-muted-foreground">Document not yet processed</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The document text will appear here once parsing is complete.
            </p>
          </div>
        ) : (
          <ScrollArea className="flex-1 rounded-md border">
            <div className="p-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                {content?.raw_text ?? 'No text content available.'}
              </pre>
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  )
}
