import { useState, useMemo } from 'react'
import { Check } from 'lucide-react'
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
import type { TagCloudItemDto } from '@shared/types'

interface TagFilterDropdownProps {
  selectedTagIds: number[]
  tagCloud: TagCloudItemDto[]
  onSelectionChange: (tagIds: number[]) => void
}

export function TagFilterDropdown({ selectedTagIds, tagCloud, onSelectionChange }: TagFilterDropdownProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedSet = useMemo(() => new Set(selectedTagIds), [selectedTagIds])

  const filteredTags = useMemo(() => {
    if (!search.trim()) return tagCloud
    const lower = search.toLowerCase()
    return tagCloud.filter((t) => t.name.toLowerCase().includes(lower))
  }, [tagCloud, search])

  const handleToggle = (tagId: number) => {
    if (selectedSet.has(tagId)) {
      onSelectionChange(selectedTagIds.filter((id) => id !== tagId))
    } else {
      onSelectionChange([...selectedTagIds, tagId])
    }
  }

  const label = selectedTagIds.length > 0 ? `Tags (${selectedTagIds.length})` : 'Tags'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" aria-label="Filter by tags">
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search tags..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No tags found.</CommandEmpty>
            <CommandGroup>
              {filteredTags.map((tag) => (
                <CommandItem key={tag.id} value={tag.name} onSelect={() => handleToggle(tag.id)}>
                  <Check className={`mr-2 h-4 w-4 ${selectedSet.has(tag.id) ? 'opacity-100' : 'opacity-0'}`} />
                  <span
                    className="mr-2 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color || '#6b7280' }}
                  />
                  <span className="flex-1">{tag.name}</span>
                  <span className="text-xs text-muted-foreground">{tag.document_count}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
