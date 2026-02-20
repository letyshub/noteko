import { useCallback, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { useUploadStore } from '@renderer/store/upload-store'

interface DropZoneProps {
  projectId: number
  folderId: number
  onFilesAdded?: (paths: string[]) => void
  children: React.ReactNode
}

export function DropZone({ projectId, folderId, onFilesAdded, children }: DropZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const addFiles = useUploadStore((s) => s.addFiles)
  const uploadAll = useUploadStore((s) => s.uploadAll)

  const handleFiles = useCallback(
    (paths: Array<{ name: string; path: string }>) => {
      if (paths.length === 0) return
      addFiles(paths)
      onFilesAdded?.(paths.map((p) => p.path))
      uploadAll(projectId, folderId)
    },
    [addFiles, uploadAll, projectId, folderId, onFilesAdded],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const files = Array.from(e.dataTransfer.files)
      const fileEntries = files.map((file) => ({
        name: file.name,
        path: (file as File & { path: string }).path,
      }))
      handleFiles(fileEntries)
    },
    [handleFiles],
  )

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set drag-over to false if leaving the drop zone itself
    const relatedTarget = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false)
    }
  }, [])

  const handleBrowse = useCallback(async () => {
    try {
      const result = await window.electronAPI['file:open-dialog']()
      if (result.success && result.data.length > 0) {
        const fileEntries = result.data.map((filePath) => ({
          name: filePath.split(/[/\\]/).pop() ?? filePath,
          path: filePath,
        }))
        handleFiles(fileEntries)
      }
    } catch {
      // Dialog cancelled or error — silently ignore
    }
  }, [handleFiles])

  return (
    <div
      data-testid="drop-zone"
      data-drag-over={isDragOver ? 'true' : 'false'}
      className={`relative ${isDragOver ? 'rounded-lg border-2 border-dashed border-primary bg-primary/5' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {isDragOver && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-primary/10">
          <div className="flex flex-col items-center gap-2 text-primary">
            <Upload className="h-8 w-8" />
            <p className="text-sm font-medium">Drop files here</p>
          </div>
        </div>
      )}

      {children}

      <div className="flex items-center justify-center px-4 py-2">
        <Button variant="outline" size="sm" onClick={handleBrowse} aria-label="Browse Files">
          <Upload className="mr-1.5 h-4 w-4" />
          Browse Files
        </Button>
      </div>
    </div>
  )
}
