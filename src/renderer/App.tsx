import { useCallback } from 'react'
import { Routes, Route } from 'react-router'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@renderer/components/ui/sidebar'
import { Separator } from '@renderer/components/ui/separator'
import { AppSidebar } from '@renderer/components/layout/app-sidebar'
import { ErrorBoundary } from '@renderer/components/layout/error-boundary'
import { useTheme } from '@renderer/hooks/use-theme'
import { useUIStore } from '@renderer/store/ui-store'
import { DashboardPage } from '@renderer/pages/dashboard-page'
import { ProjectPage } from '@renderer/pages/project-page'
import { DocumentPage } from '@renderer/pages/document-page'
import { QuizPage } from '@renderer/pages/quiz-page'
import { SettingsPage } from '@renderer/pages/settings-page'

export function App() {
  useTheme()

  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen)
  const currentPageTitle = useUIStore((s) => s.currentPageTitle)

  const handleSidebarChange = useCallback(
    (isOpen: boolean) => {
      setSidebarOpen(isOpen)
    },
    [setSidebarOpen],
  )

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="font-medium">{currentPageTitle || 'Noteko'}</span>
        </header>
        <main className="flex flex-1 flex-col">
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/projects/:id" element={<ProjectPage />} />
              <Route path="/documents/:id" element={<DocumentPage />} />
              <Route path="/quizzes/:id" element={<QuizPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </ErrorBoundary>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
