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

/**
 * Helper to create the prerequisite tables that `runMigrations` expects.
 * We create minimal versions matching the Drizzle schemas so that
 * migration guards (`tableExists`) find them.
 */
const createPrerequisiteTables = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      parent_folder_id INTEGER REFERENCES folders(id),
      created_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      folder_id INTEGER NOT NULL REFERENCES folders(id),
      project_id INTEGER NOT NULL REFERENCES projects(id),
      processing_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS document_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL UNIQUE REFERENCES documents(id),
      raw_text TEXT,
      summary TEXT,
      key_points TEXT,
      key_terms TEXT,
      summary_style TEXT,
      processed_at TEXT
    );
  `)
}

/**
 * Helper to insert a document + document_content row and return the content id.
 * Handles the foreign key chain: project -> folder -> document -> document_content.
 */
const insertDocumentContent = (
  db: Database.Database,
  rawText: string | null,
  summary: string | null = null,
): number => {
  // Ensure a project and folder exist (reuse id=1 if already present)
  const existingProject = db.prepare('SELECT id FROM projects WHERE id = 1').get()
  if (!existingProject) {
    db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (1, ?, ?, ?)').run(
      'Test Project',
      new Date().toISOString(),
      new Date().toISOString(),
    )
  }
  const existingFolder = db.prepare('SELECT id FROM folders WHERE id = 1').get()
  if (!existingFolder) {
    db.prepare('INSERT INTO folders (id, name, project_id, created_at) VALUES (1, ?, 1, ?)').run(
      'Test Folder',
      new Date().toISOString(),
    )
  }

  // Insert a document
  const docResult = db
    .prepare(
      'INSERT INTO documents (name, file_path, file_type, file_size, folder_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)',
    )
    .run('test.pdf', '/path/test.pdf', 'pdf', 1024, new Date().toISOString(), new Date().toISOString())

  const documentId = docResult.lastInsertRowid as number

  // Insert document_content
  const contentResult = db
    .prepare('INSERT INTO document_content (document_id, raw_text, summary) VALUES (?, ?, ?)')
    .run(documentId, rawText, summary)

  return contentResult.lastInsertRowid as number
}

describe('FTS5 migration and recent_searches', () => {
  let tmpDir: string
  let sqlite: Database.Database

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-fts5-'))
    const dbPath = path.join(tmpDir, 'test.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    // Disable foreign keys so we can insert test data without full referential integrity
    sqlite.pragma('foreign_keys = ON')
    createPrerequisiteTables(sqlite)
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('should create FTS5 virtual table via runMigrations', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Verify documents_fts exists in sqlite_master
    // FTS5 virtual tables appear with type='table' in sqlite_master
    const row = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='documents_fts'").get()
    expect(row).toBeDefined()
  })

  it('should fire INSERT trigger when document_content row is inserted', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    const contentId = insertDocumentContent(sqlite, 'Hello world full text', 'A summary')

    // Verify FTS5 table has the matching entry
    const ftsRow = sqlite
      .prepare('SELECT rowid, raw_text, summary FROM documents_fts WHERE rowid = ?')
      .get(contentId) as { rowid: number; raw_text: string; summary: string } | undefined

    expect(ftsRow).toBeDefined()
    expect(ftsRow!.raw_text).toBe('Hello world full text')
    expect(ftsRow!.summary).toBe('A summary')
  })

  it('should keep FTS5 in sync when document_content row is updated', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    const contentId = insertDocumentContent(sqlite, 'Original text', 'Original summary')

    // Update the document_content row (simulates summarization flow via onConflictDoUpdate)
    sqlite
      .prepare('UPDATE document_content SET raw_text = ?, summary = ? WHERE id = ?')
      .run('Updated text', 'Updated summary', contentId)

    // Verify FTS5 reflects the update (delete+insert pattern)
    const ftsRow = sqlite
      .prepare('SELECT rowid, raw_text, summary FROM documents_fts WHERE rowid = ?')
      .get(contentId) as { rowid: number; raw_text: string; summary: string } | undefined

    expect(ftsRow).toBeDefined()
    expect(ftsRow!.raw_text).toBe('Updated text')
    expect(ftsRow!.summary).toBe('Updated summary')

    // Verify there is exactly one FTS5 entry for this rowid (no duplicates)
    const count = sqlite.prepare('SELECT COUNT(*) as cnt FROM documents_fts WHERE rowid = ?').get(contentId) as {
      cnt: number
    }
    expect(count.cnt).toBe(1)
  })

  it('should remove FTS5 entry when document_content row is deleted', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    const contentId = insertDocumentContent(sqlite, 'Text to delete', 'Summary to delete')

    // Verify it exists first
    const before = sqlite.prepare('SELECT rowid FROM documents_fts WHERE rowid = ?').get(contentId)
    expect(before).not.toBeNull()

    // Delete the document_content row
    sqlite.prepare('DELETE FROM document_content WHERE id = ?').run(contentId)

    // Verify FTS5 entry is also removed
    const after = sqlite.prepare('SELECT rowid FROM documents_fts WHERE rowid = ?').get(contentId)
    expect(after).toBeUndefined()
  })

  it('should backfill FTS5 index from existing document_content rows', async () => {
    // Insert document_content rows BEFORE running migrations (simulates pre-existing data)
    const id1 = insertDocumentContent(sqlite, 'Existing backfill alpha', 'Summary one')
    const id2 = insertDocumentContent(sqlite, 'Existing backfill beta', null)
    // Insert one with null raw_text - should NOT be backfilled
    insertDocumentContent(sqlite, null, null)

    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Verify backfilled rows are searchable via FTS5 MATCH
    const matchAlpha = sqlite.prepare("SELECT rowid FROM documents_fts WHERE documents_fts MATCH 'alpha'").all()
    expect(matchAlpha).toHaveLength(1)
    expect((matchAlpha[0] as { rowid: number }).rowid).toBe(id1)

    const matchBeta = sqlite.prepare("SELECT rowid FROM documents_fts WHERE documents_fts MATCH 'beta'").all()
    expect(matchBeta).toHaveLength(1)
    expect((matchBeta[0] as { rowid: number }).rowid).toBe(id2)

    // Verify that searching for "backfill" returns exactly 2 results (not 3 - null raw_text excluded)
    const matchAll = sqlite.prepare("SELECT rowid FROM documents_fts WHERE documents_fts MATCH 'backfill'").all()
    expect(matchAll).toHaveLength(2)
  })

  it('should create recent_searches table and support basic CRUD', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Verify recent_searches table exists
    const tableRow = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='recent_searches'").get()
    expect(tableRow).not.toBeNull()

    // Insert search entries
    sqlite
      .prepare('INSERT INTO recent_searches (query, result_count, searched_at) VALUES (?, ?, ?)')
      .run('machine learning', 5, '2026-02-23T10:00:00.000Z')
    sqlite
      .prepare('INSERT INTO recent_searches (query, result_count, searched_at) VALUES (?, ?, ?)')
      .run('neural networks', 3, '2026-02-23T11:00:00.000Z')
    sqlite
      .prepare('INSERT INTO recent_searches (query, result_count, searched_at) VALUES (?, ?, ?)')
      .run('deep learning', 0, '2026-02-23T09:00:00.000Z')

    // Select ordered by searched_at DESC (most recent first)
    const rows = sqlite.prepare('SELECT * FROM recent_searches ORDER BY searched_at DESC').all() as Array<{
      id: number
      query: string
      result_count: number
      searched_at: string
    }>

    expect(rows).toHaveLength(3)
    expect(rows[0].query).toBe('neural networks') // most recent
    expect(rows[1].query).toBe('machine learning')
    expect(rows[2].query).toBe('deep learning') // oldest

    // Verify default result_count works
    sqlite
      .prepare('INSERT INTO recent_searches (query, searched_at) VALUES (?, ?)')
      .run('test query', '2026-02-23T12:00:00.000Z')
    const defaultRow = sqlite.prepare('SELECT result_count FROM recent_searches WHERE query = ?').get('test query') as {
      result_count: number
    }
    expect(defaultRow.result_count).toBe(0)
  })
})
