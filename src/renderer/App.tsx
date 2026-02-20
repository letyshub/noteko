import { useState, useCallback } from 'react'
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@renderer/components/ui/sidebar'
import { Separator } from '@renderer/components/ui/separator'
import { AppSidebar } from '@renderer/components/layout/app-sidebar'
import { useTheme } from '@renderer/hooks/use-theme'

function readSidebarState(): boolean {
  try {
    const stored = localStorage.getItem('noteko-sidebar-state')
    if (stored === 'false') return false
  } catch {
    // localStorage unavailable
  }
  return true
}

export function App() {
  useTheme()

  const [sidebarOpen, setSidebarOpen] = useState<boolean>(readSidebarState)
  const [pongResult, setPongResult] = useState<string | null>(null)

  const handleSidebarChange = useCallback((isOpen: boolean) => {
    setSidebarOpen(isOpen)
    localStorage.setItem('noteko-sidebar-state', String(isOpen))
  }, [])

  const handlePing = async () => {
    try {
      const response = await window.electronAPI.ping()
      setPongResult(response)
    } catch {
      setPongResult('Error: IPC call failed')
    }
  }

  return (
    <SidebarProvider open={sidebarOpen} onOpenChange={handleSidebarChange}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span>Home</span>
        </header>
        <div className="flex flex-1 items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight">Hello Noteko</h1>
            <p className="mt-2 text-muted-foreground">React 19 + Tailwind CSS v4 + shadcn/ui</p>
            <button
              type="button"
              className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
              onClick={handlePing}
            >
              Ping Main Process
            </button>
            {pongResult !== null && <p className="mt-2 text-sm text-muted-foreground">Response: {pongResult}</p>}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
