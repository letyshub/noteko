import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import type { QuizAttemptWithContextDto } from '@shared/types'

interface ScoreTrendChartProps {
  attempts: QuizAttemptWithContextDto[]
}

interface ChartDataPoint {
  date: string
  score: number
  quizTitle: string
  rawDate: string
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Custom tooltip for the score trend line chart. */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{data.quizTitle}</p>
      <p>Score: {data.score}%</p>
      <p className="text-muted-foreground">{new Date(data.rawDate).toLocaleDateString()}</p>
    </div>
  )
}

/** Line chart showing quiz score trends over time. */
export function ScoreTrendChart({ attempts }: ScoreTrendChartProps) {
  const sorted = [...attempts].sort((a, b) => new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime())

  const data: ChartDataPoint[] = sorted.map((a) => ({
    date: formatDate(a.completed_at),
    score: a.score,
    quizTitle: a.quiz_title,
    rawDate: a.completed_at,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Score Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" className="text-muted-foreground text-xs" />
            <YAxis domain={[0, 100]} className="text-muted-foreground text-xs" />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine y={80} stroke="#16a34a" strokeDasharray="4 4" />
            <ReferenceLine y={60} stroke="#ca8a04" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="score"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
