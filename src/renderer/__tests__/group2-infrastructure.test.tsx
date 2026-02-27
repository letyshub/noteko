/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import { act } from '@testing-library/react'

// ---------------------------------------------------------------------------
// Polyfills for jsdom environment
// ---------------------------------------------------------------------------

// ResizeObserver is required by react-resizable-panels but not provided by jsdom
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as any
}

// DOMMatrix is required by pdfjs-dist but not provided by jsdom
if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix {
    constructor() {
      return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }
    }
  } as any
}

// ---------------------------------------------------------------------------
// 1. Smoke test: react-pdf Document and Page can be imported
// ---------------------------------------------------------------------------
describe('react-pdf smoke test', () => {
  it('exports Document and Page components', async () => {
    const reactPdf = await import('react-pdf')
    expect(reactPdf.Document).toBeDefined()
    expect(reactPdf.Page).toBeDefined()
    // React components using forwardRef are objects with a $$typeof symbol, not plain functions
    expect(reactPdf.Document).toBeTruthy()
    expect(reactPdf.Page).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// 2. Smoke test: ResizablePanelGroup, ResizablePanel, ResizableHandle render
// ---------------------------------------------------------------------------
describe('shadcn/ui resizable components', () => {
  it('renders ResizablePanelGroup with panels and handle without errors', async () => {
    const { ResizablePanelGroup, ResizablePanel, ResizableHandle } = await import('@renderer/components/ui/resizable')

    const { container } = render(
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={50}>
          <div>Left panel</div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50}>
          <div>Right panel</div>
        </ResizablePanel>
      </ResizablePanelGroup>,
    )

    expect(container).toBeTruthy()
    expect(container.textContent).toContain('Left panel')
    expect(container.textContent).toContain('Right panel')
  })
})

// ---------------------------------------------------------------------------
// 3. useUIStore documentViewMode state and localStorage persistence
// ---------------------------------------------------------------------------
describe('useUIStore documentViewMode', () => {
  // Mock localStorage
  const localStorageMock = (() => {
    let store: Record<string, string> = {}
    return {
      getItem: vi.fn((key: string) => store[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = value
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key]
      }),
      clear: vi.fn(() => {
        store = {}
      }),
      get length() {
        return Object.keys(store).length
      },
      key: vi.fn((index: number) => Object.keys(store)[index] ?? null),
    }
  })()

  Object.defineProperty(window, 'localStorage', { value: localStorageMock })

  beforeEach(() => {
    vi.clearAllMocks()
    localStorageMock.clear()
    vi.resetModules()
  })

  it('initializes documentViewMode to "list" by default', async () => {
    const { useUIStore } = await import('@renderer/store/ui-store')
    const state = useUIStore.getState()
    expect(state.documentViewMode).toBe('list')
  })

  it('setDocumentViewMode updates state and persists to localStorage', async () => {
    const { useUIStore } = await import('@renderer/store/ui-store')

    act(() => {
      useUIStore.getState().setDocumentViewMode('grid')
    })

    expect(useUIStore.getState().documentViewMode).toBe('grid')
    expect(localStorageMock.setItem).toHaveBeenCalledWith('noteko-document-view-mode', 'grid')
  })

  it('reads initial documentViewMode from localStorage when available', async () => {
    localStorageMock.setItem('noteko-document-view-mode', 'grid')

    const { useUIStore } = await import('@renderer/store/ui-store')
    const state = useUIStore.getState()
    expect(state.documentViewMode).toBe('grid')
  })
})
