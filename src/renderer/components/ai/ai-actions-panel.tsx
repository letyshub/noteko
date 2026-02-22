import { Sparkles, List, Tag, Loader2, RotateCcw } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Progress } from '@renderer/components/ui/progress'
import { Separator } from '@renderer/components/ui/separator'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@renderer/components/ui/select'
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
import type { KeyTerm, SummaryStyle } from '@shared/types'

interface AiActionsPanelProps {
  hasRawText: boolean
  aiAvailable: boolean
  summary: string | null
  keyPoints: string[] | null
  keyTerms: KeyTerm[] | null
  summaryStyle: SummaryStyle
  summaryStyleUsed: SummaryStyle | null
  onSummarize: () => void
  onExtractKeyPoints: () => void
  onExtractKeyTerms: () => void
  onSummaryStyleChange: (style: SummaryStyle) => void
  isAiProcessing: boolean
  chunkProgress: { current: number; total: number } | null
  streamingText?: string
  streamingType?: 'summary' | 'key_points' | 'key_terms' | null
}

const STYLE_LABELS: Record<SummaryStyle, string> = {
  brief: 'Brief',
  detailed: 'Detailed',
  academic: 'Academic',
}

export function AiActionsPanel({
  hasRawText,
  aiAvailable,
  summary,
  keyPoints,
  keyTerms,
  summaryStyle,
  summaryStyleUsed,
  onSummarize,
  onExtractKeyPoints,
  onExtractKeyTerms,
  onSummaryStyleChange,
  isAiProcessing,
  chunkProgress,
  streamingText,
  streamingType,
}: AiActionsPanelProps) {
  const canAct = aiAvailable && hasRawText && !isAiProcessing

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">AI Analysis</h3>

      {/* Chunk progress display */}
      {chunkProgress && chunkProgress.total > 1 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground">
            {chunkProgress.current >= chunkProgress.total
              ? 'Combining results...'
              : `Processing chunk ${chunkProgress.current + 1} of ${chunkProgress.total}`}
          </p>
          <Progress
            value={
              chunkProgress.current >= chunkProgress.total
                ? 100
                : ((chunkProgress.current + 1) / chunkProgress.total) * 100
            }
            className="h-1.5"
          />
        </div>
      )}

      {/* ---- Summary subsection ---- */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">Summary</h4>
        <div className="flex items-center gap-2">
          <Select
            value={summaryStyle}
            onValueChange={(value) => onSummaryStyleChange(value as SummaryStyle)}
            disabled={isAiProcessing}
          >
            <SelectTrigger size="sm" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="brief">Brief</SelectItem>
              <SelectItem value="detailed">Detailed</SelectItem>
              <SelectItem value="academic">Academic</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={onSummarize} disabled={!canAct} aria-label="Summarize">
            {isAiProcessing && streamingType === 'summary' ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Summarize
          </Button>
        </div>

        {/* Streaming area for summary */}
        {streamingText && streamingType === 'summary' && (
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Generating summary...</p>
            <p className="whitespace-pre-wrap text-sm">{streamingText}</p>
          </div>
        )}

        {/* Summary display with style badge */}
        {summary && streamingType !== 'summary' && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {summaryStyleUsed && <Badge variant="secondary">{STYLE_LABELS[summaryStyleUsed]}</Badge>}
              <RegenerateButton
                label="Regenerate Summary?"
                description="This will replace the existing summary with a new one. This action cannot be undone."
                onConfirm={onSummarize}
                disabled={!canAct}
              />
            </div>
            <p className="whitespace-pre-wrap text-sm">{summary}</p>
          </div>
        )}
      </div>

      {/* ---- Key Points subsection ---- */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">Key Points</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={onExtractKeyPoints}
          disabled={!canAct}
          aria-label="Extract Key Points"
        >
          {isAiProcessing && streamingType === 'key_points' ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <List className="mr-1 h-4 w-4" />
          )}
          Key Points
        </Button>

        {/* Streaming area for key points */}
        {streamingText && streamingType === 'key_points' && (
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Extracting key points...</p>
            <p className="whitespace-pre-wrap text-sm">{streamingText}</p>
          </div>
        )}

        {/* Key points display */}
        {keyPoints && keyPoints.length > 0 && streamingType !== 'key_points' && (
          <div className="space-y-1">
            <RegenerateButton
              label="Regenerate Key Points?"
              description="This will replace the existing key points with new ones. This action cannot be undone."
              onConfirm={onExtractKeyPoints}
              disabled={!canAct}
            />
            <ul className="list-inside list-disc space-y-1 text-sm">
              {keyPoints.map((point, index) => (
                <li key={index}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ---- Key Terms subsection ---- */}
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">Key Terms</h4>
        <Button
          variant="outline"
          size="sm"
          onClick={onExtractKeyTerms}
          disabled={!canAct}
          aria-label="Extract Key Terms"
        >
          {isAiProcessing && streamingType === 'key_terms' ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <Tag className="mr-1 h-4 w-4" />
          )}
          Key Terms
        </Button>

        {/* Streaming area for key terms */}
        {streamingText && streamingType === 'key_terms' && (
          <div className="rounded-md border bg-muted/50 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">Extracting key terms...</p>
            <p className="whitespace-pre-wrap text-sm">{streamingText}</p>
          </div>
        )}

        {/* Key terms display */}
        {keyTerms && keyTerms.length > 0 && streamingType !== 'key_terms' && (
          <div className="space-y-1">
            <RegenerateButton
              label="Regenerate Key Terms?"
              description="This will replace the existing key terms with new ones. This action cannot be undone."
              onConfirm={onExtractKeyTerms}
              disabled={!canAct}
            />
            <dl className="space-y-2 text-sm">
              {keyTerms.map((kt, index) => (
                <div key={index}>
                  <dt className="font-bold">{kt.term}</dt>
                  <dd className="ml-4 text-muted-foreground">{kt.definition}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>

      {/* Empty state */}
      {!summary && !keyPoints && !keyTerms && !streamingText && (
        <p className="text-xs text-muted-foreground">
          {!hasRawText
            ? 'AI analysis requires extracted text. Parse the document first.'
            : !aiAvailable
              ? 'Ollama is not connected. Configure it in Settings to enable AI features.'
              : 'Use the buttons above to generate a summary, extract key points, or key terms.'}
        </p>
      )}

      <Separator />
    </div>
  )
}

/** Regenerate button with AlertDialog confirmation */
function RegenerateButton({
  label,
  description,
  onConfirm,
  disabled,
}: {
  label: string
  description: string
  onConfirm: () => void
  disabled: boolean
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" disabled={disabled} aria-label={label}>
          <RotateCcw className="mr-1 h-4 w-4" />
          Regenerate
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Regenerate</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
