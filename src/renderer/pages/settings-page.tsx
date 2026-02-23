import { useEffect } from 'react'
import { Settings, Palette, Settings2, Bot, HardDrive } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import { AppearanceSettings } from '@renderer/components/settings/appearance-settings'
import { GeneralSettings } from '@renderer/components/settings/general-settings'
import { OllamaSettings } from '@renderer/components/settings/ollama-settings'
import { StorageSettings } from '@renderer/components/settings/storage-settings'
import { useUIStore } from '@renderer/store/ui-store'
import { useProjectStore } from '@renderer/store'
import { useIpc } from '@renderer/hooks/use-ipc'

export function SettingsPage() {
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)
  const fetchProjects = useProjectStore((s) => s.fetchProjects)

  useEffect(() => {
    setCurrentPageTitle('Settings')
  }, [setCurrentPageTitle])

  // Load projects on mount for the General tab
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Load all settings on mount
  const { data: settings, loading } = useIpc(() => window.electronAPI['settings:get-all'](), [])

  const resolvedSettings = settings ?? {}

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-6 py-4">
        <Settings className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-2xl p-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading settings...</p>
          ) : (
            <Tabs defaultValue="appearance">
              <TabsList className="w-full">
                <TabsTrigger value="appearance">
                  <Palette className="mr-1.5 h-4 w-4" />
                  Appearance
                </TabsTrigger>
                <TabsTrigger value="general">
                  <Settings2 className="mr-1.5 h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger value="ollama">
                  <Bot className="mr-1.5 h-4 w-4" />
                  Ollama
                </TabsTrigger>
                <TabsTrigger value="storage">
                  <HardDrive className="mr-1.5 h-4 w-4" />
                  Storage
                </TabsTrigger>
              </TabsList>

              <div className="mt-6">
                <TabsContent value="appearance">
                  <AppearanceSettings />
                </TabsContent>
                <TabsContent value="general">
                  <GeneralSettings settings={resolvedSettings} />
                </TabsContent>
                <TabsContent value="ollama">
                  <OllamaSettings settings={resolvedSettings} />
                </TabsContent>
                <TabsContent value="storage">
                  <StorageSettings />
                </TabsContent>
              </div>
            </Tabs>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
