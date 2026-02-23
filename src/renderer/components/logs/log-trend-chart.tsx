import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'

interface LogTrendChartProps {
  trend: Array<{ date: string; errorCount: number }>
}

interface TrendDataPoint {
  date: string
  errorCount: number
}

/** Custom tooltip for the error trend line chart. */
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: TrendDataPoint }> }) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{data.date}</p>
      <p>Errors: {data.errorCount}</p>
    </div>
  )
}

/** Line chart showing error rate trends over time. */
export function LogTrendChart({ trend }: LogTrendChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Error Rate Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={trend}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis dataKey="date" className="text-muted-foreground text-xs" />
            <YAxis className="text-muted-foreground text-xs" />
            <Tooltip content={<ChartTooltip />} />
            <Line
              type="monotone"
              dataKey="errorCount"
              stroke="hsl(var(--destructive))"
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
