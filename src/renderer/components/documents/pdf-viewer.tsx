import { useState, useCallback } from 'react'
import { Document, Page } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { ScrollArea } from '@renderer/components/ui/scroll-area'
import { buildFileUrl } from '@renderer/components/documents/document-utils'
import '@renderer/lib/pdf-worker'

interface PdfViewerProps {
  filePath: string
}

export function PdfViewer({ filePath }: PdfViewerProps) {
  const [pageNumber, setPageNumber] = useState(1)
  const [numPages, setNumPages] = useState<number | null>(null)
  const [scale, setScale] = useState(1.0)
  const [loadError, setLoadError] = useState<string | null>(null)

  const notekoFileUrl = buildFileUrl(filePath)

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoadError(null)
  }, [])

  const onLoadError = useCallback((error: Error) => {
    setLoadError(error.message || 'Failed to load PDF')
  }, [])

  const goToPrevPage = useCallback(() => {
    setPageNumber((prev) => Math.max(1, prev - 1))
  }, [])

  const goToNextPage = useCallback(() => {
    setPageNumber((prev) => Math.min(numPages ?? prev, prev + 1))
  }, [numPages])

  const zoomIn = useCallback(() => {
    setScale((prev) => Math.min(3.0, Math.round((prev + 0.1) * 10) / 10))
  }, [])

  const zoomOut = useCallback(() => {
    setScale((prev) => Math.max(0.3, Math.round((prev - 0.1) * 10) / 10))
  }, [])

  const fitToWidth = useCallback(() => {
    setScale(1.0)
  }, [])

  if (loadError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">Failed to load PDF</p>
        <p className="text-xs text-muted-foreground">{loadError}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* PDF content */}
      <ScrollArea className="flex-1">
        <div className="flex justify-center p-4">
          <Document
            file={notekoFileUrl}
            onLoadSuccess={onLoadSuccess}
            onLoadError={onLoadError}
            loading={
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            }
            error={
              <div className="flex items-center justify-center p-8">
                <p className="text-sm text-destructive">Failed to load PDF</p>
              </div>
            }
          >
            <Page pageNumber={pageNumber} scale={scale} />
          </Document>
        </div>
      </ScrollArea>

      {/* Navigation and zoom controls */}
      {numPages !== null && (
        <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-2">
          {/* Page navigation */}
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={goToPrevPage}
              disabled={pageNumber <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[100px] text-center text-sm text-muted-foreground">
              Page {pageNumber} of {numPages}
            </span>
            <Button
              size="icon"
              variant="ghost"
              onClick={goToNextPage}
              disabled={pageNumber >= numPages}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" onClick={zoomOut} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="min-w-[50px] text-center text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
            <Button size="icon" variant="ghost" onClick={zoomIn} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={fitToWidth} aria-label="Fit to width">
              <Maximize className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
