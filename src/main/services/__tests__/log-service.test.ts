import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from '@main/database/schema'

// Mock electron and electron-log
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue(os.tmpdir()),
  },
  dialog: {
    showSaveDialog: vi.fn(),
  },
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

const mockGetDb = vi.fn()
vi.mock('@main/database/connection', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}))

const createTables = (sqlite: Database.Database): void => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      category TEXT,
      created_at TEXT NOT NULL
    );
  `)
}

/**
 * Seed the app_logs table with test data.
 * Creates logs across multiple levels, categories, and dates.
 */
const seedLogs = (db: BetterSQLite3Database<typeof schema>) => {
  const now = new Date()

  // Create 105 log entries to test pagination (100 per page)
  const entries: Array<{
    level: string
    message: string
    category: string | null
    created_at: string
  }> = []

  // 50 info logs from 'app' category spread across last 10 days
  for (let i = 0; i < 50; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - (i % 10))
    entries.push({
      level: 'info',
      message: `[startup] App started successfully #${i}`,
      category: 'app',
      created_at: date.toISOString(),
    })
  }

  // 30 error logs from 'ai' category within last 24 hours
  for (let i = 0; i < 30; i++) {
    const date = new Date(now)
    date.setHours(date.getHours() - i)
    entries.push({
      level: 'error',
      message: `[ollama-service] AI generation failed #${i}`,
      category: 'ai',
      created_at: date.toISOString(),
    })
  }

  // 15 warn logs from 'document' category within last 7 days
  for (let i = 0; i < 15; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - (i % 7))
    entries.push({
      level: 'warn',
      message: `[parsing-service] Document parse warning #${i}`,
      category: 'document',
      created_at: date.toISOString(),
    })
  }

  // 10 debug logs from 'quiz' category within last 30 days
  for (let i = 0; i < 10; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - i * 3)
    entries.push({
      level: 'debug',
      message: `[quiz-generation] Quiz debug info #${i}`,
      category: 'quiz',
      created_at: date.toISOString(),
    })
  }

  // Insert all entries
  for (const entry of entries) {
    db.insert(schema.appLogs)
      .values({
        level: entry.level,
        message: entry.message,
        category: entry.category,
        created_at: entry.created_at,
      })
      .run()
  }

  return { totalEntries: entries.length } // 105
}

describe('log-service', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-log-service-'))
    const dbPath = path.join(tmpDir, 'test.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    createTables(sqlite)
    db = drizzle(sqlite, { schema })
    mockGetDb.mockReturnValue(db)
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    mockGetDb.mockReset()
  })

  describe('listLogs', () => {
    it('should return paginated results with page 1 = 100 items and hasMore flag', async () => {
      const { listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      const result = listLogs({})
      expect(result.logs).toHaveLength(100)
      expect(result.total).toBe(105)
      expect(result.hasMore).toBe(true)
    })

    it('should filter by level server-side', async () => {
      const { listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      const result = listLogs({ level: 'error' })
      expect(result.total).toBe(30)
      expect(result.logs.length).toBeLessThanOrEqual(100)
      // Every returned log should be 'error'
      for (const log of result.logs) {
        expect(log.level).toBe('error')
      }
    })

    it('should filter by category server-side', async () => {
      const { listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      const result = listLogs({ category: 'document' })
      expect(result.total).toBe(15)
      for (const log of result.logs) {
        expect(log.category).toBe('document')
      }
    })

    it('should filter by search using LIKE on message column server-side', async () => {
      const { listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      const result = listLogs({ search: 'AI generation failed' })
      expect(result.total).toBe(30)
      for (const log of result.logs) {
        expect(log.message).toContain('AI generation failed')
      }
    })

    it('should apply combined filters (level + category + search) server-side', async () => {
      const { listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      // Filter: error level + ai category + specific search term
      const result = listLogs({ level: 'error', category: 'ai', search: 'failed #0' })
      // Only the single entry matching "AI generation failed #0" in ai+error
      expect(result.total).toBe(1)
      expect(result.logs).toHaveLength(1)
      expect(result.logs[0].level).toBe('error')
      expect(result.logs[0].category).toBe('ai')
      expect(result.logs[0].message).toContain('failed #0')
    })

    it('should return page 2 with correct offset', async () => {
      const { listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      const page1 = listLogs({ page: 1, limit: 100 })
      const page2 = listLogs({ page: 2, limit: 100 })

      expect(page1.logs).toHaveLength(100)
      expect(page1.hasMore).toBe(true)
      expect(page2.logs).toHaveLength(5) // 105 total - 100 on page 1
      expect(page2.hasMore).toBe(false)

      // Page 2 logs should be different from page 1
      const page1Ids = new Set(page1.logs.map((l) => l.id))
      for (const log of page2.logs) {
        expect(page1Ids.has(log.id)).toBe(false)
      }
    })

    it('should return empty results when no logs match filter', async () => {
      const { listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      const result = listLogs({ search: 'nonexistent-term-xyz' })
      expect(result.total).toBe(0)
      expect(result.logs).toHaveLength(0)
      expect(result.hasMore).toBe(false)
    })
  })

  describe('getLogStatistics', () => {
    it('should return correct aggregate counts per level and trend data', async () => {
      const { getLogStatistics } = await import('@main/services/log-service')
      seedLogs(db)

      const stats = getLogStatistics()
      expect(stats.total).toBe(105)
      expect(stats.errors).toBe(30)
      expect(stats.warnings).toBe(15)
      expect(stats.infos).toBe(50)
      expect(stats.debugs).toBe(10)
      // Trend should be an array of objects with date and errorCount
      expect(Array.isArray(stats.trend)).toBe(true)
      expect(stats.trend.length).toBeGreaterThan(0)
      // Each trend entry should have date and errorCount
      for (const entry of stats.trend) {
        expect(entry).toHaveProperty('date')
        expect(entry).toHaveProperty('errorCount')
        expect(typeof entry.date).toBe('string')
        expect(typeof entry.errorCount).toBe('number')
      }
    })
  })

  describe('clearLogs', () => {
    it('should remove all rows from app_logs', async () => {
      const { clearLogs, listLogs } = await import('@main/services/log-service')
      seedLogs(db)

      // Verify there are logs
      const before = listLogs({})
      expect(before.total).toBe(105)

      // Clear all logs
      clearLogs()

      // Verify logs are gone
      const after = listLogs({})
      expect(after.total).toBe(0)
      expect(after.logs).toHaveLength(0)
      expect(after.hasMore).toBe(false)
    })
  })
})
