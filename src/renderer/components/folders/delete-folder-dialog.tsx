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

  const handleDelete = async () => {
    await deleteFolder(folder.id)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Folder</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{folder.name}&quot;? All documents and subfolders inside this folder
            will also be deleted. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
