import { ArrowUpDown, LayoutGrid, List } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'

export type SortField = 'name' | 'date' | 'size' | 'type'

interface DocumentListToolbarProps {
  sortBy: SortField
  onSortChange: (field: SortField) => void
  viewMode?: 'list' | 'grid'
  onViewModeChange?: (mode: 'list' | 'grid') => void
}

const sortLabels: Record<SortField, string> = {
  name: 'Name',
  date: 'Date',
  size: 'Size',
  type: 'Type',
}

export function DocumentListToolbar({
  sortBy,
  onSortChange,
  viewMode = 'list',
  onViewModeChange,
}: DocumentListToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Sort dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Sort documents">
            <ArrowUpDown className="mr-1.5 h-4 w-4" />
            {sortLabels[sortBy]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.entries(sortLabels) as [SortField, string][]).map(([field, label]) => (
            <DropdownMenuItem
              key={field}
              onClick={() => onSortChange(field)}
              className={sortBy === field ? 'font-semibold' : ''}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* View mode toggle */}
      {onViewModeChange && (
        <>
          <Button
            variant={viewMode === 'list' ? 'outline' : 'ghost'}
            size="icon"
            aria-label="List view"
            aria-pressed={viewMode === 'list'}
            onClick={() => onViewModeChange('list')}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'outline' : 'ghost'}
            size="icon"
            aria-label="Grid view"
            aria-pressed={viewMode === 'grid'}
            onClick={() => onViewModeChange('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </>
      )}
    </div>
  )
}
