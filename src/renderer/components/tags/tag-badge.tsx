import { X } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import type { TagDto } from '@shared/types'

interface TagBadgeProps {
  tag: TagDto
  onRemove?: () => void
  className?: string
}

export function TagBadge({ tag, onRemove, className }: TagBadgeProps) {
  return (
    <Badge variant="secondary" className={cn('gap-1', className)}>
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: tag.color || '#6b7280' }}
      />
      <span className="text-xs">{tag.name}</span>
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-xs"
          className="ml-1 size-4 rounded-full"
          onClick={onRemove}
          aria-label={`Remove ${tag.name}`}
        >
          <X className="size-3" />
        </Button>
      )}
    </Badge>
  )
}
