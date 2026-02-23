import { useCallback, useState } from 'react'
import { Routes, Route } from 'react-router'
import { Search } from 'lucide-react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@renderer/components/ui/sidebar'
import { Separator } from '@renderer/components/ui/separator'
import { Button } from '@renderer/components/ui/button'
import { Toaster } from '@renderer/components/ui/sonner'
import { AppSidebar } from '@renderer/components/layout/app-sidebar'
import { ErrorBoundary } from '@renderer/components/layout/error-boundary'
import { SearchDialog } from '@renderer/components/search/search-dialog'
import { useTheme } from '@renderer/hooks/use-theme'
import { useUIStore } from '@renderer/store/ui-store'
import { DashboardPage } from '@renderer/pages/dashboard-page'
import { ProjectPage } from '@renderer/pages/project-page'
import { DocumentPage } from '@renderer/pages/document-page'
import { QuizPage } from '@renderer/pages/quiz-page'
import { QuizTakingPage } from '@renderer/pages/quiz-taking-page'
import { QuizHistoryPage } from '@renderer/pages/quiz-history-page'
import { LogViewerPage } from '@renderer/pages/log-viewer-page'
import { SettingsPage } from '@renderer/pages/settings-page'

export function App() {
  useTheme()

  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const currentPageTitle = useUIStore((s) => s.currentPageTitle)
  const [searchOpen, setSearchOpen] = useState(false)

  const handleSidebarChange = useCallback(
    (isOpen: boolean) => {
      setSidebarOpen(isOpen)
    },
    [setSidebarOpen],
  )

  return (
    <>
      <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-12 items-center gap-2 border-b px-4">
            <SidebarTrigger />
            <Separator orientation="vertical" className="h-4" />
            <span className="font-medium">{currentPageTitle || 'Noteko'}</span>
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-2 text-muted-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="pointer-events-none hidden h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                Ctrl+K
              </kbd>
            </Button>
          </header>
          <main className="flex flex-1 flex-col">
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/projects/:id" element={<ProjectPage />} />
                <Route path="/documents/:id" element={<DocumentPage />} />
                <Route path="/quizzes/:id" element={<QuizPage />} />
                <Route path="/quizzes/:id/take" element={<QuizTakingPage />} />
                <Route path="/quiz-history" element={<QuizHistoryPage />} />
                <Route path="/logs" element={<LogViewerPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </SidebarInset>
      </SidebarProvider>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
    </>
  )
}
