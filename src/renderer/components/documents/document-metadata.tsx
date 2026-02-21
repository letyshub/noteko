import { Calendar, HardDrive, File, FileText, FileImage } from 'lucide-react'
import { Separator } from '@renderer/components/ui/separator'
import { ProcessingStatusBadge } from '@renderer/components/documents/processing-status-badge'
import { formatFileSize } from '@renderer/components/documents/document-utils'
import type { DocumentDetailDto } from '@shared/types'

interface DocumentMetadataProps {
  document: DocumentDetailDto
}

const iconClass = 'h-5 w-5 text-muted-foreground'

function renderFileIcon(fileType: string) {
  if (fileType === 'pdf') return <FileText className={iconClass} />
  if (['png', 'jpg', 'jpeg', 'gif'].includes(fileType)) return <FileImage className={iconClass} />
  if (['doc', 'docx', 'txt', 'md', 'csv'].includes(fileType)) return <FileText className={iconClass} />
  return <File className={iconClass} />
}

export function DocumentMetadata({ document }: DocumentMetadataProps) {
  const uploadDate = new Date(document.created_at).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
          {renderFileIcon(document.file_type)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold">{document.name}</h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <HardDrive className="h-3 w-3" />
              {formatFileSize(document.file_size)}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {uploadDate}
            </span>
            <ProcessingStatusBadge status={document.processing_status} />
          </div>
        </div>
      </div>
      <Separator />
    </div>
  )
}
