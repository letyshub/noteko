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
import { useTagStore } from '@renderer/store'
import type { TagDto } from '@shared/types'

interface DeleteTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tag: TagDto | null
  affectedDocumentCount: number
}

export function DeleteTagDialog({ open, onOpenChange, tag, affectedDocumentCount }: DeleteTagDialogProps) {
  const deleteTag = useTagStore((s) => s.deleteTag)

  const handleDelete = async () => {
    if (!tag) return
    await deleteTag(tag.id)
    onOpenChange(false)
  }

  if (!tag) return null

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Tag</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete &quot;{tag.name}&quot;? This tag is used on {affectedDocumentCount}{' '}
            documents. The tag will be removed from all documents. This action cannot be undone.
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
