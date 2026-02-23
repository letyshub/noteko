import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TagDto } from '@shared/types'

// Mock the tag store
vi.mock('@renderer/store', () => ({
  useTagStore: vi.fn((selector) => {
    if (selector) {
      return selector({
        tags: [],
        tagCloud: [],
        loading: false,
        error: null,
        fetchTags: vi.fn(),
        fetchTagCloud: vi.fn(),
        createTag: mockCreateTag,
        updateTag: vi.fn(),
        deleteTag: vi.fn(),
        getDocumentTags: vi.fn(),
        setDocumentTags: vi.fn(),
        batchGetDocumentTags: vi.fn(),
      })
    }
    return {}
  }),
}))

const mockCreateTag = vi.fn()

const mockTag: TagDto = {
  id: 1,
  name: 'JavaScript',
  color: '#eab308',
  created_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TagBadge', () => {
  // Lazy import to allow mocks to settle
  async function importTagBadge() {
    const mod = await import('../tag-badge')
    return mod.TagBadge
  }

  it('renders colored dot and tag name in display-only mode (no X button)', async () => {
    const TagBadge = await importTagBadge()
    render(<TagBadge tag={mockTag} />)

    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    // Should NOT have a remove button in display-only mode
    expect(screen.queryByRole('button', { name: /remove/i })).not.toBeInTheDocument()
  })

  it('renders X remove button in editable mode and calls onRemove callback', async () => {
    const TagBadge = await importTagBadge()
    const onRemove = vi.fn()
    const user = userEvent.setup()

    render(<TagBadge tag={mockTag} onRemove={onRemove} />)

    expect(screen.getByText('JavaScript')).toBeInTheDocument()
    const removeButton = screen.getByRole('button', { name: /remove javascript/i })
    expect(removeButton).toBeInTheDocument()

    await user.click(removeButton)
    expect(onRemove).toHaveBeenCalledOnce()
  })
})

describe('CreateTagDialog', () => {
  async function importCreateTagDialog() {
    const mod = await import('../create-tag-dialog')
    return mod.CreateTagDialog
  }

  it('renders name input and 10 color preset buttons', async () => {
    const CreateTagDialog = await importCreateTagDialog()
    render(<CreateTagDialog open={true} onOpenChange={vi.fn()} />)

    // Should have a name input
    expect(screen.getByLabelText(/name/i)).toBeInTheDocument()

    // Should have 10 color preset buttons (circle buttons for color selection)
    const colorButtons = screen.getAllByRole('button').filter((btn) => {
      return btn.style.backgroundColor !== '' && btn.getAttribute('type') === 'button'
    })
    expect(colorButtons).toHaveLength(10)
  })
})
