/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// ---------------------------------------------------------------------------
// Mock electronAPI for file upload IPC channels
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  'file:open-dialog': vi.fn(),
  'file:upload': vi.fn(),
  'file:validate': vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock upload store for component tests
// ---------------------------------------------------------------------------
const mockUploadStoreState = {
  items: [] as any[],
  isUploading: false,
  addFiles: vi.fn(),
  uploadNext: vi.fn(),
  uploadAll: vi.fn(),
  removeItem: vi.fn(),
  clearCompleted: vi.fn(),
  clearAll: vi.fn(),
}

vi.mock('@renderer/store/upload-store', () => ({
  useUploadStore: Object.assign((selector: any) => selector(mockUploadStoreState), {
    getState: () => mockUploadStoreState,
    setState: (s: any) => Object.assign(mockUploadStoreState, typeof s === 'function' ? s(mockUploadStoreState) : s),
    subscribe: vi.fn(),
  }),
}))

// ===========================================================================
// Drop Zone Component Tests
// ===========================================================================
describe('DropZone', () => {
  let DropZone: any

  beforeEach(async () => {
    vi.clearAllMocks()
    mockUploadStoreState.items = []
    mockUploadStoreState.isUploading = false

    const mod = await import('@renderer/components/upload/drop-zone')
    DropZone = mod.DropZone
  })

  it('renders children content', () => {
    render(
      <DropZone projectId={1} folderId={1}>
        <div data-testid="child-content">Document List</div>
      </DropZone>,
    )

    expect(screen.getByTestId('child-content')).toBeInTheDocument()
    expect(screen.getByText('Document List')).toBeInTheDocument()
  })

  it('renders a browse files button', () => {
    render(
      <DropZone projectId={1} folderId={1}>
        <div>Content</div>
      </DropZone>,
    )

    const browseButton = screen.getByRole('button', { name: /browse/i })
    expect(browseButton).toBeInTheDocument()
  })

  it('calls file:open-dialog and onFilesAdded when browse button is clicked', async () => {
    const onFilesAdded = vi.fn()
    mockElectronAPI['file:open-dialog'].mockResolvedValue({
      success: true,
      data: ['/home/user/doc.pdf', '/home/user/img.png'],
    })

    const user = userEvent.setup()
    render(
      <DropZone projectId={1} folderId={1} onFilesAdded={onFilesAdded}>
        <div>Content</div>
      </DropZone>,
    )

    const browseButton = screen.getByRole('button', { name: /browse/i })
    await user.click(browseButton)

    await waitFor(() => {
      expect(mockElectronAPI['file:open-dialog']).toHaveBeenCalled()
      expect(onFilesAdded).toHaveBeenCalledWith(['/home/user/doc.pdf', '/home/user/img.png'])
    })
  })

  it('shows visual feedback on drag over', () => {
    render(
      <DropZone projectId={1} folderId={1}>
        <div>Content</div>
      </DropZone>,
    )

    const dropZone = screen.getByTestId('drop-zone')

    // Simulate drag enter
    fireEvent.dragEnter(dropZone, {
      dataTransfer: { types: ['Files'] },
    })

    // Should have drag-over visual styling
    expect(dropZone).toHaveAttribute('data-drag-over', 'true')
  })
})

// ===========================================================================
// Upload Progress Component Tests
// ===========================================================================

// Mock radix-ui Progress primitive for jsdom
vi.mock('@renderer/components/ui/progress', () => ({
  Progress: ({ value, ...props }: any) => <div role="progressbar" data-value={value} {...props} />,
}))

vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, variant, ...props }: any) => (
    <span data-variant={variant} {...props}>
      {children}
    </span>
  ),
}))

describe('UploadProgress', () => {
  let UploadProgress: any

  beforeEach(async () => {
    vi.clearAllMocks()

    const mod = await import('@renderer/components/upload/upload-progress')
    UploadProgress = mod.UploadProgress
  })

  it('renders nothing when there are no items', () => {
    mockUploadStoreState.items = []

    const { container } = render(<UploadProgress />)
    expect(container.firstChild).toBeNull()
  })

  it('renders file names for each upload item', () => {
    mockUploadStoreState.items = [
      { id: '1', fileName: 'report.pdf', filePath: '/report.pdf', status: 'pending', progress: 0 },
      { id: '2', fileName: 'photo.png', filePath: '/photo.png', status: 'success', progress: 100 },
    ]

    render(<UploadProgress />)

    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('photo.png')).toBeInTheDocument()
  })

  it('shows correct status for each item', () => {
    mockUploadStoreState.items = [
      { id: '1', fileName: 'uploading.pdf', filePath: '/a.pdf', status: 'uploading', progress: 50 },
      { id: '2', fileName: 'done.pdf', filePath: '/b.pdf', status: 'success', progress: 100 },
      { id: '3', fileName: 'failed.pdf', filePath: '/c.pdf', status: 'error', progress: 0, error: 'Too large' },
    ]

    render(<UploadProgress />)

    expect(screen.getByText('uploading.pdf')).toBeInTheDocument()
    expect(screen.getByText('done.pdf')).toBeInTheDocument()
    expect(screen.getByText('failed.pdf')).toBeInTheDocument()
    expect(screen.getByText('Too large')).toBeInTheDocument()
  })

  it('renders a clear completed button and calls clearCompleted', async () => {
    mockUploadStoreState.items = [
      { id: '1', fileName: 'done.pdf', filePath: '/b.pdf', status: 'success', progress: 100 },
    ]

    const user = userEvent.setup()
    render(<UploadProgress />)

    const clearBtn = screen.getByRole('button', { name: /clear/i })
    await user.click(clearBtn)

    expect(mockUploadStoreState.clearCompleted).toHaveBeenCalled()
  })
})
