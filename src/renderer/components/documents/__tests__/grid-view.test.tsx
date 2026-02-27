/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI (required by some downstream components)
// ---------------------------------------------------------------------------
const mockElectronAPI = {
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
}

Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true,
})

// ---------------------------------------------------------------------------
// Mock react-router
// ---------------------------------------------------------------------------
const mockNavigate = vi.fn()

vi.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
  useParams: () => ({ id: '1' }),
  Link: ({ to, children, ...props }: any) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}))

// ---------------------------------------------------------------------------
// Mock shadcn/ui components for jsdom
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/ui/badge', () => ({
  Badge: ({ children, variant, className, ...props }: any) => (
    <span data-variant={variant} data-testid="badge" className={className} {...props}>
      {children}
    </span>
  ),
}))

vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: any) => (
    <button data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, ...props }: any) => (
    <div data-testid="dropdown-menu-trigger" {...props}>
      {children}
    </div>
  ),
  DropdownMenuContent: ({ children, ...props }: any) => (
    <div data-testid="dropdown-menu-content" {...props}>
      {children}
    </div>
  ),
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <div role="menuitem" onClick={onClick} {...props}>
      {children}
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Test data — file_type uses bare extensions (matching document-utils)
// ---------------------------------------------------------------------------
const imageDoc: DocumentDto = {
  id: 1,
  name: 'photo-landscape-very-long-name-that-should-truncate.png',
  file_path: '/files/photo.png',
  file_type: 'png',
  file_size: 2097152,
  folder_id: 1,
  project_id: 1,
  processing_status: 'completed',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-10T08:00:00Z',
}

const pdfDoc: DocumentDto = {
  id: 2,
  name: 'report.pdf',
  file_path: '/files/report.pdf',
  file_type: 'pdf',
  file_size: 1048576,
  folder_id: 1,
  project_id: 1,
  processing_status: 'pending',
  created_at: '2026-01-15T12:00:00Z',
  updated_at: '2026-01-15T12:00:00Z',
}

const docxDoc: DocumentDto = {
  id: 3,
  name: 'notes.docx',
  file_path: '/files/notes.docx',
  file_type: 'docx',
  file_size: 524288,
  folder_id: 1,
  project_id: 1,
  processing_status: 'failed',
  created_at: '2026-01-05T06:00:00Z',
  updated_at: '2026-01-05T06:00:00Z',
}

const testDocuments: DocumentDto[] = [imageDoc, pdfDoc, docxDoc]

// ===========================================================================
// DocumentGridItem Tests
// ===========================================================================
describe('DocumentGridItem', () => {
  let DocumentGridItem: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../document-grid-item')
    DocumentGridItem = mod.DocumentGridItem
  })

  it('renders document name, file size, and status badge', () => {
    render(<DocumentGridItem document={pdfDoc} onClick={vi.fn()} />)

    expect(screen.getByText('report.pdf')).toBeInTheDocument()
    expect(screen.getByText('1 MB')).toBeInTheDocument()
    expect(screen.getByTestId('badge')).toBeInTheDocument()
    expect(screen.getByText('Pending')).toBeInTheDocument()
  })

  it('renders img element with noteko-file:// src for image documents', () => {
    render(<DocumentGridItem document={imageDoc} onClick={vi.fn()} />)

    const img = screen.getByRole('img')
    expect(img).toBeInTheDocument()
    expect(img).toHaveAttribute('src', 'noteko-file://localhost/files/photo.png')
  })

  it('renders file-type icon (not img) for non-image documents', () => {
    render(<DocumentGridItem document={pdfDoc} onClick={vi.fn()} />)

    // Should not have an img element
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    // Should have an SVG icon (from lucide-react which renders SVGs)
    const card = screen.getByText('report.pdf').closest('[data-testid="grid-card"]')
    expect(card).toBeInTheDocument()
  })

  it('calls onClick when card is clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<DocumentGridItem document={pdfDoc} onClick={handleClick} />)

    const card = screen.getByTestId('grid-card')
    await user.click(card)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})

