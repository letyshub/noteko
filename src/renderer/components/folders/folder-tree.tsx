import { FolderTreeItem, type FolderNode } from '@renderer/components/folders/folder-tree-item'
import type { FolderDto } from '@shared/types'

interface FolderTreeProps {
  folders: FolderDto[]
  projectId: number
  selectedFolderId: number | null
  onSelectFolder: (folderId: number) => void
}

/**
 * Build a tree structure from a flat list of FolderDto[].
 * Root folders have parent_folder_id === null.
 */
function buildTree(folders: FolderDto[]): FolderNode[] {
  const map = new Map<number, FolderNode>()
  const roots: FolderNode[] = []

  // Create node for each folder
  for (const folder of folders) {
    map.set(folder.id, { folder, children: [] })
  }

  // Link children to parents
  for (const folder of folders) {
    const node = map.get(folder.id)!
    if (folder.parent_folder_id === null) {
      roots.push(node)
    } else {
      const parent = map.get(folder.parent_folder_id)
      if (parent) {
        parent.children.push(node)
      } else {
        // Orphan — treat as root
        roots.push(node)
      }
    }
  }

  return roots
}

export function FolderTree({ folders, projectId, selectedFolderId, onSelectFolder }: FolderTreeProps) {
  const tree = buildTree(folders)

  if (tree.length === 0) {
    return <div className="px-2 py-4 text-center text-sm text-muted-foreground">No folders yet</div>
  }

  return (
    <div className="space-y-0.5">
      {tree.map((node) => (
        <FolderTreeItem
          key={node.folder.id}
          node={node}
          projectId={projectId}
          selectedFolderId={selectedFolderId}
          onSelectFolder={onSelectFolder}
        />
      ))}
    </div>
  )
}
