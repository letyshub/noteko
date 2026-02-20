import { useEffect } from 'react'
import { useParams } from 'react-router'
import { FolderOpen } from 'lucide-react'
import { useUIStore } from '@renderer/store/ui-store'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  useEffect(() => {
    setCurrentPageTitle('Project')
  }, [setCurrentPageTitle])

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
      <h1 className="text-3xl font-bold tracking-tight">Project</h1>
      <p className="mt-2 text-sm text-muted-foreground">Project ID: {id}</p>
      <p className="mt-1 text-sm text-muted-foreground">Folders and documents will appear here.</p>
    </div>
  )
}
