import { ArrowUpDown } from 'lucide-react'
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
}

const sortLabels: Record<SortField, string> = {
  name: 'Name',
  date: 'Date',
  size: 'Size',
  type: 'Type',
}

export function DocumentListToolbar({ sortBy, onSortChange }: DocumentListToolbarProps) {
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
    </div>
  )
}
