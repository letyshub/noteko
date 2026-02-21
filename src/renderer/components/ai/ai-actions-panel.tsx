import { Sparkles, List, Loader2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'

interface AiActionsPanelProps {
  hasRawText: boolean
  aiAvailable: boolean
  summary: string | null
  keyPoints: string[] | null
  onSummarize: () => void
  onExtractKeyPoints: () => void
  isSummarizing: boolean
  isExtractingKeyPoints: boolean
  streamingText?: string
  streamingType?: 'summary' | 'key_points' | null
}

export function AiActionsPanel({
  hasRawText,
  aiAvailable,
  summary,
  keyPoints,
  onSummarize,
  onExtractKeyPoints,
  isSummarizing,
  isExtractingKeyPoints,
  streamingText,
  streamingType,
}: AiActionsPanelProps) {
  const canSummarize = aiAvailable && hasRawText && !isSummarizing
  const canExtractKeyPoints = aiAvailable && hasRawText && !isExtractingKeyPoints

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">AI Analysis</h3>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSummarize} disabled={!canSummarize} aria-label="Summarize">
            {isSummarizing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
            Summarize
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onExtractKeyPoints}
            disabled={!canExtractKeyPoints}
            aria-label="Extract Key Points"
          >
            {isExtractingKeyPoints ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <List className="mr-1 h-4 w-4" />
            )}
            Key Points
          </Button>
        </div>
      </div>

      {/* Streaming text display area */}
      {streamingText && streamingType && (
        <div className="rounded-md border bg-muted/50 p-3">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            {streamingType === 'summary' ? 'Generating summary...' : 'Extracting key points...'}
          </p>
          <p className="whitespace-pre-wrap text-sm">{streamingText}</p>
        </div>
      )}

      {/* Summary section */}
      {summary && !streamingType && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Summary</h4>
          <p className="whitespace-pre-wrap text-sm">{summary}</p>
        </div>
      )}

      {/* Key points section */}
      {keyPoints && keyPoints.length > 0 && !streamingType && (
        <div className="space-y-1">
          <h4 className="text-xs font-medium text-muted-foreground">Key Points</h4>
          <ul className="list-inside list-disc space-y-1 text-sm">
            {keyPoints.map((point, index) => (
              <li key={index}>{point}</li>
            ))}
          </ul>
        </div>
      )}

      {!summary && !keyPoints && !streamingText && (
        <p className="text-xs text-muted-foreground">
          {!hasRawText
            ? 'AI analysis requires extracted text. Parse the document first.'
            : !aiAvailable
              ? 'Ollama is not connected. Configure it in Settings to enable AI features.'
              : 'Use the buttons above to generate a summary or extract key points.'}
        </p>
      )}

      <Separator />
    </div>
  )
}
