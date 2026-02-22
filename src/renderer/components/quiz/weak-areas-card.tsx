import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Progress } from '@renderer/components/ui/progress'
import type { WeakAreaDto } from '@shared/types'

interface WeakAreasCardProps {
  weakAreas: WeakAreaDto[]
}

/** Card displaying question types/difficulties with the highest error rates. */
export function WeakAreasCard({ weakAreas }: WeakAreasCardProps) {
  const sorted = [...weakAreas].sort((a, b) => b.error_rate - a.error_rate)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weak Areas</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">No weak areas identified</p>
        ) : (
          <div className="space-y-4">
            {sorted.map((area) => {
              const pct = Math.round(area.error_rate * 100)
              return (
                <div key={`${area.category}-${area.label}`} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{area.label}</span>
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-semibold">{pct}%</span> ({area.error_count}/
                      {area.total_count})
                    </span>
                  </div>
                  <Progress value={pct} aria-label={`${area.label} error rate: ${pct}%`} />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
