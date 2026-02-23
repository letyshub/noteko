/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TagDto, TagCloudItemDto, DocumentDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Mock electronAPI
// ---------------------------------------------------------------------------
const mockElectronAPI: Record<string, any> = {
  on: vi.fn(() => vi.fn()),
  off: vi.fn(),
  'db:documents:by-tags': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:document-tags:batch-get': vi.fn().mockResolvedValue({ success: true, data: {} }),
  'db:tags:list': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:tags:cloud': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:tags:create': vi
    .fn()
    .mockResolvedValue({ success: true, data: { id: 99, name: 'New', color: '#3b82f6', created_at: '2026-01-01' } }),
  'db:tags:update': vi.fn().mockResolvedValue({ success: true, data: {} }),
  'db:tags:delete': vi.fn().mockResolvedValue({ success: true }),
  'db:document-tags:get': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:document-tags:set': vi.fn().mockResolvedValue({ success: true }),
  'db:projects:list': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:folders:list': vi
    .fn()
    .mockResolvedValue({
      success: true,
      data: [{ id: 1, name: 'Root', project_id: 1, parent_folder_id: null, created_at: '2026-01-01' }],
    }),
  'db:documents:list-by-project': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:documents:list-by-folder': vi.fn().mockResolvedValue({ success: true, data: [] }),
  'db:documents:delete': vi.fn().mockResolvedValue({ success: true }),
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
  useLocation: () => ({ pathname: '/projects/1' }),
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
  badgeVariants: () => '',
}))

vi.mock('@renderer/components/ui/button', () => ({
  Button: ({ children, variant, size, ...props }: any) => (
    <button data-variant={variant} data-size={size} {...props}>
      {children}
    </button>
  ),
}))

vi.mock('@renderer/components/ui/popover', () => ({
  Popover: ({ children, open, onOpenChange, ...props }: any) => (
    <div data-testid="popover" data-open={open} {...props}>
      {typeof onOpenChange === 'function' ? children : children}
    </div>
  ),
  PopoverTrigger: ({ children, ...props }: any) => (
    <div data-testid="popover-trigger" {...props}>
      {children}
    </div>
  ),
  PopoverContent: ({ children, ...props }: any) => (
    <div data-testid="popover-content" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/command', () => ({
  Command: ({ children, shouldFilter, ...props }: any) => (
    <div data-testid="command" data-should-filter={shouldFilter} {...props}>
      {children}
    </div>
  ),
  CommandInput: ({ placeholder, value, onValueChange, ...props }: any) => (
    <input
      data-testid="command-input"
      placeholder={placeholder}
      value={value ?? ''}
      onChange={(e: any) => onValueChange?.(e.target.value)}
      {...props}
    />
  ),
  CommandList: ({ children, ...props }: any) => (
    <div data-testid="command-list" {...props}>
      {children}
    </div>
  ),
  CommandEmpty: ({ children, ...props }: any) => (
    <div data-testid="command-empty" {...props}>
      {children}
    </div>
  ),
  CommandGroup: ({ children, heading, ...props }: any) => (
    <div data-testid="command-group" data-heading={heading} {...props}>
      {heading && <div data-testid="command-group-heading">{heading}</div>}
      {children}
    </div>
  ),
  CommandItem: ({ children, onSelect, ...props }: any) => (
    <div data-testid="command-item" role="option" onClick={onSelect} {...props}>
      {children}
    </div>
  ),
  CommandSeparator: () => <hr data-testid="command-separator" />,
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
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('@renderer/components/ui/separator', () => ({
  Separator: () => <hr data-testid="separator" />,
}))

vi.mock('@renderer/components/ui/scroll-area', () => ({
  ScrollArea: ({ children, ...props }: any) => (
    <div data-testid="scroll-area" {...props}>
      {children}
    </div>
  ),
}))

vi.mock('@renderer/components/ui/sidebar', () => ({
  Sidebar: ({ children, ...props }: any) => (
    <div data-testid="sidebar" {...props}>
      {children}
    </div>
  ),
  SidebarContent: ({ children }: any) => <div data-testid="sidebar-content">{children}</div>,
  SidebarFooter: ({ children }: any) => <div data-testid="sidebar-footer">{children}</div>,
  SidebarGroup: ({ children }: any) => <div data-testid="sidebar-group">{children}</div>,
  SidebarGroupAction: ({ children, ...props }: any) => (
    <button data-testid="sidebar-group-action" {...props}>
      {children}
    </button>
  ),
  SidebarGroupLabel: ({ children }: any) => <div data-testid="sidebar-group-label">{children}</div>,
  SidebarHeader: ({ children }: any) => <div data-testid="sidebar-header">{children}</div>,
  SidebarMenu: ({ children }: any) => <div data-testid="sidebar-menu">{children}</div>,
  SidebarMenuAction: ({ children, ...props }: any) => (
    <div data-testid="sidebar-menu-action" {...props}>
      {children}
    </div>
  ),
  SidebarMenuButton: ({ children, ...props }: any) => (
    <button data-testid="sidebar-menu-button" {...props}>
      {children}
    </button>
  ),
  SidebarMenuItem: ({ children }: any) => <div data-testid="sidebar-menu-item">{children}</div>,
  SidebarRail: () => <div data-testid="sidebar-rail" />,
}))

vi.mock('@renderer/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children, open }: any) => (open ? <div data-testid="alert-dialog">{children}</div> : null),
  AlertDialogAction: ({ children, onClick, ...props }: any) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
  AlertDialogCancel: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  AlertDialogContent: ({ children }: any) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: any) => <p>{children}</p>,
  AlertDialogFooter: ({ children }: any) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: any) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: any) => <h2>{children}</h2>,
}))

