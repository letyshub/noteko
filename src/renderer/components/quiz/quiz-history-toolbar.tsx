import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@renderer/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@renderer/components/ui/dropdown-menu'
import type { QuizHistorySortField } from '@renderer/lib/score-utils'

interface QuizHistoryToolbarProps {
  sortField: QuizHistorySortField
  sortDirection: 'asc' | 'desc'
  onSortFieldChange: (field: QuizHistorySortField) => void
  onSortDirectionChange: (direction: 'asc' | 'desc') => void
}

const sortLabels: Record<QuizHistorySortField, string> = {
  date: 'Date',
  score: 'Score',
  quizName: 'Quiz Name',
  documentName: 'Document Name',
}

/** Sort toolbar for the quiz history list. */
export function QuizHistoryToolbar({
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
}: QuizHistoryToolbarProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Sort field dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" aria-label="Sort quiz history">
            <ArrowUpDown className="mr-1.5 h-4 w-4" />
            {sortLabels[sortField]}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.entries(sortLabels) as [QuizHistorySortField, string][]).map(([field, label]) => (
            <DropdownMenuItem
              key={field}
              onClick={() => onSortFieldChange(field)}
              className={sortField === field ? 'font-semibold' : ''}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Sort direction toggle */}
      <Button
        variant="outline"
        size="icon"
        aria-label={sortDirection === 'asc' ? 'Sort ascending' : 'Sort descending'}
        onClick={() => onSortDirectionChange(sortDirection === 'asc' ? 'desc' : 'asc')}
      >
        {sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
      </Button>
    </div>
  )
}
