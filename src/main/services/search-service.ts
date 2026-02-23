/**
 * Search service for full-text document search and recent search history.
 *
 * Combines FTS5 content matching (with highlighted snippets) and
 * document name matching via LIKE. Results are merged, deduplicated,
 * and filtered by project, file type, and date range.
 */

import { eq, desc, count } from 'drizzle-orm'
import type Database from 'better-sqlite3'
import { getDb } from '@main/database/connection'
import { recentSearches } from '@main/database/schema'
import type { SearchFilterInput, SearchListResultDto, SearchResultDto, RecentSearchDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum number of search results returned per query. */
const MAX_RESULTS = 20

/** Maximum number of recent searches stored. */
const MAX_RECENT_SEARCHES = 10

/** File types that map to the "images" filter category. */
const IMAGE_FILE_TYPES = ['png', 'jpg', 'jpeg', 'gif']

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Get the underlying better-sqlite3 connection from the Drizzle instance.
 * Needed for raw FTS5 queries that cannot be expressed via the Drizzle query builder.
 */
const getRawDb = (): Database.Database => {
  const db = getDb()
  return (db as unknown as { session: { client: Database.Database } }).session.client
}

/**
 * Sanitize user input for FTS5 MATCH queries.
 *
 * Strips FTS5 operators and special characters, converts spaces to
 * implicit AND, and adds `*` suffix for prefix matching.
 */
const sanitizeFtsQuery = (query: string): string => {
  let sanitized = query
    // Remove double quotes
    .replace(/"/g, '')
    // Remove parentheses
    .replace(/[()]/g, '')
    // Remove wildcard operators
    .replace(/\*/g, '')

  // Remove FTS5 boolean operators (case-insensitive, whole-word only)
  sanitized = sanitized.replace(/\b(AND|OR|NOT|NEAR)\b/gi, '')

  // Collapse multiple spaces and trim
  sanitized = sanitized.replace(/\s+/g, ' ').trim()

  if (!sanitized) return ''

  // Convert to implicit AND with prefix matching:
  // "react hooks" → '"react"* AND "hooks"*'
  const terms = sanitized.split(' ').filter(Boolean)
  return terms.map((term) => `"${term}"*`).join(' AND ')
}

/**
 * Build date range cutoff ISO string from a LogDateRange value.
 */
const getDateCutoff = (dateRange: string): string | null => {
  const now = new Date()
  switch (dateRange) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Search documents by content (FTS5) and name (LIKE).
 *
 * Content matches come first (sorted by FTS5 rank), followed by
 * name-only matches. Results are deduplicated by document ID.
 */
export const searchDocuments = (filter: SearchFilterInput): SearchListResultDto => {
  const rawDb = getRawDb()
  const ftsQuery = sanitizeFtsQuery(filter.query)

  // Build shared filter SQL fragments
  const filterClauses: string[] = []
  const filterParams: unknown[] = []

  if (filter.projectId) {
    filterClauses.push('documents.project_id = ?')
    filterParams.push(filter.projectId)
  }

  if (filter.fileType) {
    if (filter.fileType === 'images') {
      const placeholders = IMAGE_FILE_TYPES.map(() => '?').join(', ')
      filterClauses.push(`documents.file_type IN (${placeholders})`)
      filterParams.push(...IMAGE_FILE_TYPES)
    } else {
      filterClauses.push('documents.file_type = ?')
      filterParams.push(filter.fileType)
    }
  }

  if (filter.dateRange && filter.dateRange !== 'all') {
    const cutoff = getDateCutoff(filter.dateRange)
    if (cutoff) {
      filterClauses.push('documents.created_at >= ?')
      filterParams.push(cutoff)
    }
  }

  const filterWhere = filterClauses.length > 0 ? ' AND ' + filterClauses.join(' AND ') : ''

  // ------ FTS5 content search ------
  const contentResults: SearchResultDto[] = []
  const contentDocIds = new Set<number>()

  if (ftsQuery) {
    const ftsSQL = `
      SELECT
        documents.id AS document_id,
        documents.name AS document_name,
        projects.name AS project_name,
        documents.file_type,
        snippet(documents_fts, 0, '<mark>', '</mark>', '...', 40) AS snippet,
        documents.created_at,
        documents.processing_status
      FROM documents_fts
      JOIN document_content ON document_content.id = documents_fts.rowid
      JOIN documents ON documents.id = document_content.document_id
      JOIN projects ON projects.id = documents.project_id
      WHERE documents_fts MATCH ?${filterWhere}
      ORDER BY rank
      LIMIT ?
    `

    try {
      const rows = rawDb.prepare(ftsSQL).all(ftsQuery, ...filterParams, MAX_RESULTS) as Array<Record<string, unknown>>

      for (const row of rows) {
        const docId = row.document_id as number
        contentDocIds.add(docId)
        contentResults.push({
          documentId: docId,
          documentName: row.document_name as string,
          projectName: row.project_name as string,
          fileType: row.file_type as string,
          snippet: (row.snippet as string) ?? null,
          createdAt: row.created_at as string,
          processingStatus: row.processing_status as SearchResultDto['processingStatus'],
          matchType: 'content',
        })
      }
    } catch {
      // FTS5 query failed (e.g., empty query after sanitization) — continue with name-only search
    }
  }

  // ------ Name-only search (LIKE) ------
  const nameResults: SearchResultDto[] = []
  const likePattern = `%${filter.query}%`
  const remainingLimit = MAX_RESULTS - contentResults.length

  if (remainingLimit > 0) {
    // Exclude documents already found via FTS5 content search
    const exclusionClause =
      contentDocIds.size > 0 ? ` AND documents.id NOT IN (${Array.from(contentDocIds).join(',')})` : ''

    const nameSQL = `
      SELECT
        documents.id AS document_id,
        documents.name AS document_name,
        projects.name AS project_name,
        documents.file_type,
        documents.created_at,
        documents.processing_status
      FROM documents
      JOIN projects ON projects.id = documents.project_id
      WHERE documents.name LIKE ?${exclusionClause}${filterWhere}
      LIMIT ?
    `

    try {
      const rows = rawDb.prepare(nameSQL).all(likePattern, ...filterParams, remainingLimit) as Array<
        Record<string, unknown>
      >

      for (const row of rows) {
        const docId = row.document_id as number
        if (!contentDocIds.has(docId)) {
          nameResults.push({
            documentId: docId,
            documentName: row.document_name as string,
            projectName: row.project_name as string,
            fileType: row.file_type as string,
            snippet: null,
            createdAt: row.created_at as string,
            processingStatus: row.processing_status as SearchResultDto['processingStatus'],
            matchType: 'name',
          })
        }
      }
    } catch {
      // Name query failed — return content results only
    }
  }

  // Merge: content matches first, then name-only matches
  const merged = [...contentResults, ...nameResults]
  const total = merged.length

  return {
    results: merged.slice(0, MAX_RESULTS),
    total,
    hasMore: total > MAX_RESULTS,
  }
}

/**
 * Save a recent search entry, enforcing max 10 entries.
 */
export const saveRecentSearch = (query: string, resultCount: number): void => {
  const db = getDb()

  db.insert(recentSearches)
    .values({
      query,
      result_count: resultCount,
      searched_at: new Date().toISOString(),
    })
    .run()

  // Enforce max entries: delete oldest beyond limit
  const totalRow = db
    .select({ value: count(recentSearches.id) })
    .from(recentSearches)
    .get()
  const total = totalRow?.value ?? 0

  if (total > MAX_RECENT_SEARCHES) {
    // Find the IDs to keep (most recent N)
    const idsToKeep = db
      .select({ id: recentSearches.id })
      .from(recentSearches)
      .orderBy(desc(recentSearches.searched_at))
      .limit(MAX_RECENT_SEARCHES)
      .all()
      .map((r) => r.id)

    // Delete everything not in the keep list using raw SQL for IN clause
    if (idsToKeep.length > 0) {
      const placeholders = idsToKeep.map(() => '?').join(', ')
      getRawDb()
        .prepare(`DELETE FROM recent_searches WHERE id NOT IN (${placeholders})`)
        .run(...idsToKeep)
    }
  }
}

/**
 * List recent searches ordered by searched_at DESC, max 10 entries.
 */
export const listRecentSearches = (): RecentSearchDto[] => {
  const db = getDb()

  return db
    .select({
      id: recentSearches.id,
      query: recentSearches.query,
      resultCount: recentSearches.result_count,
      searchedAt: recentSearches.searched_at,
    })
    .from(recentSearches)
    .orderBy(desc(recentSearches.searched_at))
    .limit(MAX_RECENT_SEARCHES)
    .all()
}

/**
 * Delete all recent search entries.
 */
export const clearRecentSearches = (): void => {
  getDb().delete(recentSearches).run()
}

/**
 * Delete a single recent search entry by ID.
 */
export const deleteRecentSearch = (id: number): void => {
  getDb().delete(recentSearches).where(eq(recentSearches.id, id)).run()
}
