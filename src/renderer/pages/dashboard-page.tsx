import { useEffect } from 'react'
import { House } from 'lucide-react'
import { useUIStore } from '@renderer/store/ui-store'

export function DashboardPage() {
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  useEffect(() => {
    setCurrentPageTitle('Dashboard')
  }, [setCurrentPageTitle])

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <House className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Welcome to Noteko</p>
      <p className="mt-1 text-sm text-muted-foreground">
        Select a project from the sidebar or create a new one to get started.
      </p>
    </div>
  )
}
