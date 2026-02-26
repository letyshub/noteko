import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@renderer/components/ui/alert-dialog'
import { useFolderStore } from '@renderer/store'
import type { FolderDto } from '@shared/types'

interface DeleteFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folder: FolderDto
}

export function DeleteFolderDialog({ open, onOpenChange, folder }: DeleteFolderDialogProps) {
  const deleteFolder = useFolderStore((s) => s.deleteFolder)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    setError(null)
    const success = await deleteFolder(folder.id)
    if (success) {
      onOpenChange(false)
    } else {
      setError(useFolderStore.getState().error ?? 'Failed to delete folder')
    }
  }

  const handleOpenChange = (open: boolean) => {
    if (!open) setError(null)
    onOpenChange(open)
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Folder</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{folder.name}&quot;? All documents and subfolders inside this folder
            will also be deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="px-1 text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={handleDelete}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
