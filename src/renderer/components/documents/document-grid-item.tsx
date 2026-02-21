import { useState } from 'react'
import { File, FileText, FileImage } from 'lucide-react'
import { ProcessingStatusBadge } from '@renderer/components/documents/processing-status-badge'
import {
  formatFileSize,
  isImage,
  buildFileUrl,
  isPdf,
  isTextBased,
} from '@renderer/components/documents/document-utils'
import type { DocumentDto } from '@shared/types'

interface DocumentGridItemProps {
  document: DocumentDto
  onClick: () => void
}

function FileTypeIcon({ fileType }: { fileType: string }) {
  if (isPdf(fileType)) return <FileText className="h-10 w-10 text-muted-foreground" />
  if (isTextBased(fileType)) return <FileText className="h-10 w-10 text-muted-foreground" />
  if (isImage(fileType)) return <FileImage className="h-10 w-10 text-muted-foreground" />
  return <File className="h-10 w-10 text-muted-foreground" />
}

export function DocumentGridItem({ document, onClick }: DocumentGridItemProps) {
  const [imgError, setImgError] = useState(false)
  const showImage = isImage(document.file_type) && !imgError

  return (
    <div
      data-testid="grid-card"
      className="group cursor-pointer rounded-lg border p-2 transition-colors hover:bg-accent/50"
      onClick={onClick}
    >
      {/* Thumbnail area */}
      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md bg-muted">
        {showImage ? (
          <img
            src={buildFileUrl(document.file_path)}
            alt={document.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <FileTypeIcon fileType={document.file_type} />
        )}
      </div>

      {/* Metadata */}
      <div className="mt-2 min-w-0">
        <p className="truncate text-sm font-medium">{document.name}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{formatFileSize(document.file_size)}</span>
          <ProcessingStatusBadge status={document.processing_status} />
        </div>
      </div>
    </div>
  )
}
