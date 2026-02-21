import { useEffect } from 'react'
import { Bot, Settings } from 'lucide-react'
import { Separator } from '@renderer/components/ui/separator'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { OllamaSettings } from '@renderer/components/settings/ollama-settings'
import { useUIStore } from '@renderer/store/ui-store'
import { useIpc } from '@renderer/hooks/use-ipc'

export function SettingsPage() {
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  useEffect(() => {
    setCurrentPageTitle('Settings')
  }, [setCurrentPageTitle])

  // Load all settings on mount
  const { data: settings, loading } = useIpc(() => window.electronAPI['settings:get-all'](), [])

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-2xl space-y-8 p-6">
          {/* AI Integration - Ollama Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">AI Integration - Ollama</h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Connect to a local Ollama instance for AI-powered document summarization and key point extraction.
            </p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading settings...</p>
            ) : (
              <OllamaSettings settings={settings ?? {}} />
            )}
          </section>

          <Separator />

          {/* Future sections placeholder */}
          <section>
            <h2 className="text-lg font-semibold mb-2">Appearance</h2>
            <p className="text-sm text-muted-foreground">
              Theme and display preferences will appear here in a future update.
            </p>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
