import { Badge } from '@renderer/components/ui/badge'
import { cn } from '@renderer/lib/utils'

interface LogLevelBadgeProps {
  level: string
  className?: string
}

const levelConfig: Record<string, { variant: 'destructive' | 'outline' | 'secondary'; className?: string }> = {
  error: { variant: 'destructive' },
  warn: { variant: 'outline', className: 'text-yellow-600 dark:text-yellow-400' },
  info: { variant: 'outline', className: 'text-blue-600 dark:text-blue-400' },
  debug: { variant: 'secondary' },
}

/** Renders a log level as a colour-coded Badge. */
export function LogLevelBadge({ level, className }: LogLevelBadgeProps) {
  const config = levelConfig[level] ?? { variant: 'outline' as const }
  return (
    <Badge variant={config.variant} className={cn(config.className, className)}>
      {level.toUpperCase()}
    </Badge>
  )
}
