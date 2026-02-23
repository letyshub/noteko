import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'react-router'
import { FolderPlus, Pencil, Trash2, X } from 'lucide-react'
import { Badge } from '@renderer/components/ui/badge'
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
import { useProjectStore, useFolderStore, useDocumentStore, useUIStore, useTagStore } from '@renderer/store'
import type { DocumentDto, TagDto } from '@shared/types'

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
  const documentViewMode = useUIStore((s) => s.documentViewMode)
  const setDocumentViewMode = useUIStore((s) => s.setDocumentViewMode)

  const tagCloud = useTagStore((s) => s.tagCloud)
  const fetchTagCloud = useTagStore((s) => s.fetchTagCloud)
  const batchGetDocumentTags = useTagStore((s) => s.batchGetDocumentTags)

  // Compound state: folder selection auto-resets when project changes (no effect needed)
  const [selectedFolder, setSelectedFolder] = useState<{
    projectId: number
    folderId: number
  } | null>(null)
  const selectedFolderId = selectedFolder?.projectId === projectId ? selectedFolder.folderId : null
  // Root folder is the first folder for this project (auto-created with project)
  const rootFolderId = folders.length > 0 ? folders[0].id : null

  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [editProjectOpen, setEditProjectOpen] = useState(false)
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false)

  // Toolbar state
  const [sortBy, setSortBy] = useState<SortField>('name')

  // Tag filter state
  const [selectedTags, setSelectedTags] = useState<number[]>([])
  const [tagFilteredDocs, setTagFilteredDocs] = useState<DocumentDto[] | null>(null)
  const [documentTags, setDocumentTags] = useState<Record<number, TagDto[]>>({})

  // Fetch tag cloud
  useEffect(() => {
    fetchTagCloud()
  }, [fetchTagCloud])

  // When tags are selected, call listDocumentsByTags IPC
  useEffect(() => {
    if (selectedTags.length === 0) return
    let cancelled = false
    window.electronAPI['db:documents:by-tags'](selectedTags).then((result) => {
      if (!cancelled && result.success) {
        // Filter to only docs in this project
        const projectDocs = result.data.filter((d: DocumentDto) => d.project_id === projectId)
        setTagFilteredDocs(projectDocs)
      }
    })
    return () => {
      cancelled = true
    }
  }, [selectedTags, projectId])

  // Derive effective filtered docs (null when no tags selected, avoids sync setState in effect)
  const effectiveTagFilteredDocs = selectedTags.length > 0 ? tagFilteredDocs : null

  // Batch-load tags for displayed documents
  const displayedDocuments = effectiveTagFilteredDocs ?? documents
  useEffect(() => {
    if (displayedDocuments.length === 0) return
    const docIds = displayedDocuments.map((d) => d.id)
    batchGetDocumentTags(docIds).then(setDocumentTags)
  }, [displayedDocuments, batchGetDocumentTags])

  const handleTagSelectionChange = useCallback((tagIds: number[]) => {
    setSelectedTags(tagIds)
  }, [])

  const handleRemoveTagFilter = useCallback((tagId: number) => {
    setSelectedTags((prev) => prev.filter((id) => id !== tagId))
  }, [])

  // Sort documents (use tag-filtered docs if tag filter is active)
  const docsToSort = effectiveTagFilteredDocs ?? documents
  const sortedDocuments = useMemo(() => {
    const sorted = [...docsToSort]
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
  }, [docsToSort, sortBy])

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
            <DocumentListToolbar
              sortBy={sortBy}
              onSortChange={setSortBy}
              viewMode={documentViewMode}
              onViewModeChange={setDocumentViewMode}
              selectedTagIds={selectedTags}
              tagCloud={tagCloud}
              onTagSelectionChange={handleTagSelectionChange}
            />
          </div>
          {/* Active tag filter badges */}
          {selectedTags.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b px-6 py-2">
              <span className="text-xs text-muted-foreground mr-1">Filtered by:</span>
              {selectedTags.map((tagId) => {
                const tag = tagCloud.find((t) => t.id === tagId)
                if (!tag) return null
                return (
                  <Badge key={tagId} variant="secondary" className="gap-1 pr-1">
                    <span
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color || '#6b7280' }}
                    />
                    {tag.name}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="ml-1 size-4 rounded-full"
                      onClick={() => handleRemoveTagFilter(tagId)}
                      aria-label={`Remove ${tag.name} filter`}
                    >
                      <X className="size-3" />
                    </Button>
                  </Badge>
                )
              })}
            </div>
          )}
          <Separator />
          <div className="flex-1 p-4">
            <DropZone projectId={projectId} folderId={selectedFolderId ?? rootFolderId ?? 0}>
              <DocumentList
                documents={sortedDocuments}
                onDeleteDocument={handleDeleteDocument}
                viewMode={documentViewMode}
                documentTags={documentTags}
              />
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
