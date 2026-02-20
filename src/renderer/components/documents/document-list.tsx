import { File, FileText, FileImage, MoreHorizontal, Trash2 } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Button } from '@renderer/components/ui/button'
import type { DocumentDto } from '@shared/types'

interface DocumentListProps {
  documents: DocumentDto[]
  onDeleteDocument: (id: number) => void
}

/**
 * Format bytes into a human-readable string (e.g., "2.3 MB", "156 KB").
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`
}

/**
 * Get the appropriate icon component based on file type.
 */
function getFileIcon(fileType: string) {
  if (fileType.includes('pdf')) return FileText
  if (fileType.startsWith('image/')) return FileImage
  return File
}

export function DocumentList({ documents, onDeleteDocument }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <File className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No documents in this folder</p>
      </div>
    )
  }

  return (
    <div className="grid gap-2">
      {documents.map((doc) => {
        const Icon = getFileIcon(doc.file_type)
        return (
          <div
            key={doc.id}
            className="group flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{doc.name}</p>
              <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100"
                  aria-label={`Actions for ${doc.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="destructive" onClick={() => onDeleteDocument(doc.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}
    </div>
  )
}