vi.mock('@renderer/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => (open ? <div data-testid="dialog">{children}</div> : null),
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h2>{children}</h2>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
}))

vi.mock('@renderer/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

vi.mock('@renderer/components/ui/label', () => ({
  Label: ({ children, ...props }: any) => <label {...props}>{children}</label>,
}))

// ---------------------------------------------------------------------------
// Mock heavy project-page dependencies to isolate tag behavior
// ---------------------------------------------------------------------------
vi.mock('@renderer/components/folders/folder-tree', () => ({
  FolderTree: () => <div data-testid="folder-tree">Folder Tree</div>,
}))

vi.mock('@renderer/components/upload/drop-zone', () => ({
  DropZone: ({ children }: any) => <div data-testid="drop-zone">{children}</div>,
}))

vi.mock('@renderer/components/upload/upload-progress', () => ({
  UploadProgress: () => <div data-testid="upload-progress" />,
}))

vi.mock('@renderer/components/folders/create-folder-dialog', () => ({
  CreateFolderDialog: () => null,
}))

vi.mock('@renderer/components/projects/edit-project-dialog', () => ({
  EditProjectDialog: () => null,
}))

vi.mock('@renderer/components/projects/delete-project-dialog', () => ({
  DeleteProjectDialog: () => null,
}))

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------
const tag1: TagDto = { id: 1, name: 'JavaScript', color: '#eab308', created_at: '2026-01-01T00:00:00Z' }
const tag2: TagDto = { id: 2, name: 'React', color: '#3b82f6', created_at: '2026-01-01T00:00:00Z' }
const tag3: TagDto = { id: 3, name: 'TypeScript', color: '#8b5cf6', created_at: '2026-01-01T00:00:00Z' }
const tag4: TagDto = { id: 4, name: 'CSS', color: '#22c55e', created_at: '2026-01-01T00:00:00Z' }
const tag5: TagDto = { id: 5, name: 'Node.js', color: '#14b8a6', created_at: '2026-01-01T00:00:00Z' }

const tagCloud: TagCloudItemDto[] = [
  { id: 1, name: 'JavaScript', color: '#eab308', document_count: 5 },
  { id: 2, name: 'React', color: '#3b82f6', document_count: 3 },
  { id: 3, name: 'TypeScript', color: '#8b5cf6', document_count: 7 },
]

const testDoc: DocumentDto = {
  id: 1,
  name: 'report.pdf',
  file_path: '/files/report.pdf',
  file_type: 'pdf',
  file_size: 1048576,
  folder_id: 1,
  project_id: 1,
  processing_status: 'completed',
  created_at: '2026-01-10T08:00:00Z',
  updated_at: '2026-01-10T08:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// Test 1: TagSelector renders current tags as removable badges and "+ Add"
// ===========================================================================
describe('TagSelector', () => {
  it('renders current tags as removable badges and a "+ Add" trigger button', async () => {
    const mod = await import('@renderer/components/tags/tag-selector')
    const TagSelector = mod.TagSelector
    const onTagsChanged = vi.fn()

    render(<TagSelector tags={[tag1, tag2]} allTags={[tag1, tag2, tag3]} onTagsChanged={onTagsChanged} />)

    // Should render tag badges for current tags (getAllByText since names appear in both badges and command items)
    const jsTexts = screen.getAllByText('JavaScript')
    expect(jsTexts.length).toBeGreaterThanOrEqual(1)

    const reactTexts = screen.getAllByText('React')
    expect(reactTexts.length).toBeGreaterThanOrEqual(1)

    // Should have remove buttons for each tag (these only exist on TagBadge, not in command items)
    expect(screen.getByRole('button', { name: /remove javascript/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove react/i })).toBeInTheDocument()

    // Should have "+ Add" button with the add tag label
    const addButton = screen.getByRole('button', { name: /add tag/i })
    expect(addButton).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 2: TagFilterDropdown renders tag checkboxes with counts and handles multi-select
// ===========================================================================
describe('TagFilterDropdown', () => {
  it('renders tag items with colored dots, names, and counts; toggling calls onSelectionChange', async () => {
    const mod = await import('@renderer/components/tags/tag-filter-dropdown')
    const TagFilterDropdown = mod.TagFilterDropdown
    const onSelectionChange = vi.fn()
    const user = userEvent.setup()

    render(<TagFilterDropdown selectedTagIds={[1]} tagCloud={tagCloud} onSelectionChange={onSelectionChange} />)

    // Should render trigger button showing active count
    expect(screen.getByText(/tags \(1\)/i)).toBeInTheDocument()

    // Should render tag names from the cloud
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()

    // Should show document counts
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()

    // Click on React (id=2) to add it to selection
    const reactItem = screen.getByText('React').closest('[data-testid="command-item"]')!
    await user.click(reactItem)

    // Should call onSelectionChange with both tags selected
    expect(onSelectionChange).toHaveBeenCalledWith([1, 2])
  })
})

// ===========================================================================
// Test 3: DocumentGridItem renders up to 3 TagBadge with "+N" overflow
// ===========================================================================
describe('DocumentGridItem - tag badges', () => {
  it('renders up to 3 tag badges with "+N" overflow when more exist', async () => {
    const mod = await import('@renderer/components/documents/document-grid-item')
    const DocumentGridItem = mod.DocumentGridItem

    const fiveTags = [tag1, tag2, tag3, tag4, tag5]

    render(<DocumentGridItem document={testDoc} onClick={vi.fn()} tags={fiveTags} />)

    // Should show exactly 3 tag names
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()

    // Should NOT show the 4th and 5th tag names
    expect(screen.queryByText('CSS')).not.toBeInTheDocument()
    expect(screen.queryByText('Node.js')).not.toBeInTheDocument()

    // Should show "+2" overflow badge
    expect(screen.getByText('+2')).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 4: TagSidebarSection renders tag cloud items with colored dots and counts
// ===========================================================================
describe('TagSidebarSection', () => {
  it('renders tag cloud items with colored dots, names, and document counts', async () => {
    const mod = await import('@renderer/components/tags/tag-sidebar-section')
    const TagSidebarSection = mod.TagSidebarSection

    render(<TagSidebarSection tagCloud={tagCloud} />)

    // Should have "Tags" group label
    expect(screen.getByText('Tags')).toBeInTheDocument()

    // Should render all tag cloud items
    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('TypeScript')).toBeInTheDocument()

    // Should render document counts
    expect(screen.getByText('5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
  })
})

// ===========================================================================
// Test 5: Project-page tag filter state calls listDocumentsByTags IPC
// ===========================================================================
describe('Project page - tag filter state', () => {
  it('calls listDocumentsByTags IPC when tags are selected', async () => {
    // Setup mocks
    const filteredDocs: DocumentDto[] = [testDoc]
    mockElectronAPI['db:documents:by-tags'].mockResolvedValue({ success: true, data: filteredDocs })
    mockElectronAPI['db:tags:cloud'].mockResolvedValue({ success: true, data: tagCloud })
    mockElectronAPI['db:document-tags:batch-get'].mockResolvedValue({ success: true, data: {} })

    // Set project in store
    const { useProjectStore } = await import('@renderer/store/project-store')
    useProjectStore.setState({
      projects: [
        {
          id: 1,
          name: 'Test Project',
          description: null,
          color: '#3b82f6',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    })

    const mod = await import('@renderer/pages/project-page')
    const ProjectPage = mod.ProjectPage

    render(<ProjectPage />)

    // Wait for the tag cloud to load and command items to appear
    const user = userEvent.setup()
    let jsItem: HTMLElement | undefined
    await vi.waitFor(() => {
      const tagItems = screen.getAllByTestId('command-item')
      jsItem = tagItems.find((item) => item.textContent?.includes('JavaScript'))
      expect(jsItem).toBeTruthy()
    })
    expect(jsItem).toBeTruthy()

    await user.click(jsItem!)

    // Verify IPC was called with the selected tag ID
    await vi.waitFor(() => {
      expect(mockElectronAPI['db:documents:by-tags']).toHaveBeenCalledWith([1])
    })
  })
})

// ===========================================================================
// Test 6: Active tag filter badges appear below toolbar and can be removed
// ===========================================================================
describe('Project page - active tag filter badges', () => {
  it('renders active tag filter badges that can be removed', async () => {
    mockElectronAPI['db:tags:cloud'].mockResolvedValue({ success: true, data: tagCloud })
    mockElectronAPI['db:documents:by-tags'].mockResolvedValue({ success: true, data: [testDoc] })
    mockElectronAPI['db:document-tags:batch-get'].mockResolvedValue({ success: true, data: {} })

    const { useProjectStore } = await import('@renderer/store/project-store')
    useProjectStore.setState({
      projects: [
        {
          id: 1,
          name: 'Test Project',
          description: null,
          color: '#3b82f6',
          created_at: '2026-01-01',
          updated_at: '2026-01-01',
        },
      ],
    })

    const mod = await import('@renderer/pages/project-page')
    const ProjectPage = mod.ProjectPage

    render(<ProjectPage />)

    // Wait for the tag cloud to load and command items to appear
    const user = userEvent.setup()
    let jsItem: HTMLElement | undefined
    await vi.waitFor(() => {
      const tagItems = screen.getAllByTestId('command-item')
      jsItem = tagItems.find((item) => item.textContent?.includes('JavaScript'))
      expect(jsItem).toBeTruthy()
    })

    await user.click(jsItem!)

    // Active filter badge should appear with "Filtered by:" text
    await vi.waitFor(() => {
      expect(screen.getByText('Filtered by:')).toBeInTheDocument()
    })

    // A remove button for the JavaScript filter should exist
    const removeButton = screen.getByRole('button', { name: /remove javascript filter/i })
    expect(removeButton).toBeInTheDocument()

    // Click the remove button to clear the tag filter
    await user.click(removeButton)

    // "Filtered by:" should disappear since no tags are selected
    await vi.waitFor(() => {
      expect(screen.queryByText('Filtered by:')).not.toBeInTheDocument()
    })
  })
})
