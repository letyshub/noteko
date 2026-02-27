import { FileText, AlertCircle } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import type { SearchResultDto } from '@shared/types'

interface SearchResultItemProps {
  result: SearchResultDto
  isSelected: boolean
}

/**
 * Format a relative date string from an ISO timestamp.
 * Returns human-readable strings like "2h ago", "3d ago", "1w ago".
 */
function formatRelativeDate(isoDate: string): string {
  const now = Date.now()
  const date = new Date(isoDate).getTime()
  const diffMs = now - date

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (weeks > 0) return `${weeks}w ago`
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

/**
 * Parse a snippet string containing `<mark>` tags into React elements.
 * Avoids dangerouslySetInnerHTML by splitting on mark boundaries.
 */
function parseSnippet(snippet: string): React.ReactNode[] {
  const parts: React.ReactNode[] = []
  const regex = /<mark>(.*?)<\/mark>/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(snippet)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push(snippet.slice(lastIndex, match.index))
    }
    // Add highlighted text
    parts.push(
      <mark key={`mark-${match.index}`} className="bg-yellow-200/50 dark:bg-yellow-500/30 rounded-sm px-0.5">
        {match[1]}
      </mark>,
    )
    lastIndex = regex.lastIndex
  }

  // Add remaining text after last match
  if (lastIndex < snippet.length) {
    parts.push(snippet.slice(lastIndex))
  }

  return parts
}

export function SearchResultItem({ result, isSelected }: SearchResultItemProps) {
  const isUnparsed = result.matchType === 'name' && result.processingStatus !== 'completed'

  return (
    <div className={`flex items-start gap-3 px-2 py-1.5 ${isSelected ? 'bg-accent' : ''}`}>
      <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        {/* Document name */}
        <div className="truncate font-medium text-sm">{result.documentName}</div>

        {/* Metadata line: project name, file type badge, relative date */}
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="truncate">{result.projectName}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {result.fileType.toUpperCase()}
          </Badge>
          <span className="shrink-0">{formatRelativeDate(result.createdAt)}</span>
        </div>

        {/* Snippet or unparsed indicator */}
        {isUnparsed ? (
          <div className="mt-1 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <AlertCircle className="size-3 shrink-0" />
            <span>Not yet parsed -- name match only</span>
          </div>
        ) : result.snippet ? (
          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{parseSnippet(result.snippet)}</div>
        ) : null}
      </div>
    </div>
  )
}
