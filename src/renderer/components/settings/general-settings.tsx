import { useState, useCallback } from 'react'
import { Wand2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { useProjectStore, useSettingsStore } from '@renderer/store'

interface GeneralSettingsProps {
  settings: Record<string, string>
}

export function GeneralSettings({ settings }: GeneralSettingsProps) {
  const projects = useProjectStore((s) => s.projects)
  const [defaultProject, setDefaultProject] = useState(settings['general.defaultProject'] || '')

  const handleDefaultProjectChange = useCallback(async (value: string) => {
    setDefaultProject(value)
    try {
      await window.electronAPI['settings:set']('general.defaultProject', value)
      toast.success('Default project updated')
    } catch {
      toast.error('Failed to save default project')
    }
  }, [])

  const handleOpenWizard = useCallback(() => {
    useSettingsStore.getState().setShowWizard(true)
  }, [])

  return (
    <div className="space-y-6">
      {/* Default Project */}
      <div className="space-y-2">
        <Label htmlFor="default-project">Default Project</Label>
        <p className="text-sm text-muted-foreground mb-2">Choose a project to open by default when the app starts.</p>
        <Select value={defaultProject} onValueChange={handleDefaultProjectChange}>
          <SelectTrigger id="default-project" className="w-full">
            <SelectValue placeholder="None" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Setup Wizard */}
      <div className="space-y-2">
        <Label>Setup Wizard</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Re-run the initial setup wizard to reconfigure your preferences.
        </p>
        <Button variant="outline" onClick={handleOpenWizard}>
          <Wand2 className="mr-2 h-4 w-4" />
          Open Setup Wizard
        </Button>
      </div>
    </div>
  )
}
