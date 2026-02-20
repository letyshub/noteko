import { useState } from 'react'
import { ChevronRight, FolderOpen, FolderClosed, MoreHorizontal, Pencil, FolderPlus, Trash2 } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@renderer/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { EditFolderDialog } from '@renderer/components/folders/edit-folder-dialog'
import { DeleteFolderDialog } from '@renderer/components/folders/delete-folder-dialog'
import { CreateFolderDialog } from '@renderer/components/folders/create-folder-dialog'
import type { FolderDto } from '@shared/types'

export interface FolderNode {
  folder: FolderDto
  children: FolderNode[]
}

interface FolderTreeItemProps {
  node: FolderNode
  projectId: number
  selectedFolderId: number | null
  onSelectFolder: (folderId: number) => void
  depth?: number
}

export function FolderTreeItem({ node, projectId, selectedFolderId, onSelectFolder, depth = 0 }: FolderTreeItemProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [createSubfolderOpen, setCreateSubfolderOpen] = useState(false)

  const hasChildren = node.children.length > 0
  const isSelected = selectedFolderId === node.folder.id
  const FolderIcon = isOpen && hasChildren ? FolderOpen : FolderClosed

  return (
    <>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div
          className={`group flex items-center gap-1 rounded-md px-1 py-0.5 text-sm ${
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
          }`}
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
        >
          <CollapsibleTrigger asChild>
            <button
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm hover:bg-accent"
              aria-label={`Toggle ${node.folder.name}`}
            >
              <ChevronRight
                className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-90' : ''} ${
                  !hasChildren ? 'invisible' : ''
                }`}
              />
            </button>
          </CollapsibleTrigger>

          <button className="flex min-w-0 flex-1 items-center gap-1.5" onClick={() => onSelectFolder(node.folder.id)}>
            <FolderIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{node.folder.name}</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-sm opacity-0 hover:bg-accent group-hover:opacity-100"
                aria-label={`Actions for ${node.folder.name}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="right">
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateSubfolderOpen(true)}>
                <FolderPlus className="mr-2 h-4 w-4" />
                Create Subfolder
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {hasChildren && (
          <CollapsibleContent>
            {node.children.map((child) => (
              <FolderTreeItem
                key={child.folder.id}
                node={child}
                projectId={projectId}
                selectedFolderId={selectedFolderId}
                onSelectFolder={onSelectFolder}
                depth={depth + 1}
              />
            ))}
          </CollapsibleContent>
        )}
      </Collapsible>

      <EditFolderDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} folder={node.folder} />
      <DeleteFolderDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen} folder={node.folder} />
      <CreateFolderDialog
        open={createSubfolderOpen}
        onOpenChange={setCreateSubfolderOpen}
        projectId={projectId}
        parentFolderId={node.folder.id}
      />
    </>
  )
}
