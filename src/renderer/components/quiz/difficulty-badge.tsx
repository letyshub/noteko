import { Badge } from '@renderer/components/ui/badge'

/** Renders a difficulty level as a styled Badge. Returns null if no difficulty provided. */
export function DifficultyBadge({ difficulty }: { difficulty?: string }) {
  if (!difficulty) return null
  const label = difficulty.charAt(0).toUpperCase() + difficulty.slice(1)
  return <Badge variant="outline">{label}</Badge>
}
