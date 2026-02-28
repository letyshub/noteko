import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RotateCcw, FileWarning, ChevronRight, Sparkles, MessageCircle, ExternalLink } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@renderer/components/ui/resizable'
import { DocumentMetadata } from '@renderer/components/documents/document-metadata'
import { DocumentPreview } from '@renderer/components/documents/document-preview'
import { AiActionsPanel } from '@renderer/components/ai/ai-actions-panel'
import { ChatPanel } from '@renderer/components/ai/chat-panel'
import { TagSelector } from '@renderer/components/tags/tag-selector'
import { isPreviewable, isPdf } from '@renderer/components/documents/document-utils'
import { useTagStore } from '@renderer/store'
import type { DocumentDetailDto, KeyTerm, SummaryStyle, QuizDto, TagDto } from '@shared/types'

interface DocumentViewerProps {
  document: DocumentDetailDto
  onRetry: () => void
  onSummarize: () => void
  onExtractKeyPoints: () => void
  onExtractKeyTerms: () => void
  onSummaryStyleChange: (style: SummaryStyle) => void
  onGenerateQuiz: () => void
  aiAvailable: boolean
  isAiProcessing: boolean
  keyTerms: KeyTerm[] | null
  summaryStyle: SummaryStyle
  summaryStyleUsed: SummaryStyle | null
  chunkProgress: { current: number; total: number } | null
  streamingText?: string
  streamingType?: 'summary' | 'key_points' | 'key_terms' | 'quiz' | null
  // Quiz config props
  quizTypes: string
  quizDifficulty: string
  quizSize: number
  onQuizTypesChange: (value: string) => void
  onQuizDifficultyChange: (value: string) => void
  onQuizSizeChange: (value: string) => void
  quizzes: QuizDto[]
}

export function DocumentViewer({
  document,
  onRetry,
  onSummarize,
  onExtractKeyPoints,
  onExtractKeyTerms,
  onSummaryStyleChange,
  onGenerateQuiz,
  aiAvailable,
  isAiProcessing,
  keyTerms,
  summaryStyle,
  summaryStyleUsed,
  chunkProgress,
  streamingText,
  streamingType,
  quizTypes,
  quizDifficulty,
  quizSize,
  onQuizTypesChange,
  onQuizDifficultyChange,
  onQuizSizeChange,
  quizzes,
}: DocumentViewerProps) {
  const navigate = useNavigate()
  const content = document.content
  const hasRawText = !!content?.raw_text
  const isFailed = document.processing_status === 'failed'
  const isNotProcessed = !content || (!content.raw_text && document.processing_status !== 'completed')
  const canPreview = isPreviewable(document.file_type)

  // Tag state
  const [documentTags, setDocumentTags] = useState<TagDto[]>([])
  const allTags = useTagStore((s) => s.tags)
  const fetchTags = useTagStore((s) => s.fetchTags)
  const getDocumentTags = useTagStore((s) => s.getDocumentTags)
  const setDocumentTagsApi = useTagStore((s) => s.setDocumentTags)

  useEffect(() => {
    fetchTags()
    getDocumentTags(document.id).then(setDocumentTags)
  }, [document.id, fetchTags, getDocumentTags])

  const handleTagsChanged = useCallback(
    async (tagIds: number[]) => {
      await setDocumentTagsApi(document.id, tagIds)
      const updated = await getDocumentTags(document.id)
      setDocumentTags(updated)
    },
    [document.id, setDocumentTagsApi, getDocumentTags],
  )

  const tagsSection = (
    <div>
      <h3 className="text-sm font-semibold mb-2">Tags</h3>
      <TagSelector tags={documentTags} allTags={allTags} onTagsChanged={handleTagsChanged} />
    </div>
  )

  const aiPanel = (
    <AiActionsPanel
      hasRawText={hasRawText}
      aiAvailable={aiAvailable}
      summary={content?.summary ?? null}
      keyPoints={content?.key_points ?? null}
      keyTerms={keyTerms}
      summaryStyle={summaryStyle}
      summaryStyleUsed={summaryStyleUsed}
      onSummarize={onSummarize}
      onExtractKeyPoints={onExtractKeyPoints}
      onExtractKeyTerms={onExtractKeyTerms}
      onSummaryStyleChange={onSummaryStyleChange}
      isAiProcessing={isAiProcessing}
      chunkProgress={chunkProgress}
      streamingText={streamingText}
      streamingType={streamingType}
      onGenerateQuiz={onGenerateQuiz}
      quizTypes={quizTypes}
      quizDifficulty={quizDifficulty}
      quizSize={quizSize}
      onQuizTypesChange={onQuizTypesChange}
      onQuizDifficultyChange={onQuizDifficultyChange}
      onQuizSizeChange={onQuizSizeChange}
      quizzes={quizzes}
    />
  )

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

          {/* Right panel: Metadata, Tags (fixed) + Tabs (flex) */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <div className="flex h-full flex-col">
              {/* Fixed: Metadata + Tags */}
              <div className="flex flex-col gap-4 p-4 pb-2">
                <DocumentMetadata document={document} />
                {tagsSection}

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
              </div>

              {/* Tabs: Analysis + Chat */}
              <Tabs defaultValue="analysis" className="flex flex-1 flex-col px-4 pb-4">
                <TabsList className="w-full">
                  <TabsTrigger value="analysis">
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Analysis
                  </TabsTrigger>
                  <TabsTrigger value="chat">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    Chat
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="analysis" className="flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="flex flex-col gap-4 pt-4">
                      {aiPanel}

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
                </TabsContent>

                <TabsContent value="chat" className="flex-1 overflow-hidden">
                  <ChatPanel documentId={document.id} aiAvailable={aiAvailable} hasRawText={hasRawText} />
                </TabsContent>
              </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        /* Single-column layout for non-previewable files */
        <div className="flex flex-1 flex-col p-6">
          {/* Fixed: Metadata + Tags */}
          <div className="flex flex-col gap-4 pb-4">
            <DocumentMetadata document={document} />
            {tagsSection}

            {/* PDF: open in system app */}
            {isPdf(document.file_type) && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit gap-2"
                onClick={() => window.electronAPI['file:open-in-system-app'](document.file_path)}
              >
                <ExternalLink className="h-4 w-4" />
                Open in system PDF viewer
              </Button>
            )}

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
          </div>

          {/* Tabs: Analysis + Chat */}
          <Tabs defaultValue="analysis" className="flex flex-1 flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="analysis">
                <Sparkles className="mr-1.5 h-4 w-4" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="chat">
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Chat
              </TabsTrigger>
            </TabsList>

            <TabsContent value="analysis" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="flex flex-col gap-4 pt-4">
                  {aiPanel}

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
            </TabsContent>

            <TabsContent value="chat" className="flex-1 overflow-hidden">
              <ChatPanel documentId={document.id} aiAvailable={aiAvailable} hasRawText={hasRawText} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}
