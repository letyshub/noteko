import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router'
import { FolderPlus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { Separator } from '@renderer/components/ui/separator'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { FolderTree } from '@renderer/components/folders/folder-tree'
import { DocumentList } from '@renderer/components/documents/document-list'
import { DocumentListToolbar } from '@renderer/components/documents/document-list-toolbar'
import type { SortField } from '@renderer/components/documents/document-list-toolbar'
import { DropZone } from '@renderer/components/upload/drop-zone'
import { UploadProgress } from '@renderer/components/upload/upload-progress'
import { CreateFolderDialog } from '@renderer/components/folders/create-folder-dialog'
import { EditProjectDialog } from '@renderer/components/projects/edit-project-dialog'
import { DeleteProjectDialog } from '@renderer/components/projects/delete-project-dialog'
import { useProjectStore, useFolderStore, useDocumentStore, useUIStore } from '@renderer/store'
import type { DocumentDto } from '@shared/types'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)

  // Store selectors
  const projects = useProjectStore((s) => s.projects)
  const project = projects.find((p) => p.id === projectId) ?? null

  const folders = useFolderStore((s) => s.folders)
  const fetchFolders = useFolderStore((s) => s.fetchFolders)

  const documents = useDocumentStore((s) => s.documents)
  const fetchDocumentsByProject = useDocumentStore((s) => s.fetchDocumentsByProject)
  const fetchDocumentsByFolder = useDocumentStore((s) => s.fetchDocumentsByFolder)
  const deleteDocument = useDocumentStore((s) => s.deleteDocument)

  const setCurrentPageTitle = useUIStore((s) => s.setCurrentPageTitle)

  // Compound state: folder selection auto-resets when project changes (no effect needed)
  const [selectedFolder, setSelectedFolder] = useState<{
    projectId: number
    folderId: number
  } | null>(null)
  const selectedFolderId = selectedFolder?.projectId === projectId ? selectedFolder.folderId : null

  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)

  // Toolbar state
  const [sortBy, setSortBy] = useState<SortField>('name')

  // Sort documents
  const sortedDocuments = useMemo(() => {
    const sorted = [...documents]
    sorted.sort((a: DocumentDto, b: DocumentDto) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'size':
          return b.file_size - a.file_size
        case 'type':
          return a.file_type.localeCompare(b.file_type)
        default:
          return 0
      }
    })
    return sorted
  }, [documents, sortBy])

  // Set page title
  useEffect(() => {
    setCurrentPageTitle(project?.name ?? 'Project')
  }, [project?.name, setCurrentPageTitle])

  // Fetch folders when project changes
  useEffect(() => {
    if (projectId) {
      fetchFolders(projectId)
    }
  }, [projectId, fetchFolders])

  // Fetch documents based on selected folder
  useEffect(() => {
    if (!projectId) return
    if (selectedFolderId !== null) {
      fetchDocumentsByFolder(selectedFolderId)
    } else {
      fetchDocumentsByProject(projectId)
    }
  }, [projectId, selectedFolderId, fetchDocumentsByProject, fetchDocumentsByFolder])

  const handleSelectFolder = useCallback(
    (folderId: number) => {
      setSelectedFolder((prev) => (prev?.folderId === folderId ? null : { projectId, folderId }))
    },
    [projectId],
  )

  const handleDeleteDocument = useCallback(
    (docId: number) => {
      deleteDocument(docId)
    },
    [deleteDocument],
  )

  if (!project) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">Project not found</p>
      </div>
    )
  }

  const selectedFolderName = selectedFolderId ? folders.find((f) => f.id === selectedFolderId)?.name : null

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-start justify-between border-b px-6 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            {project.color && (
              <span className="inline-block h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
            )}
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
          </div>
          {project.description && <p className="mt-1 text-sm text-muted-foreground">{project.description}</p>}
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditProjectOpen(true)}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDeleteProjectOpen(true)}>
            <Trash2 className="mr-1.5 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Content area: folder tree + document list */}
      <div className="flex flex-1 overflow-hidden">
        {/* Folder tree panel */}
        <div className="w-64 shrink-0 border-r">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-sm font-semibold">Folders</h2>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => setCreateFolderOpen(true)}
              aria-label="New Folder"
            >
              <FolderPlus className="h-4 w-4" />
            </Button>
          </div>
          <Separator />
          <ScrollArea className="h-[calc(100vh-12rem)]">
            <div className="p-2">
              <FolderTree
                folders={folders}
                projectId={projectId}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
              />
            </div>
          </ScrollArea>
        </div>

        {/* Document list panel */}
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="flex items-center justify-between px-6 py-3">
            <h2 className="text-sm font-semibold">
              {selectedFolderName ? `Documents in "${selectedFolderName}"` : 'All Documents'}
            </h2>
            <DocumentListToolbar sortBy={sortBy} onSortChange={setSortBy} />
          </div>
          <Separator />
          <div className="flex-1 p-4">
            <DropZone projectId={projectId} folderId={selectedFolderId ?? 0}>
              <DocumentList documents={sortedDocuments} onDeleteDocument={handleDeleteDocument} />
            </DropZone>
          </div>
          <UploadProgress />
        </div>
      </div>

      {/* Dialogs */}
      <CreateFolderDialog open={createFolderOpen} onOpenChange={setCreateFolderOpen} projectId={projectId} />
      <EditProjectDialog open={editProjectOpen} onOpenChange={setEditProjectOpen} project={project} />
      <DeleteProjectDialog open={deleteProjectOpen} onOpenChange={setDeleteProjectOpen} project={project} />
    </div>
  )
}
