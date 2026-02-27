import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  House,
  FolderOpen,
  FileText,
  GraduationCap,
  Target,
  Plus,
  BarChart3,
  AlertCircle,
  Rocket,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react'
import { useIpc } from '@renderer/hooks/use-ipc'
import { useUIStore } from '@renderer/store/ui-store'
import { Button } from '@renderer/components/ui/button'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { ScoreBadge } from '@renderer/components/quiz/score-badge'
import { getScoreColor } from '@renderer/lib/score-utils'
import type { DashboardStatsDto, RecentDocumentDto, RecentQuizAttemptDto, ProjectWithCountDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function fileTypeLabel(fileType: string): string {
  return fileType.toUpperCase()
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatsCards({ stats }: { stats: DashboardStatsDto }) {
  const cards = [
    { label: 'Projects', value: String(stats.total_projects), icon: FolderOpen, colorClass: 'text-foreground' },
    { label: 'Documents', value: String(stats.total_documents), icon: FileText, colorClass: 'text-foreground' },
    {
      label: 'Quizzes Taken',
      value: String(stats.total_quizzes_taken),
      icon: GraduationCap,
      colorClass: 'text-foreground',
    },
    {
      label: 'Avg Score',
      value: stats.total_quizzes_taken > 0 ? `${stats.average_score}%` : 'N/A',
      icon: Target,
      colorClass: stats.total_quizzes_taken > 0 ? getScoreColor(stats.average_score) : 'text-muted-foreground',
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
                <p className="text-sm text-muted-foreground">{card.label}</p>
                <p className={`text-2xl font-bold ${card.colorClass}`}>{card.value}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function OllamaStatus({ connected }: { connected: boolean | null }) {
  if (connected === null) return null
  return (
    <div className="flex items-center gap-2 text-sm">
      {connected ? (
        <>
          <Wifi className="h-4 w-4 text-green-500" aria-hidden="true" />
          <span className="text-green-600 dark:text-green-400">AI Connected</span>
        </>
      ) : (
        <>
          <WifiOff className="h-4 w-4 text-red-500" aria-hidden="true" />
          <span className="text-red-600 dark:text-red-400">AI Disconnected</span>
        </>
      )}
    </div>
  )
}

function RecentDocumentsList({ docs, onNavigate }: { docs: RecentDocumentDto[]; onNavigate: (id: number) => void }) {
  if (docs.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No documents yet</p>
  }

  return (
    <div className="space-y-2">
      {docs.map((doc) => (
        <button
          key={doc.id}
          type="button"
          onClick={() => onNavigate(doc.id)}
          className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors hover:bg-muted/50"
          aria-label={`View document: ${doc.name}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{doc.name}</p>
            <p className="truncate text-xs text-muted-foreground">{doc.project_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">{fileTypeLabel(doc.file_type)}</span>
            <span className="text-xs text-muted-foreground">{formatRelativeDate(doc.created_at)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function RecentAttemptsList({
  attempts,
  onNavigate,
}: {
  attempts: RecentQuizAttemptDto[]
  onNavigate: (quizId: number) => void
}) {
  if (attempts.length === 0) {
    return <p className="py-4 text-center text-sm text-muted-foreground">No quiz attempts yet</p>
  }

  return (
    <div className="space-y-2">
      {attempts.map((attempt) => (
        <button
          key={attempt.id}
          type="button"
          onClick={() => onNavigate(attempt.quiz_id)}
          className="flex w-full items-center justify-between rounded-md border px-4 py-3 text-left transition-colors hover:bg-muted/50"
          aria-label={`View quiz: ${attempt.quiz_title}`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{attempt.quiz_title}</p>
            <p className="truncate text-xs text-muted-foreground">{attempt.document_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <ScoreBadge percentage={attempt.score} />
            <span className="text-xs text-muted-foreground">{formatRelativeDate(attempt.completed_at)}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function ProjectGrid({ projects, onNavigate }: { projects: ProjectWithCountDto[]; onNavigate: (id: number) => void }) {
  if (projects.length === 0) return null

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {projects.map((project) => (
        <button
          key={project.id}
          type="button"
          onClick={() => onNavigate(project.id)}
          className="rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
          aria-label={`Open project: ${project.name}`}
        >
          <div className="mb-2 flex items-center gap-2">
            <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color ?? '#6b7280' }} />
            <p className="truncate text-sm font-medium">{project.name}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            {project.document_count} {project.document_count === 1 ? 'document' : 'documents'}
          </p>
        </button>
      ))}
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
      <Rocket className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <div className="text-center">
        <h2 className="text-lg font-semibold">Welcome to Noteko!</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Get started by creating a project, uploading documents, and generating quizzes to test your knowledge.
        </p>
      </div>
      <Button onClick={() => {}}>
        <Plus className="mr-1.5 h-4 w-4" />
        Create Your First Project
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export function DashboardPage() {
  const navigate = useNavigate()
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  useEffect(() => {
    setCurrentPageTitle('Dashboard')
  }, [setCurrentPageTitle])

  // Data fetches
  const {
    data: stats,
    loading: statsLoading,
    error: statsError,
  } = useIpc(() => window.electronAPI['db:dashboard:stats'](), [])
  const { data: recentDocs, loading: docsLoading } = useIpc(() => window.electronAPI['db:dashboard:recent-docs'](), [])
  const { data: recentAttempts, loading: attemptsLoading } = useIpc(
    () => window.electronAPI['db:dashboard:recent-attempts'](),
    [],
  )
  const { data: projects, loading: projectsLoading } = useIpc(
    () => window.electronAPI['db:dashboard:projects-with-counts'](),
    [],
  )

  // Ollama health check (non-blocking)
  const [ollamaConnected, setOllamaConnected] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const result = await window.electronAPI['ai:health-check']()
        if (!cancelled && result.success) {
          setOllamaConnected(result.data.connected)
        }
      } catch {
        if (!cancelled) setOllamaConnected(false)
      }
    }
    check()
    return () => {
      cancelled = true
    }
  }, [])

  const isLoading = statsLoading || docsLoading || attemptsLoading || projectsLoading
  const isEmpty = !isLoading && !statsError && stats && stats.total_projects === 0

  // --- Loading ---
  if (isLoading) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-28" />
        </div>
        <div className="mx-auto w-full max-w-6xl space-y-6 p-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-lg" />
            ))}
          </div>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
          <Skeleton className="h-32 rounded-lg" />
        </div>
      </div>
    )
  }

  // --- Error ---
  if (statsError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <div className="text-center">
          <h2 className="text-lg font-semibold">Error loading dashboard</h2>
          <p className="mt-1 text-sm text-muted-foreground">{statsError.message}</p>
        </div>
      </div>
    )
  }

  // --- Empty (new user) ---
  if (isEmpty) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div className="flex items-center gap-2">
            <House className="h-6 w-6" aria-hidden="true" />
            <h1 className="text-xl font-semibold">Dashboard</h1>
          </div>
          <OllamaStatus connected={ollamaConnected} />
        </div>
        <EmptyState />
      </div>
    )
  }

  // --- Content ---
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <House className="h-6 w-6" aria-hidden="true" />
          <h1 className="text-xl font-semibold">Dashboard</h1>
        </div>
        <OllamaStatus connected={ollamaConnected} />
      </div>

      {/* Scrollable content */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-6xl space-y-6 p-6">
          {/* Stats Cards */}
          {stats && <StatsCards stats={stats} />}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => navigate('/quiz-history')}>
              <BarChart3 className="mr-1.5 h-4 w-4" />
              Quiz History
            </Button>
          </div>

          {/* Two-column: Recent Docs + Recent Attempts */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold">Recent Documents</h2>
              </div>
              <RecentDocumentsList docs={recentDocs ?? []} onNavigate={(id) => navigate(`/documents/${id}`)} />
            </div>
            <div>
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold">Recent Quiz Attempts</h2>
              </div>
              <RecentAttemptsList
                attempts={recentAttempts ?? []}
                onNavigate={(quizId) => navigate(`/quizzes/${quizId}`)}
              />
            </div>
          </div>

          {/* Project Grid */}
          {projects && projects.length > 0 && (
            <div>
              <div className="mb-3 flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                <h2 className="text-sm font-semibold">Projects</h2>
              </div>
              <ProjectGrid projects={projects} onNavigate={(id) => navigate(`/projects/${id}`)} />
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
