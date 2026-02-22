import { Badge } from '@renderer/components/ui/badge'
import { getScoreColor } from '@renderer/lib/score-utils'
import { cn } from '@renderer/lib/utils'

interface ScoreBadgeProps {
  percentage: number
  className?: string
}

/** Renders a quiz score as a colour-coded Badge. */
export function ScoreBadge({ percentage, className }: ScoreBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(getScoreColor(percentage), className)}
      aria-label={`Score: ${Math.round(percentage)}%`}
    >
      {Math.round(percentage)}%
    </Badge>
  )
}
