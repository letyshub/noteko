import { Check, X, Loader2, FileUp } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { Progress } from '@renderer/components/ui/progress'
import { useUploadStore, type UploadItem } from '@renderer/store/upload-store'

function StatusIcon({ status }: { status: UploadItem['status'] }) {
  switch (status) {
    case 'pending':
      return <FileUp className="h-4 w-4 text-muted-foreground" />
    case 'uploading':
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />
    case 'success':
      return <Check className="h-4 w-4 text-green-600" />
    case 'error':
      return <X className="h-4 w-4 text-destructive" />
  }
}

function StatusBadge({ status }: { status: UploadItem['status'] }) {
  const variantMap: Record<UploadItem['status'], 'secondary' | 'default' | 'destructive' | 'outline'> = {
    pending: 'secondary',
    uploading: 'default',
    success: 'outline',
    error: 'destructive',
  }

  return <Badge variant={variantMap[status]}>{status}</Badge>
}

export function UploadProgress() {
  const items = useUploadStore((s) => s.items)
  const clearCompleted = useUploadStore((s) => s.clearCompleted)

  if (items.length === 0) return null

  const hasCompleted = items.some((item) => item.status === 'success' || item.status === 'error')

  return (
    <div className="border-t bg-muted/30 px-4 py-3" data-testid="upload-progress">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Uploads ({items.length})
        </h3>
        {hasCompleted && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={clearCompleted}
            aria-label="Clear completed"
          >
            Clear completed
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-2 text-sm">
            <StatusIcon status={item.status} />
            <span className="min-w-0 flex-1 truncate">{item.fileName}</span>
            <StatusBadge status={item.status} />
            {item.status === 'uploading' && (
              <div className="w-20">
                <Progress value={item.progress} />
              </div>
            )}
            {item.status === 'error' && item.error && (
              <span className="max-w-[150px] truncate text-xs text-destructive">{item.error}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
