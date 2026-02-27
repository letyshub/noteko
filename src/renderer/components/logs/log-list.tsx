import { useState } from 'react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { LogLevelBadge } from './log-level-badge'
import type { AppLogDto } from '@shared/types'

interface LogListProps {
  logs: AppLogDto[]
  onLoadMore: () => void
  hasMore: boolean
  loadingMore: boolean
}

/** Renders a list of log entries with expandable context details. */
export function LogList({ logs, onLoadMore, hasMore, loadingMore }: LogListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const handleToggle = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => (
        <button
          key={log.id}
          type="button"
          className="w-full text-left rounded-md border px-4 py-3 hover:bg-accent/50 transition-colors"
          onClick={() => handleToggle(log.id)}
          aria-expanded={expandedId === log.id}
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-xs tabular-nums font-mono shrink-0">
              {new Date(log.created_at).toLocaleString()}
            </span>
            <LogLevelBadge level={log.level} />
            {log.category && <Badge variant="outline">{log.category}</Badge>}
            <span className="truncate flex-1">{log.message}</span>
          </div>
          {expandedId === log.id && log.context && (
            <div className="mt-2">
              <pre className="bg-muted rounded p-3 text-xs overflow-auto">
                <code>{JSON.stringify(log.context, null, 2)}</code>
              </pre>
            </div>
          )}
        </button>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading...' : 'Load More'}
          </Button>
        </div>
      )}
    </div>
  )
}