// ===========================================================================
// DocumentList - Grid vs List Mode Tests
// ===========================================================================
describe('DocumentList - view modes', () => {
  let DocumentList: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../document-list')
    DocumentList = mod.DocumentList
  })

  it('renders grid layout with DocumentGridItem cards when viewMode is "grid"', () => {
    render(<DocumentList documents={testDocuments} onDeleteDocument={vi.fn()} viewMode="grid" />)

    // Grid cards should exist
    const gridCards = screen.getAllByTestId('grid-card')
    expect(gridCards).toHaveLength(3)

    // Should NOT have list rows
    expect(screen.queryByTestId('document-row')).not.toBeInTheDocument()
  })

  it('renders existing list layout when viewMode is "list"', () => {
    render(<DocumentList documents={testDocuments} onDeleteDocument={vi.fn()} viewMode="list" />)

    // List rows should exist
    const listRows = screen.getAllByTestId('document-row')
    expect(listRows).toHaveLength(3)

    // Should NOT have grid cards
    expect(screen.queryByTestId('grid-card')).not.toBeInTheDocument()
  })

  it('shows empty state for both grid and list modes', () => {
    const { rerender } = render(<DocumentList documents={[]} onDeleteDocument={vi.fn()} viewMode="grid" />)
    expect(screen.getByText(/no documents/i)).toBeInTheDocument()

    rerender(<DocumentList documents={[]} onDeleteDocument={vi.fn()} viewMode="list" />)
    expect(screen.getByText(/no documents/i)).toBeInTheDocument()
  })

  it('navigates to /documents/:id when a grid card is clicked', async () => {
    const user = userEvent.setup()
    render(<DocumentList documents={testDocuments} onDeleteDocument={vi.fn()} viewMode="grid" />)

    const gridCards = screen.getAllByTestId('grid-card')
    await user.click(gridCards[1]) // click the pdf doc (id=2)

    expect(mockNavigate).toHaveBeenCalledWith('/documents/2')
  })
})

// ===========================================================================
// DocumentListToolbar - View Toggle Tests
// ===========================================================================
describe('DocumentListToolbar - view toggle', () => {
  let DocumentListToolbar: any

  beforeEach(async () => {
    vi.clearAllMocks()
    const mod = await import('../document-list-toolbar')
    DocumentListToolbar = mod.DocumentListToolbar
  })

  it('renders list and grid view toggle buttons', () => {
    render(<DocumentListToolbar sortBy="name" onSortChange={vi.fn()} viewMode="list" onViewModeChange={vi.fn()} />)

    expect(screen.getByRole('button', { name: /list view/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /grid view/i })).toBeInTheDocument()
  })

  it('calls onViewModeChange("grid") when grid button is clicked', async () => {
    const user = userEvent.setup()
    const onViewModeChange = vi.fn()
    render(
      <DocumentListToolbar sortBy="name" onSortChange={vi.fn()} viewMode="list" onViewModeChange={onViewModeChange} />,
    )

    const gridBtn = screen.getByRole('button', { name: /grid view/i })
    await user.click(gridBtn)

    expect(onViewModeChange).toHaveBeenCalledWith('grid')
  })

  it('sets active button variant to "outline" and inactive to "ghost"', () => {
    const { rerender } = render(
      <DocumentListToolbar sortBy="name" onSortChange={vi.fn()} viewMode="list" onViewModeChange={vi.fn()} />,
    )

    const listBtn = screen.getByRole('button', { name: /list view/i })
    const gridBtn = screen.getByRole('button', { name: /grid view/i })

    // list mode active: list=outline, grid=ghost
    expect(listBtn).toHaveAttribute('data-variant', 'outline')
    expect(gridBtn).toHaveAttribute('data-variant', 'ghost')

    // Switch to grid mode
    rerender(<DocumentListToolbar sortBy="name" onSortChange={vi.fn()} viewMode="grid" onViewModeChange={vi.fn()} />)

    const listBtn2 = screen.getByRole('button', { name: /list view/i })
    const gridBtn2 = screen.getByRole('button', { name: /grid view/i })

    expect(listBtn2).toHaveAttribute('data-variant', 'ghost')
    expect(gridBtn2).toHaveAttribute('data-variant', 'outline')
  })
})
