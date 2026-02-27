import { useState, useEffect, useRef } from 'react'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { Search, Play, Pause } from 'lucide-react'
import type { LogFilterInput, LogDateRange } from '@shared/types'

interface LogFiltersToolbarProps {
  filters: LogFilterInput
  onFiltersChange: (filters: LogFilterInput) => void
  autoScroll: boolean
  onAutoScrollChange: (enabled: boolean) => void
}

const levels = ['error', 'warn', 'info', 'debug'] as const

const categories = [
  { label: 'All', value: '' },
  { label: 'App', value: 'app' },
  { label: 'Document', value: 'document' },
  { label: 'AI', value: 'ai' },
  { label: 'Quiz', value: 'quiz' },
]

const datePresets: Array<{ label: string; value: LogDateRange | 'all' }> = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
]

/** Filter toolbar for the log viewer with level pills, search, category, date presets, and auto-scroll. */
export function LogFiltersToolbar({
  filters,
  onFiltersChange,
  autoScroll,
  onAutoScrollChange,
}: LogFiltersToolbarProps) {
  const handleLevelToggle = (level: string) => {
    onFiltersChange({
      ...filters,
      level: filters.level === level ? undefined : level,
    })
  }

  const handleCategoryChange = (value: string) => {
    onFiltersChange({
      ...filters,
      category: value && value !== 'all' ? value : undefined,
    })
  }

  // Debounced search: local state updates immediately, filter propagates after 300ms
  const [searchValue, setSearchValue] = useState(filters.search ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Sync local search state when parent filter changes (e.g. clear all filters)
  const [prevSearch, setPrevSearch] = useState(filters.search)
  if (prevSearch !== filters.search) {
    setPrevSearch(filters.search)
    setSearchValue(filters.search ?? '')
  }

  useEffect(() => {
    return () => clearTimeout(debounceRef.current)
  }, [])

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchValue(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onFiltersChange({ ...filters, search: value })
    }, 300)
  }

  const handleDateRangeChange = (value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: value as LogDateRange,
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Level toggle pills */}
      {levels.map((level) => (
        <Button
          key={level}
          variant={filters.level === level ? 'default' : 'outline'}
          size="xs"
          onClick={() => handleLevelToggle(level)}
          aria-pressed={filters.level === level}
        >
          {level}
        </Button>
      ))}

      {/* Category select */}
      <Select value={filters.category ?? ''} onValueChange={handleCategoryChange}>
        <SelectTrigger className="w-[120px]" size="sm">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.value || 'all'} value={cat.value || 'all'}>
              {cat.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search input */}
      <div className="relative">
        <Search className="text-muted-foreground absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search logs..."
          value={searchValue}
          onChange={handleSearchChange}
          className="h-8 w-[200px] pl-8"
        />
      </div>

      {/* Date preset select */}
      <Select value={filters.dateRange ?? 'all'} onValueChange={handleDateRangeChange}>
        <SelectTrigger className="w-[140px]" size="sm">
          <SelectValue placeholder="Date range" />
        </SelectTrigger>
        <SelectContent>
          {datePresets.map((preset) => (
            <SelectItem key={preset.value} value={preset.value}>
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Auto-scroll toggle */}
      <Button
        variant="outline"
        size="xs"
        onClick={() => onAutoScrollChange(!autoScroll)}
        aria-label={autoScroll ? 'Pause auto-scroll' : 'Resume auto-scroll'}
      >
        {autoScroll ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
        <span
          className={`inline-block h-2 w-2 rounded-full ${autoScroll ? 'bg-green-500' : 'bg-gray-400'}`}
          aria-hidden="true"
        />
      </Button>
    </div>
  )
}
