import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { BarChart3, Download, AlertCircle, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useUIStore } from '@renderer/store/ui-store'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { PerformanceSummary } from '@renderer/components/quiz/performance-summary'
import { ScoreTrendChart } from '@renderer/components/quiz/score-trend-chart'
import { QuizHistoryToolbar } from '@renderer/components/quiz/quiz-history-toolbar'
import { WeakAreasCard } from '@renderer/components/quiz/weak-areas-card'
import { ScoreBadge } from '@renderer/components/quiz/score-badge'
import { exportAsJson } from '@renderer/lib/export-utils'
import type { QuizHistorySortField } from '@renderer/lib/score-utils'
import type { QuizAttemptWithContextDto } from '@shared/types'

// ---------------------------------------------------------------------------
// QuizHistoryPage
// ---------------------------------------------------------------------------
export function QuizHistoryPage() {
  const navigate = useNavigate()
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  // Page title
  useEffect(() => {
    setCurrentPageTitle('Quiz History')
  }, [setCurrentPageTitle])

  // Data fetching (4 parallel IPC hooks)
  const {
    data: attempts,
    loading: attemptsLoading,
    error: attemptsError,
  } = useIpc(() => window.electronAPI['db:quiz-history:list-all'](), [])

  const {
    data: overviewStats,
    loading: statsLoading,
    error: statsError,
  } = useIpc(() => window.electronAPI['db:quiz-history:overview-stats'](), [])

  const {
    data: weakAreas,
    loading: weakAreasLoading,
    error: weakAreasError,
  } = useIpc(() => window.electronAPI['db:quiz-history:weak-areas'](), [])

  // Sort state
  const [sortField, setSortField] = useState<QuizHistorySortField>('date')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Sorted attempts list (client-side sorting via useMemo)
  const sortedAttempts = useMemo(() => {
    if (!attempts) return []
    const sorted = [...attempts].sort((a, b) => {
      let cmp = 0
      switch (sortField) {
        case 'date':
          cmp = new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
          break
        case 'score':
          cmp = a.score - b.score
          break
        case 'quizName':
          cmp = a.quiz_title.localeCompare(b.quiz_title)
          break
        case 'documentName':
          cmp = a.document_name.localeCompare(b.document_name)
          break
      }
      return sortDirection === 'asc' ? cmp : -cmp
    })
    return sorted
  }, [attempts, sortField, sortDirection])

  // Export handler
  const [exporting, setExporting] = useState(false)
  const handleExport = async () => {
    setExporting(true)
    try {
      const filePath = await exportAsJson(attempts, 'quiz-history.json')
      if (filePath) {
        toast.success('Export complete', { description: `Saved to ${filePath}` })
      }
    } finally {
      setExporting(false)
    }
  }

  // Aggregated loading state
  const isLoading = attemptsLoading || statsLoading || weakAreasLoading

  // Aggregated error state
  const error = attemptsError || statsError || weakAreasError

  // Determine if data is empty
  const isEmpty = !isLoading && !error && (!attempts || attempts.length === 0)
  const hasData = !isLoading && !error && attempts && attempts.length > 0

  // Guard: Loading
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div className="space-y-1">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          {/* Chart skeleton */}
          <Skeleton className="h-80 rounded-lg" />
          {/* List skeleton */}
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Guard: Error
  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error loading quiz history</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
      </div>
    )
  }

  // Guard: Empty
  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-start justify-between border-b px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-6 w-6" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Quiz History</h1>
            </div>
            <p className="text-sm text-muted-foreground">Track your learning progress</p>
          </div>
          <Button variant="outline" disabled aria-label="Export quiz history">
            <Download className="mr-1.5 h-4 w-4" />
            Export
          </Button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <ClipboardList className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-lg font-semibold">No quiz attempts yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Complete a quiz to start tracking your performance.</p>
          </div>
        </div>
      </div>
    )
  }

  // Content
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b px-6 py-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Quiz History</h1>
          </div>
          <p className="text-sm text-muted-foreground">Track your learning progress</p>
        </div>
        <Button
          variant="outline"
          disabled={exporting || !hasData}
          onClick={handleExport}
          aria-label="Export quiz history"
        >
          <Download className="mr-1.5 h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {/* Performance Summary */}
          {overviewStats && <PerformanceSummary stats={overviewStats} />}

          {/* Score Trend Chart */}
          {attempts && attempts.length > 0 && <ScoreTrendChart attempts={attempts} />}

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Left: Attempt List */}
            <div className="space-y-4 lg:col-span-2">
              <QuizHistoryToolbar
                sortField={sortField}
                sortDirection={sortDirection}
                onSortFieldChange={setSortField}
                onSortDirectionChange={setSortDirection}
              />
              <div className="space-y-2">
                {sortedAttempts.map((attempt) => (
                  <AttemptRow
                    key={attempt.id}
                    attempt={attempt}
                    onClick={() => navigate(`/quizzes/${attempt.quiz_id}`)}
                  />
                ))}
              </div>
            </div>

            {/* Right: Weak Areas */}
            <div className="lg:col-span-1">{weakAreas && <WeakAreasCard weakAreas={weakAreas} />}</div>
          </div>
        </div>
      </ScrollArea>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AttemptRow
// ---------------------------------------------------------------------------
function AttemptRow({ attempt, onClick }: { attempt: QuizAttemptWithContextDto; onClick: () => void }) {
  const percentage = attempt.score

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors hover:bg-muted/50"
      aria-label={`View quiz: ${attempt.quiz_title}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{attempt.quiz_title}</p>
        <p className="truncate text-sm text-muted-foreground">{attempt.document_name}</p>
      </div>
      <div className="flex items-center gap-3">
        <ScoreBadge percentage={percentage} />
        <span className="text-sm text-muted-foreground">{new Date(attempt.completed_at).toLocaleDateString()}</span>
      </div>
    </button>
  )
}
