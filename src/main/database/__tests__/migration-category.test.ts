import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

// Mock electron and electron-log (required by connection module)
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue(os.tmpdir()),
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

vi.mock('@main/database/connection', () => ({
  getDb: vi.fn(),
}))

describe('app_logs category column migration', () => {
  let tmpDir: string
  let sqlite: Database.Database

  /**
   * Helper that replicates the migration logic from connection.ts
   * for the app_logs.category column.
   */
  const runCategoryMigration = (db: Database.Database): void => {
    const tableExists = (table: string): boolean => {
      const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table) as unknown
      return row != null
    }

    const hasColumn = (table: string, column: string): boolean => {
      const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>
      return cols.some((c) => c.name === column)
    }

    if (tableExists('app_logs')) {
      if (!hasColumn('app_logs', 'category')) {
        db.exec('ALTER TABLE app_logs ADD COLUMN category TEXT')
      }
    }
  }

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-migration-category-'))
    const dbPath = path.join(tmpDir, 'test.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should have category column on a fresh database that includes it in CREATE TABLE', () => {
    // Simulate a fresh database where the CREATE TABLE already includes category
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

    const cols = sqlite.pragma('table_info(app_logs)') as Array<{ name: string }>
    const colNames = cols.map((c) => c.name)
    expect(colNames).toContain('category')
  })

  it('should add category column via ALTER TABLE on an existing database without it', () => {
    // Create table WITHOUT category column (simulates pre-migration database)
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS app_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );
    `)

    // Verify column does not exist yet
    const colsBefore = sqlite.pragma('table_info(app_logs)') as Array<{ name: string }>
    expect(colsBefore.map((c) => c.name)).not.toContain('category')

    // Run migration
    runCategoryMigration(sqlite)

    // Verify column now exists
    const colsAfter = sqlite.pragma('table_info(app_logs)') as Array<{ name: string }>
    expect(colsAfter.map((c) => c.name)).toContain('category')
  })

  it('should be idempotent - running migration twice does not error', () => {
    // Create table WITHOUT category column
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS app_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        level TEXT NOT NULL,
        message TEXT NOT NULL,
        context TEXT,
        created_at TEXT NOT NULL
      );
    `)

    // Run migration twice - second run should be a no-op
    runCategoryMigration(sqlite)
    runCategoryMigration(sqlite)

    const cols = sqlite.pragma('table_info(app_logs)') as Array<{ name: string }>
    const categoryCount = cols.filter((c) => c.name === 'category').length
    expect(categoryCount).toBe(1)
  })

  it('should allow inserting and retrieving a row with category value', () => {
    // Create table with category column
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

    // Insert a row with category
    sqlite
      .prepare('INSERT INTO app_logs (level, message, category, created_at) VALUES (?, ?, ?, ?)')
      .run('info', 'Test message', 'app', '2026-02-23T00:00:00.000Z')

    // Retrieve and verify
    const row = sqlite.prepare('SELECT * FROM app_logs WHERE id = 1').get() as Record<string, unknown>
    expect(row.category).toBe('app')
    expect(row.level).toBe('info')
    expect(row.message).toBe('Test message')
  })
})
