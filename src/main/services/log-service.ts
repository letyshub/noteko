/**
 * Log service for querying and managing application logs.
 *
 * Provides paginated log listing with server-side filtering,
 * aggregate statistics, and log cleanup.
 */

import { eq, count, desc, like, sql, and, gte } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { appLogs } from '@main/database/schema'
import type { LogFilterInput, LogListResultDto, LogStatisticsDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default number of log entries per page. */
const DEFAULT_LIMIT = 100

/** Map of known message prefixes to log categories. */
export const CATEGORY_PREFIX_MAP: Record<string, string> = {
  ai: 'ai',
  startup: 'app',
  'noteko-file': 'document',
  migration: 'app',
  'parsing-service': 'document',
  'ollama-service': 'ai',
  'quiz-generation': 'quiz',
  'chunking-service': 'ai',
  global: 'app',
  renderer: 'app',
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * List logs with server-side filtering and pagination.
 *
 * ALL filters (level, category, search, dateRange) are applied server-side
 * since pagination means only `limit` rows are returned at a time.
 */
export const listLogs = (filter: LogFilterInput): LogListResultDto => {
  const db = getDb()
  const page = filter.page ?? 1
  const limit = filter.limit ?? DEFAULT_LIMIT
  const offset = (page - 1) * limit

  // Build WHERE conditions
  const conditions = []

  if (filter.level) {
    conditions.push(eq(appLogs.level, filter.level))
  }

  if (filter.category) {
    conditions.push(eq(appLogs.category, filter.category))
  }

  if (filter.search) {
    conditions.push(like(appLogs.message, `%${filter.search}%`))
  }

  if (filter.dateRange && filter.dateRange !== 'all') {
    const now = new Date()
    let cutoff: Date

    switch (filter.dateRange) {
      case '24h':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000)
        break
      case '7d':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        break
      case '30d':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        break
    }

    conditions.push(gte(appLogs.created_at, cutoff!.toISOString()))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Count total matching rows
  const totalRow = db
    .select({ value: count(appLogs.id) })
    .from(appLogs)
    .where(whereClause)
    .get()
  const total = totalRow?.value ?? 0

  // Query paginated results
  const logs = db
    .select({
      id: appLogs.id,
      level: appLogs.level,
      message: appLogs.message,
      category: appLogs.category,
      context: appLogs.context,
      created_at: appLogs.created_at,
    })
    .from(appLogs)
    .where(whereClause)
    .orderBy(desc(appLogs.created_at))
    .limit(limit)
    .offset(offset)
    .all()

  return {
    logs,
    total,
    hasMore: offset + limit < total,
  }
}

/**
 * Get aggregate log statistics: total count, per-level counts, and error trend.
 */
export const getLogStatistics = (): LogStatisticsDto => {
  const db = getDb()

  // Total count
  const totalRow = db
    .select({ value: count(appLogs.id) })
    .from(appLogs)
    .get()
  const total = totalRow?.value ?? 0

  // Per-level counts
  const errorRow = db
    .select({ value: count(appLogs.id) })
    .from(appLogs)
    .where(eq(appLogs.level, 'error'))
    .get()
  const errors = errorRow?.value ?? 0

  const warnRow = db
    .select({ value: count(appLogs.id) })
    .from(appLogs)
    .where(eq(appLogs.level, 'warn'))
    .get()
  const warnings = warnRow?.value ?? 0

  const infoRow = db
    .select({ value: count(appLogs.id) })
    .from(appLogs)
    .where(eq(appLogs.level, 'info'))
    .get()
  const infos = infoRow?.value ?? 0

  const debugRow = db
    .select({ value: count(appLogs.id) })
    .from(appLogs)
    .where(eq(appLogs.level, 'debug'))
    .get()
  const debugs = debugRow?.value ?? 0

  // Error trend: count errors grouped by date for last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const trendRows = db
    .select({
      date: sql<string>`substr(${appLogs.created_at}, 1, 10)`,
      errorCount: count(appLogs.id),
    })
    .from(appLogs)
    .where(and(eq(appLogs.level, 'error'), gte(appLogs.created_at, thirtyDaysAgo)))
    .groupBy(sql`substr(${appLogs.created_at}, 1, 10)`)
    .orderBy(sql`substr(${appLogs.created_at}, 1, 10)`)
    .all()

  const trend = trendRows.map((row) => ({
    date: row.date,
    errorCount: row.errorCount,
  }))

  return { total, errors, warnings, infos, debugs, trend }
}

/**
 * Delete all rows from the app_logs table.
 */
export const clearLogs = (): void => {
  getDb().delete(appLogs).run()
}

/**
 * Parse a log message to extract its category based on the prefix pattern `[prefix]`.
 * Returns the mapped category or 'app' as default.
 */
export const parseCategory = (message: string): string => {
  const match = message.match(/^\[([^\]]+)\]/)
  if (match) {
    const prefix = match[1].toLowerCase()
    return CATEGORY_PREFIX_MAP[prefix] ?? 'app'
  }
  return 'app'
}
