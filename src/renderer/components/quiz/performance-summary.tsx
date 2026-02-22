import { Card, CardContent } from '@renderer/components/ui/card'
import { ClipboardList, Target, Trophy, GraduationCap } from 'lucide-react'
import { getScoreColor } from '@renderer/lib/score-utils'
import type { QuizOverviewStatsDto } from '@shared/types'

interface PerformanceSummaryProps {
  stats: QuizOverviewStatsDto
}

/** Renders four summary stat cards for the quiz history overview. */
export function PerformanceSummary({ stats }: PerformanceSummaryProps) {
  const cards = [
    {
      label: 'Total Attempts',
      value: String(stats.total_attempts),
      icon: ClipboardList,
      colorClass: 'text-foreground',
    },
    {
      label: 'Average Score',
      value: `${Math.round(stats.average_score)}%`,
      icon: Target,
      colorClass: getScoreColor(stats.average_score),
    },
    {
      label: 'Best Score',
      value: `${Math.round(stats.best_score)}%`,
      icon: Trophy,
      colorClass: getScoreColor(stats.best_score),
    },
    {
      label: 'Quizzes Taken',
      value: String(stats.quizzes_taken),
      icon: GraduationCap,
      colorClass: 'text-foreground',
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
