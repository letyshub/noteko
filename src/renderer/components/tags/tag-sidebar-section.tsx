import { useState } from 'react'
import { Plus, MoreHorizontal, Pencil, Palette, Trash2 } from 'lucide-react'
import {
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@renderer/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { CreateTagDialog } from '@renderer/components/tags/create-tag-dialog'
import { DeleteTagDialog } from '@renderer/components/tags/delete-tag-dialog'
import type { TagCloudItemDto } from '@shared/types'

interface TagSidebarSectionProps {
  tagCloud: TagCloudItemDto[]
}

export function TagSidebarSection({ tagCloud }: TagSidebarSectionProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editTag, setEditTag] = useState<TagCloudItemDto | null>(null)
  const [deleteTag, setDeleteTag] = useState<TagCloudItemDto | null>(null)

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Tags</SidebarGroupLabel>
      <SidebarGroupAction aria-label="New Tag" onClick={() => setCreateDialogOpen(true)}>
        <Plus />
      </SidebarGroupAction>
      <SidebarMenu>
        {tagCloud.map((tag) => (
          <SidebarMenuItem key={tag.id}>
            <SidebarMenuButton tooltip={tag.name}>
              <span
                className="inline-block h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: tag.color || '#6b7280' }}
              />
              <span>{tag.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{tag.document_count}</span>
            </SidebarMenuButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuAction showOnHover aria-label={`Actions for ${tag.name}`}>
                  <MoreHorizontal />
                </SidebarMenuAction>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start">
                <DropdownMenuItem onClick={() => setEditTag(tag)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setEditTag(tag)}>
                  <Palette className="mr-2 h-4 w-4" />
                  Change Color
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTag(tag)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>

      {/* Dialogs */}
      <CreateTagDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
      {editTag && (
        <CreateTagDialog
          open={!!editTag}
          onOpenChange={(open) => {
            if (!open) setEditTag(null)
          }}
          editingTag={{ id: editTag.id, name: editTag.name, color: editTag.color }}
        />
      )}
      {deleteTag && (
        <DeleteTagDialog
          open={!!deleteTag}
          onOpenChange={(open) => {
            if (!open) setDeleteTag(null)
          }}
          tag={deleteTag ? { id: deleteTag.id, name: deleteTag.name, color: deleteTag.color, created_at: '' } : null}
          affectedDocumentCount={deleteTag?.document_count ?? 0}
        />
      )}
    </SidebarGroup>
  )
}
