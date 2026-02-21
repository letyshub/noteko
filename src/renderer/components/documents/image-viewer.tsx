import { useState, useCallback, useRef } from 'react'
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'
import { ZoomIn, ZoomOut, Maximize, Scan } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import { buildFileUrl } from '@renderer/components/documents/document-utils'

interface ImageViewerProps {
  filePath: string
}

export function ImageViewer({ filePath }: ImageViewerProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef({ x: 0, y: 0 })
  const positionStart = useRef({ x: 0, y: 0 })

  const notekoFileUrl = buildFileUrl(filePath)

  const clampScale = useCallback((value: number) => {
    return Math.max(0.1, Math.min(5.0, Math.round(value * 10) / 10))
  }, [])

  const handleZoomIn = useCallback(() => {
    setScale((prev) => clampScale(prev + 0.1))
  }, [clampScale])

  const handleZoomOut = useCallback(() => {
    setScale((prev) => clampScale(prev - 0.1))
  }, [clampScale])

  const handleFit = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleActualSize = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleWheel = useCallback(
    (e: ReactWheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setScale((prev) => clampScale(prev + delta))
    },
    [clampScale],
  )

  const handleMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault()
      setIsDragging(true)
      dragStart.current = { x: e.clientX, y: e.clientY }
      positionStart.current = { x: position.x, y: position.y }
    },
    [position],
  )

  const handleMouseMove = useCallback(
    (e: ReactMouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPosition({
        x: positionStart.current.x + dx,
        y: positionStart.current.y + dy,
      })
    },
    [isDragging],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleDoubleClick = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  return (
    <div className="flex flex-1 flex-col">
      {/* Image container */}
      <div
        className="flex flex-1 items-center justify-center overflow-hidden"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
      >
        <img
          src={notekoFileUrl}
          alt="Document preview"
          draggable={false}
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            maxWidth: '100%',
            maxHeight: '100%',
            userSelect: 'none',
          }}
        />
      </div>

      {/* Zoom controls */}
      <div className="flex items-center justify-center gap-1 border-t bg-muted/30 px-3 py-2">
        <Button size="icon" variant="ghost" onClick={handleZoomOut} aria-label="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <span className="min-w-[50px] text-center text-sm text-muted-foreground">{Math.round(scale * 100)}%</span>
        <Button size="icon" variant="ghost" onClick={handleZoomIn} aria-label="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleFit} aria-label="Fit to view">
          <Maximize className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleActualSize} aria-label="Actual size">
          <Scan className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
