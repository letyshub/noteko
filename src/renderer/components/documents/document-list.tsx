import { File, MoreHorizontal, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import { Button } from '@renderer/components/ui/button'
import { ProcessingStatusBadge } from '@renderer/components/documents/processing-status-badge'
import { DocumentGridItem } from '@renderer/components/documents/document-grid-item'
import { formatFileSize, getFileIcon } from '@renderer/components/documents/document-utils'
import type { DocumentDto } from '@shared/types'

interface DocumentListProps {
  documents: DocumentDto[]
  onDeleteDocument: (id: number) => void
  viewMode?: 'list' | 'grid'
}

export function DocumentList({ documents, onDeleteDocument, viewMode = 'list' }: DocumentListProps) {
  const navigate = useNavigate()

  if (documents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <File className="mb-3 h-10 w-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No documents in this folder</p>
      </div>
    )
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3">
        {documents.map((doc) => (
          <DocumentGridItem key={doc.id} document={doc} onClick={() => navigate(`/documents/${doc.id}`)} />
        ))}
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
            data-testid="document-row"
            className="group flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/50"
            onClick={() => navigate(`/documents/${doc.id}`)}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{doc.name}</p>
              <div className="flex items-center gap-2">
                <p className="text-xs text-muted-foreground">{formatFileSize(doc.file_size)}</p>
                <ProcessingStatusBadge status={doc.processing_status} />
              </div>
            </div>

            <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} role="presentation">
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
          </div>
        )
      })}
    </div>
  )
}
