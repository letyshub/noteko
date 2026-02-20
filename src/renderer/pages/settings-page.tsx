import { useEffect } from 'react'
import { Settings } from 'lucide-react'
import { useUIStore } from '@renderer/store/ui-store'

export function SettingsPage() {
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  useEffect(() => {
    setCurrentPageTitle('Settings')
  }, [setCurrentPageTitle])

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <Settings className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      <p className="mt-2 text-muted-foreground">Application settings</p>
      <p className="mt-1 text-sm text-muted-foreground">Theme and preference settings will appear here.</p>
    </div>
  )
}
