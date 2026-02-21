import { ArrowLeft, RotateCcw, FileWarning, ChevronRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@renderer/components/ui/resizable'
import { DocumentMetadata } from '@renderer/components/documents/document-metadata'
import { DocumentPreview } from '@renderer/components/documents/document-preview'
import { AiActionsPanel } from '@renderer/components/ai/ai-actions-panel'
import { isPreviewable } from '@renderer/components/documents/document-utils'
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
  const navigate = useNavigate()
  const content = document.content
  const hasRawText = !!content?.raw_text
  const isFailed = document.processing_status === 'failed'
  const isNotProcessed = !content || (!content.raw_text && document.processing_status !== 'completed')
  const canPreview = isPreviewable(document.file_type)

  return (
    <div className="flex flex-1 flex-col">
      {/* Breadcrumb navigation */}
      <div className="flex items-center gap-1 border-b px-4 py-2">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} aria-label="Go back">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link
          to={`/projects/${document.project_id}`}
          className="text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          {document.project_name}
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{document.folder_name}</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{document.name}</span>
      </div>

      {/* Content area */}
      {canPreview ? (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          {/* Left panel: Document preview */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <div className="flex h-full flex-col">
              <DocumentPreview document={document} />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: Metadata, AI actions, extracted text */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <ScrollArea className="h-full">
              <div className="flex flex-col gap-4 p-4">
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
                    <div className="flex flex-col items-center justify-center rounded-md border bg-muted/30 p-8 text-center">
                      <p className="text-sm text-muted-foreground">Document not yet processed</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        The document text will appear here once parsing is complete.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border">
                      <div className="p-4">
                        <pre className="whitespace-pre-wrap text-sm leading-relaxed">
                          {content?.raw_text ?? 'No text content available.'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        /* Single-column layout for non-previewable files */
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
      )}
    </div>
  )
}
