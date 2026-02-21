import { Badge } from '@renderer/components/ui/badge'
import type { ProcessingStatus } from '@shared/types'

interface ProcessingStatusBadgeProps {
  status: ProcessingStatus
}

const statusConfig: Record<
  ProcessingStatus,
  { variant: 'default' | 'outline' | 'destructive' | 'secondary'; label: string; className?: string }
> = {
  pending: { variant: 'default', label: 'Pending' },
  processing: { variant: 'outline', label: 'Processing...' },
  completed: { variant: 'default', label: 'Completed', className: 'bg-green-600 text-white hover:bg-green-600/90' },
  failed: { variant: 'destructive', label: 'Failed' },
  unsupported: { variant: 'secondary', label: 'Unsupported' },
}

export function ProcessingStatusBadge({ status }: ProcessingStatusBadgeProps) {
  const config = statusConfig[status] ?? statusConfig.pending
  return (
    <Badge variant={config.variant} className={config.className}>
      {config.label}
    </Badge>
  )
}
