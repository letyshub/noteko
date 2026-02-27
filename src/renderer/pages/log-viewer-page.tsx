import { useEffect, useState, useCallback } from 'react'
import { Activity, Download, AlertCircle, ScrollText, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useIpc, useIpcMutation } from '@renderer/hooks/use-ipc'
import { useUIStore } from '@renderer/store/ui-store'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { LogStatsCards, LogTrendChart, LogFiltersToolbar, LogList } from '@renderer/components/logs'
import { exportAsJson, toCsvString, exportAsCsv } from '@renderer/lib/export-utils'
import type { LogFilterInput, AppLogDto } from '@shared/types'

// ---------------------------------------------------------------------------
// LogViewerPage
// ---------------------------------------------------------------------------
export function LogViewerPage() {
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  // Page title
  useEffect(() => {
    setCurrentPageTitle('Logs')
  }, [setCurrentPageTitle])

  // Filter state
  const [filters, setFilters] = useState<LogFilterInput>({
    page: 1,
    limit: 100,
    dateRange: 'all',
  })

  // All loaded logs (supports pagination append)
  const [allLogs, setAllLogs] = useState<AppLogDto[]>([])
  const [loadingMore, setLoadingMore] = useState(false)

  // Auto-scroll toggle
  const [autoScroll, setAutoScroll] = useState(true)

  // Clear dialog state
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  // Data fetching
  const {
    data: logResult,
    loading: logsLoading,
    error: logsError,
    refetch: refetchLogs,
  } = useIpc(
    () => window.electronAPI['db:logs:list'](filters),
    [filters.level, filters.category, filters.search, filters.dateRange],
  )

  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useIpc(() => window.electronAPI['db:logs:stats'](), [])

  // Mutation for clearing logs
  const { mutate: clearMutate } = useIpcMutation()

  // Sync fetched logs into allLogs state
  useEffect(() => {
    if (logResult) {
      if (filters.page === 1) {
        setAllLogs(logResult.logs)
      } else {
        setAllLogs((prev) => [...prev, ...logResult.logs])
      }
    }
  }, [logResult, filters.page])

  // Handle filter changes - reset to page 1
  const handleFiltersChange = useCallback((newFilters: LogFilterInput) => {
    setFilters({ ...newFilters, page: 1, limit: 100 })
    setAllLogs([])
  }, [])

  // Load more handler
  const handleLoadMore = useCallback(async () => {
    setLoadingMore(true)
    const nextPage = (filters.page ?? 1) + 1
    try {
      const result = await window.electronAPI['db:logs:list']({ ...filters, page: nextPage })
      if (result.success) {
        setAllLogs((prev) => [...prev, ...result.data.logs])
        setFilters((prev) => ({ ...prev, page: nextPage }))
      }
    } finally {
      setLoadingMore(false)
    }
  }, [filters])

  // Real-time log streaming
  useEffect(() => {
    const listener = window.electronAPI.on('logs:new', (event) => {
      if (autoScroll) {
        setAllLogs((prev) => [event.log, ...prev])
        // Optimistic stats update
        refetchStats()
      }
    })
    return () => {
      window.electronAPI.off('logs:new', listener)
    }
  }, [autoScroll, refetchStats])

  // Export handlers
  const [exporting, setExporting] = useState(false)

  const handleExportJson = async () => {
    setExporting(true)
    try {
      const filePath = await exportAsJson(allLogs, 'app-logs.json')
      if (filePath) {
        toast.success('Export complete', { description: `Saved to ${filePath}` })
      }
    } finally {
      setExporting(false)
    }
  }

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const csvColumns = [
        { key: 'id' as const, header: 'ID' },
        { key: 'level' as const, header: 'Level' },
        { key: 'category' as const, header: 'Category' },
        { key: 'message' as const, header: 'Message' },
        { key: 'created_at' as const, header: 'Created At' },
      ]
      const csvString = toCsvString(allLogs, csvColumns)
      const filePath = await exportAsCsv(csvString, 'app-logs.csv')
      if (filePath) {
        toast.success('Export complete', { description: `Saved to ${filePath}` })
      }
    } finally {
      setExporting(false)
    }
  }

  // Clear handler
  const handleClear = async () => {
    setClearDialogOpen(false)
    const result = await clearMutate(() => window.electronAPI['db:logs:clear']())
    if (result !== null) {
      toast.success('Logs cleared')
      setAllLogs([])
      setFilters((prev) => ({ ...prev, page: 1 }))
      refetchLogs()
      refetchStats()
    }
  }

  // Aggregated states
  const isLoading = logsLoading || statsLoading
  const error = logsError || statsError
  const isEmpty = !isLoading && !error && allLogs.length === 0
  const hasData = !isLoading && !error && allLogs.length > 0

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
          <h2 className="text-lg font-semibold">Error loading logs</h2>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            refetchLogs()
            refetchStats()
          }}
          aria-label="Try Again"
        >
          Try Again
        </Button>
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
              <Activity className="h-6 w-6" aria-hidden="true" />
              <h1 className="text-xl font-semibold">Logs</h1>
            </div>
            <p className="text-sm text-muted-foreground">Monitor application activity</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled aria-label="Export logs">
              <Download className="mr-1.5 h-4 w-4" />
              Export
            </Button>
            <Button variant="destructive" disabled aria-label="Clear logs">
              <Trash2 className="mr-1.5 h-4 w-4" />
              Clear Logs
            </Button>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
          <ScrollText className="h-12 w-12 text-muted-foreground" />
          <div className="text-center">
            <h2 className="text-lg font-semibold">No log entries yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">Log entries will appear here as the application runs.</p>
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
            <Activity className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Logs</h1>
          </div>
          <p className="text-sm text-muted-foreground">Monitor application activity</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={exporting || !hasData} aria-label="Export logs">
                <Download className="mr-1.5 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleExportJson}>Export as JSON</DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCsv}>Export as CSV</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Clear logs button */}
          <Button variant="destructive" onClick={() => setClearDialogOpen(true)} aria-label="Clear logs">
            <Trash2 className="mr-1.5 h-4 w-4" />
            Clear Logs
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {/* Statistics Cards */}
          {stats && <LogStatsCards stats={stats} />}

          {/* Error Rate Trend Chart */}
          {stats && stats.trend.length > 0 && <LogTrendChart trend={stats.trend} />}

          {/* Filters Toolbar */}
          <LogFiltersToolbar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
          />

          {/* Log List */}
          <LogList
            logs={allLogs}
            onLoadMore={handleLoadMore}
            hasMore={logResult?.hasMore ?? false}
            loadingMore={loadingMore}
          />
        </div>
      </ScrollArea>

      {/* Clear Logs Confirmation Dialog */}
      <AlertDialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear All Logs</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all log entries. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClear}>Continue</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
