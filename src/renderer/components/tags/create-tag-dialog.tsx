import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@renderer/components/ui/dialog'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import { useTagStore } from '@renderer/store'
import type { TagDto } from '@shared/types'

const COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#3b82f6', // Blue (default)
  '#8b5cf6', // Purple
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#6b7280', // Gray
  '#14b8a6', // Teal
]

interface CreateTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated?: (tag: TagDto) => void
  initialName?: string
  editingTag?: { id: number; name: string; color: string | null } | null
}

export function CreateTagDialog({ open, onOpenChange, onCreated, initialName, editingTag }: CreateTagDialogProps) {
  const [name, setName] = useState(editingTag?.name ?? initialName ?? '')
  const [color, setColor] = useState(editingTag?.color ?? COLORS[4]) // default blue
  const createTag = useTagStore((s) => s.createTag)
  const updateTag = useTagStore((s) => s.updateTag)

  const isEditing = !!editingTag

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    if (isEditing) {
      await updateTag(editingTag.id, { name: name.trim(), color })
    } else {
      const tag = await createTag({ name: name.trim(), color })
      if (tag) {
        onCreated?.(tag)
      }
    }
    setName('')
    setColor(COLORS[4])
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Tag' : 'New Tag'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tag name"
              autoFocus
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-6 w-6 rounded-full border-2 ${
                    color === c ? 'border-foreground' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {isEditing ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
