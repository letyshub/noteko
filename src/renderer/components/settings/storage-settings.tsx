import { useState, useCallback } from 'react'
import { FolderOpen, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@renderer/components/ui/button'
import { Label } from '@renderer/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@renderer/components/ui/alert-dialog'
import { useIpc } from '@renderer/hooks/use-ipc'

export function StorageSettings() {
  const { data: storagePath, loading } = useIpc(() => window.electronAPI['app:get-storage-path'](), [])
  const [clearing, setClearing] = useState(false)

  const handleClearCache = useCallback(async () => {
    setClearing(true)
    try {
      const result = await window.electronAPI['app:clear-cache']()
      if (result.success) {
        toast.success(`Cache cleared: ${result.data.deletedCount} items removed`)
      } else {
        toast.error('Failed to clear cache')
      }
    } catch {
      toast.error('Failed to clear cache')
    } finally {
      setClearing(false)
    }
  }, [])

  return (
    <div className="space-y-6">
      {/* Storage Path */}
      <div className="space-y-2">
        <Label>Storage Location</Label>
        <p className="text-sm text-muted-foreground mb-2">Where your documents and data are stored on disk.</p>
        <div className="flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2">
          <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-mono truncate">{loading ? 'Loading...' : (storagePath ?? 'Unknown')}</span>
        </div>
      </div>

      {/* Clear Cache */}
      <div className="space-y-2">
        <Label>Cache Management</Label>
        <p className="text-sm text-muted-foreground mb-2">
          Clear AI-generated content such as summaries, key points, and key terms. Original documents are not affected.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={clearing}>
              {clearing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              Clear Cache
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Clear Cache</AlertDialogTitle>
              <AlertDialogDescription>
                This will delete all AI-generated summaries, key points, and key terms. Original documents will not be
                affected. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleClearCache}>Confirm</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
