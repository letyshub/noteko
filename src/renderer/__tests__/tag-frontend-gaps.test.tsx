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
// Test data
// ---------------------------------------------------------------------------
const tag1: TagDto = { id: 1, name: 'JavaScript', color: '#eab308', created_at: '2026-01-01T00:00:00Z' }
const tag2: TagDto = { id: 2, name: 'React', color: '#3b82f6', created_at: '2026-01-01T00:00:00Z' }
const tag3: TagDto = { id: 3, name: 'TypeScript', color: '#8b5cf6', created_at: '2026-01-01T00:00:00Z' }

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
// Test 1: TagFilterDropdown toggling OFF a selected tag deselects it
// ===========================================================================
describe('TagFilterDropdown - toggle off', () => {
  it('toggling a selected tag OFF calls onSelectionChange with that tag removed', async () => {
    const mod = await import('@renderer/components/tags/tag-filter-dropdown')
    const TagFilterDropdown = mod.TagFilterDropdown
    const onSelectionChange = vi.fn()
    const user = userEvent.setup()

    // Start with JavaScript (id=1) already selected
    render(<TagFilterDropdown selectedTagIds={[1]} tagCloud={tagCloud} onSelectionChange={onSelectionChange} />)

    // Click JavaScript item to toggle it OFF
    const jsItem = screen.getByText('JavaScript').closest('[data-testid="command-item"]')!
    await user.click(jsItem)

    // Should call onSelectionChange with empty array (JavaScript removed)
    expect(onSelectionChange).toHaveBeenCalledWith([])
  })
})

// ===========================================================================
// Test 2: TagFilterDropdown with no selection shows "Tags" without count
// ===========================================================================
describe('TagFilterDropdown - clear all filters', () => {
  it('renders "Tags" label without count when no tags are selected', async () => {
    const mod = await import('@renderer/components/tags/tag-filter-dropdown')
    const TagFilterDropdown = mod.TagFilterDropdown
    const onSelectionChange = vi.fn()

    render(<TagFilterDropdown selectedTagIds={[]} tagCloud={tagCloud} onSelectionChange={onSelectionChange} />)

    // Should show "Tags" without a count
    expect(screen.getByText('Tags')).toBeInTheDocument()
    // Should NOT show "Tags (N)" pattern
    expect(screen.queryByText(/tags \(\d+\)/i)).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Test 3: DocumentGridItem with zero tags renders no tag area
// ===========================================================================
describe('DocumentGridItem - zero tags', () => {
  it('renders no tag badges when tags prop is an empty array', async () => {
    const mod = await import('@renderer/components/documents/document-grid-item')
    const DocumentGridItem = mod.DocumentGridItem

    render(<DocumentGridItem document={testDoc} onClick={vi.fn()} tags={[]} />)

    // Document name should be present
    expect(screen.getByText('report.pdf')).toBeInTheDocument()

    // No tag badges or overflow indicators should exist
    expect(screen.queryByText('JavaScript')).not.toBeInTheDocument()
    expect(screen.queryByText('+1')).not.toBeInTheDocument()
    expect(screen.queryByText('+2')).not.toBeInTheDocument()
  })

  it('renders no tag badges when tags prop is undefined', async () => {
    const mod = await import('@renderer/components/documents/document-grid-item')
    const DocumentGridItem = mod.DocumentGridItem

    render(<DocumentGridItem document={testDoc} onClick={vi.fn()} />)

    // Document name should still render
    expect(screen.getByText('report.pdf')).toBeInTheDocument()

    // No tag area at all
    expect(screen.queryByText('JavaScript')).not.toBeInTheDocument()
  })
})

// ===========================================================================
// Test 4: TagSelector "Create" flow shows Create option with pre-filled name
// ===========================================================================
describe('TagSelector - Create flow', () => {
  it('shows "Create" option when search text has no exact match among existing tags', async () => {
    const mod = await import('@renderer/components/tags/tag-selector')
    const TagSelector = mod.TagSelector
    const onTagsChanged = vi.fn()
    const user = userEvent.setup()

    render(<TagSelector tags={[]} allTags={[tag1, tag2, tag3]} onTagsChanged={onTagsChanged} />)

    // Type a search term that does not match any existing tag
    const searchInput = screen.getByTestId('command-input')
    await user.type(searchInput, 'NewTag')

    // A "Create" command item should appear with the search text
    expect(screen.getByText(/create/i)).toBeInTheDocument()
    expect(screen.getByText(/"NewTag"/)).toBeInTheDocument()
  })
})
