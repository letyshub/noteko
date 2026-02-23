import { Card, CardContent } from '@renderer/components/ui/card'
import { FileText, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import type { LogStatisticsDto } from '@shared/types'

interface LogStatsCardsProps {
  stats: LogStatisticsDto
}

/** Renders four summary stat cards for the log viewer overview. */
export function LogStatsCards({ stats }: LogStatsCardsProps) {
  const cards = [
    {
      label: 'Total Logs',
      value: String(stats.total),
      icon: FileText,
      colorClass: 'text-foreground',
    },
    {
      label: 'Errors',
      value: String(stats.errors),
      icon: AlertCircle,
      colorClass: 'text-red-500',
    },
    {
      label: 'Warnings',
      value: String(stats.warnings),
      icon: AlertTriangle,
      colorClass: 'text-yellow-500',
    },
    {
      label: 'Info',
      value: String(stats.infos),
      icon: Info,
      colorClass: 'text-blue-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <Card key={card.label}>
            <CardContent className="flex items-center gap-3 pt-6">
              <Icon className={`h-8 w-8 shrink-0 ${card.colorClass}`} aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-muted-foreground text-sm">{card.label}</p>
                <p className={`text-2xl font-bold ${card.colorClass}`}>{card.value}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
