import { useState, useMemo } from 'react'
import { Check, Plus } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@renderer/components/ui/command'
import { Button } from '@renderer/components/ui/button'
import { TagBadge } from '@renderer/components/tags/tag-badge'
import { CreateTagDialog } from '@renderer/components/tags/create-tag-dialog'
import type { TagDto } from '@shared/types'

interface TagSelectorProps {
  tags: TagDto[]
  allTags: TagDto[]
  onTagsChanged: (tagIds: number[]) => void
}

export function TagSelector({ tags, allTags, onTagsChanged }: TagSelectorProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createDialogInitialName, setCreateDialogInitialName] = useState('')

  const assignedIds = useMemo(() => new Set(tags.map((t) => t.id)), [tags])

  const filteredTags = useMemo(() => {
    if (!search.trim()) return allTags
    const lower = search.toLowerCase()
    return allTags.filter((t) => t.name.toLowerCase().includes(lower))
  }, [allTags, search])

  const exactMatch = useMemo(() => {
    if (!search.trim()) return true
    const lower = search.toLowerCase()
    return allTags.some((t) => t.name.toLowerCase() === lower)
  }, [allTags, search])

  const handleToggleTag = (tagId: number) => {
    if (assignedIds.has(tagId)) {
      onTagsChanged(tags.filter((t) => t.id !== tagId).map((t) => t.id))
    } else {
      onTagsChanged([...tags.map((t) => t.id), tagId])
    }
  }

  const handleRemoveTag = (tagId: number) => {
    onTagsChanged(tags.filter((t) => t.id !== tagId).map((t) => t.id))
  }

  const handleCreateClick = () => {
    setCreateDialogInitialName(search.trim())
    setCreateDialogOpen(true)
    setOpen(false)
  }

  const handleTagCreated = (newTag: TagDto) => {
    // Auto-assign the newly created tag
    onTagsChanged([...tags.map((t) => t.id), newTag.id])
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <TagBadge key={tag.id} tag={tag} onRemove={() => handleRemoveTag(tag.id)} />
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Add tag">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search tags..." value={search} onValueChange={setSearch} />
            <CommandList>
              <CommandEmpty>No tags found.</CommandEmpty>
              <CommandGroup heading="Existing Tags">
                {filteredTags.map((tag) => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => handleToggleTag(tag.id)}>
                    <Check className={`mr-2 h-4 w-4 ${assignedIds.has(tag.id) ? 'opacity-100' : 'opacity-0'}`} />
                    <span
                      className="mr-2 inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color || '#6b7280' }}
                    />
                    {tag.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {search.trim() && !exactMatch && (
                <CommandGroup>
                  <CommandItem onSelect={handleCreateClick}>
                    <Plus className="mr-2 h-4 w-4" />
                    Create &quot;{search.trim()}&quot;
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <CreateTagDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreated={handleTagCreated}
        initialName={createDialogInitialName}
      />
    </div>
  )
}
