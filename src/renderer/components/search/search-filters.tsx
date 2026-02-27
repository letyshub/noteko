import { X } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'
import type { ProjectDto, LogDateRange } from '@shared/types'

export interface SearchFilters {
  projectId?: number
  fileType?: string
  dateRange?: LogDateRange
}

interface SearchFiltersProps {
  filters: SearchFilters
  onFiltersChange: (filters: SearchFilters) => void
  projects: ProjectDto[]
}

const FILE_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
  { value: 'txt', label: 'TXT' },
  { value: 'csv', label: 'CSV' },
  { value: 'md', label: 'MD' },
  { value: 'images', label: 'Images' },
]

const DATE_RANGE_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
]

export function SearchFiltersBar({ filters, onFiltersChange, projects }: SearchFiltersProps) {
  const activeFilters: Array<{ key: keyof SearchFilters; label: string }> = []

  if (filters.projectId) {
    const project = projects.find((p) => p.id === filters.projectId)
    activeFilters.push({ key: 'projectId', label: `Project: ${project?.name ?? 'Unknown'}` })
  }
  if (filters.fileType) {
    const fileTypeOption = FILE_TYPE_OPTIONS.find((o) => o.value === filters.fileType)
    activeFilters.push({ key: 'fileType', label: `Type: ${fileTypeOption?.label ?? filters.fileType}` })
  }
  if (filters.dateRange && filters.dateRange !== 'all') {
    const dateOption = DATE_RANGE_OPTIONS.find((o) => o.value === filters.dateRange)
    activeFilters.push({ key: 'dateRange', label: `Date: ${dateOption?.label ?? filters.dateRange}` })
  }

  function removeFilter(key: keyof SearchFilters) {
    const next = { ...filters }
    delete next[key]
    onFiltersChange(next)
  }

  return (
    <div className="space-y-2 border-b px-3 pb-2">
      {/* Filter dropdowns */}
      <div className="flex items-center gap-2">
        {/* Project filter */}
        <Select
          value={filters.projectId?.toString() ?? 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              projectId: value === 'all' ? undefined : Number(value),
            })
          }
        >
          <SelectTrigger size="sm" className="w-[140px]">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.id} value={project.id.toString()}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* File type filter */}
        <Select
          value={filters.fileType ?? 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              fileType: value === 'all' ? undefined : value,
            })
          }
        >
          <SelectTrigger size="sm" className="w-[120px]">
            <SelectValue placeholder="File type" />
          </SelectTrigger>
          <SelectContent>
            {FILE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date range filter */}
        <Select
          value={filters.dateRange ?? 'all'}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              dateRange: value === 'all' ? undefined : (value as LogDateRange),
            })
          }
        >
          <SelectTrigger size="sm" className="w-[130px]">
            <SelectValue placeholder="Date range" />
          </SelectTrigger>
          <SelectContent>
            {DATE_RANGE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active filter badges */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeFilters.map(({ key, label }) => (
            <Badge key={key} variant="secondary" className="gap-1 pr-1">
              {label}
              <Button variant="ghost" size="icon-xs" className="size-4 rounded-full" onClick={() => removeFilter(key)}>
                <X className="size-3" />
                <span className="sr-only">Remove {label} filter</span>
              </Button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
