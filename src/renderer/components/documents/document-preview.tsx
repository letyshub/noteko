import { useState, useEffect } from 'react'
import { Loader2, FileWarning, FileQuestion, FileText, ExternalLink } from 'lucide-react'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Button } from '@renderer/components/ui/button'
import { ImageViewer } from '@renderer/components/documents/image-viewer'
import { isPdf, isImage, isTextBased, buildFileUrl } from '@renderer/components/documents/document-utils'
import type { DocumentDetailDto } from '@shared/types'

interface DocumentPreviewProps {
  document: DocumentDetailDto
}

export function DocumentPreview({ document }: DocumentPreviewProps) {
  const { file_type, file_path, processing_status } = document

  // Show loading placeholder for processing/pending status
  if (processing_status === 'processing' || processing_status === 'pending') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Document is processing...</p>
      </div>
    )
  }

  // Show warning for failed status
  if (processing_status === 'failed') {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">Processing failed</p>
        <p className="text-xs text-muted-foreground">
          The document could not be processed. Try retrying from the sidebar.
        </p>
      </div>
    )
  }

  // Dispatch to appropriate viewer based on file type
  if (isPdf(file_type)) {
    return <OpenInSystemApp filePath={file_path} />
  }

  if (isImage(file_type)) {
    return <ImageViewer filePath={file_path} />
  }

  if (isTextBased(file_type)) {
    return <TextPreview filePath={file_path} />
  }

  // Fallback for unsupported file types
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <FileQuestion className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm font-medium">Preview not available</p>
      <p className="text-xs text-muted-foreground">This file type does not support preview.</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal component: OpenInSystemApp
// ---------------------------------------------------------------------------

function OpenInSystemApp({ filePath }: { filePath: string }) {
  const [error, setError] = useState<string | null>(null)

  async function handleOpen() {
    setError(null)
    const result = await window.electronAPI['file:open-in-system-app'](filePath)
    if (!result.success) {
      setError(result.error.message)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
      <FileText className="h-12 w-12 text-muted-foreground" />
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium">PDF preview not available</p>
        <p className="text-xs text-muted-foreground">Open the file in your system PDF viewer.</p>
      </div>
      <Button onClick={handleOpen} variant="outline" size="sm" className="gap-2">
        <ExternalLink className="h-4 w-4" />
        Open in system app
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal component: TextPreview
// ---------------------------------------------------------------------------

function TextPreview({ filePath }: { filePath: string }) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const notekoFileUrl = buildFileUrl(filePath)

  useEffect(() => {
    let cancelled = false

    async function fetchText() {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(notekoFileUrl)
        if (!response.ok) {
          throw new Error(`Failed to fetch text: ${response.status}`)
        }
        const content = await response.text()
        if (!cancelled) {
          setText(content)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load text')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchText()

    return () => {
      cancelled = true
    }
  }, [notekoFileUrl])

  if (loading) {
    return (
      <div className="flex flex-1 flex-col gap-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <FileWarning className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">Failed to load text</p>
        <p className="text-xs text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-4">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed">{text}</pre>
      </div>
    </ScrollArea>
  )
}
