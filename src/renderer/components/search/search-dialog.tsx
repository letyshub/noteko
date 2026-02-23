import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router'
import { Clock, Filter, SearchX } from 'lucide-react'
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from '@renderer/components/ui/command'
import { Button } from '@renderer/components/ui/button'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { SearchResultItem } from '@renderer/components/search/search-result-item'
import { SearchFiltersBar, type SearchFilters } from '@renderer/components/search/search-filters'
import type { SearchResultDto, RecentSearchDto, ProjectDto, SearchListResultDto } from '@shared/types'

interface SearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Format a relative date string from an ISO timestamp.
 */
function formatRelativeDate(isoDate: string): string {
  const now = Date.now()
  const date = new Date(isoDate).getTime()
  const diffMs = now - date

  const seconds = Math.floor(diffMs / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const weeks = Math.floor(days / 7)

  if (weeks > 0) return `${weeks}w ago`
  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'just now'
}

export function SearchDialog({ open, onOpenChange }: SearchDialogProps) {
  const navigate = useNavigate()

  // Internal state
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResultDto[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<RecentSearchDto[]>([])
  const [filters, setFilters] = useState<SearchFilters>({})
  const [showFilters, setShowFilters] = useState(false)
  const [projects, setProjects] = useState<ProjectDto[]>([])

  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // ---------------------------------------------------------------------------
  // Ctrl+K / Cmd+K global shortcut
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        onOpenChange(false)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [open, onOpenChange])

  // ---------------------------------------------------------------------------
  // Load recent searches and projects when dialog opens with empty query
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return

    // Reset state on open
    setQuery('')
    setResults([])
    setTotal(0)
    setIsLoading(false)
    setFilters({})
    setShowFilters(false)

    // Fetch recent searches
    window.electronAPI['db:search:recent-list']().then((result) => {
      if (result.success) {
        setRecentSearches(result.data)
      }
    })

    // Fetch projects for filters
    window.electronAPI['db:projects:list']().then((result) => {
      if (result.success) {
        setProjects(result.data)
      }
    })
  }, [open])

  // ---------------------------------------------------------------------------
  // Debounced search
  // ---------------------------------------------------------------------------
  const performSearch = useCallback(async (searchQuery: string, searchFilters: SearchFilters) => {
    if (searchQuery.length < 2) {
      setResults([])
      setTotal(0)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    try {
      const result = await window.electronAPI['db:documents:search']({
        query: searchQuery,
        projectId: searchFilters.projectId,
        fileType: searchFilters.fileType,
        dateRange: searchFilters.dateRange,
      })
      if (result.success) {
        const data = result.data as SearchListResultDto
        setResults(data.results)
        setTotal(data.total)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      clearTimeout(debounceRef.current)

      if (value.length < 2) {
        setResults([])
        setTotal(0)
        return
      }

      setIsLoading(true)
      debounceRef.current = setTimeout(() => {
        performSearch(value, filters)
      }, 300)
    },
    [filters, performSearch],
  )

  // Re-search when filters change (if query is active)
  useEffect(() => {
    if (query.length >= 2) {
      performSearch(query, filters)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters])

  // ---------------------------------------------------------------------------
  // Result selection
  // ---------------------------------------------------------------------------
  const handleResultSelect = useCallback(
    (result: SearchResultDto) => {
      // Save the search query
      window.electronAPI['db:search:recent-save'](query, total)
      // Navigate to document
      navigate(`/documents/${result.documentId}`)
      // Close dialog
      onOpenChange(false)
    },
    [query, total, navigate, onOpenChange],
  )

  // ---------------------------------------------------------------------------
  // Recent search selection
  // ---------------------------------------------------------------------------
  const handleRecentSearchSelect = useCallback(
    (recentQuery: string) => {
      setQuery(recentQuery)
      // Trigger search immediately
      clearTimeout(debounceRef.current)
      performSearch(recentQuery, filters)
    },
    [filters, performSearch],
  )

  // ---------------------------------------------------------------------------
  // Clear recent searches
  // ---------------------------------------------------------------------------
  const handleClearRecentSearches = useCallback(() => {
    window.electronAPI['db:search:recent-clear']().then((result) => {
      if (result.success) {
        setRecentSearches([])
      }
    })
  }, [])

  // ---------------------------------------------------------------------------
  // Determine what to show
  // ---------------------------------------------------------------------------
  const hasQuery = query.length >= 2
  const showRecentSearches = !hasQuery && recentSearches.length > 0
  const showResults = hasQuery && !isLoading && results.length > 0
  const showEmpty = hasQuery && !isLoading && results.length === 0

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Search Documents"
      description="Search across all your documents by content or name"
    >
      <CommandInput placeholder="Search documents..." value={query} onValueChange={handleQueryChange} />

      {/* Filter toggle and filter bar */}
      {hasQuery && (
        <div className="flex items-center justify-between border-b px-3 py-1.5">
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Searching...' : `${total} result${total !== 1 ? 's' : ''}`}
          </span>
          <Button variant="ghost" size="xs" onClick={() => setShowFilters(!showFilters)} className="gap-1">
            <Filter className="size-3" />
            Filters
          </Button>
        </div>
      )}

      {showFilters && <SearchFiltersBar filters={filters} onFiltersChange={setFilters} projects={projects} />}

      <CommandList>
        {/* Loading state */}
        {isLoading && (
          <div className="space-y-2 p-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        )}

        {/* Empty state (no results) */}
        {showEmpty && (
          <div className="flex flex-col items-center justify-center py-8">
            <SearchX className="size-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">No documents found</p>
            <p className="text-xs text-muted-foreground mt-1">Try different keywords or adjust your filters</p>
          </div>
        )}

        {/* Search results */}
        {showResults && (
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={result.documentId}
                value={`${result.documentName}-${result.documentId}`}
                onSelect={() => handleResultSelect(result)}
              >
                <SearchResultItem result={result} isSelected={false} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Recent searches */}
        {showRecentSearches && (
          <>
            <CommandGroup heading="Recent Searches">
              {recentSearches.map((recent) => (
                <CommandItem
                  key={recent.id}
                  value={`recent-${recent.query}`}
                  onSelect={() => handleRecentSearchSelect(recent.query)}
                >
                  <Clock className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{recent.query}</span>
                  <span className="text-xs text-muted-foreground">{formatRelativeDate(recent.searchedAt)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
            <div className="p-1">
              <Button
                variant="ghost"
                size="xs"
                className="w-full justify-center text-xs text-muted-foreground"
                onClick={handleClearRecentSearches}
              >
                Clear all recent searches
              </Button>
            </div>
          </>
        )}

        {/* No recent searches and no query */}
        {!hasQuery && recentSearches.length === 0 && (
          <CommandEmpty>Start typing to search your documents...</CommandEmpty>
        )}
      </CommandList>

      {/* Footer with keyboard hints */}
      <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-3">
          <span>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> Navigate
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">↵</kbd> Open
          </span>
          <span>
            <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Esc</kbd> Close
          </span>
        </div>
      </div>
    </CommandDialog>
  )
}
