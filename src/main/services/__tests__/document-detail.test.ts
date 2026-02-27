import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from '@main/database/schema'

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

// Mock getDb to return our test database instance
const mockGetDb = vi.fn()
vi.mock('@main/database/connection', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
}))

const createTables = (sqlite: Database.Database): void => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      parent_folder_id INTEGER REFERENCES folders(id),
      created_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS document_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id) UNIQUE,
      raw_text TEXT,
      summary TEXT,
      key_points TEXT,
      key_terms TEXT,
      summary_style TEXT,
      processed_at TEXT
    );
  `)
}

describe('getDocumentWithContent with project and folder names', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-doc-detail-test-'))
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

  it('should return project_name and folder_name when document exists', async () => {
    const { getDocumentWithContent } = await import('@main/services/document-service')

    // Create project
    const project = db
      .insert(schema.projects)
      .values({
        name: 'Biology 101',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning()
      .get()!

    // Create folder
    const folder = db
      .insert(schema.folders)
      .values({
        name: 'Chapter 1',
        project_id: project.id,
        created_at: new Date().toISOString(),
      })
      .returning()
      .get()!

    // Create document
    const doc = db
      .insert(schema.documents)
      .values({
        name: 'notes.pdf',
        file_path: '/files/notes.pdf',
        file_type: 'pdf',
        file_size: 2048,
        folder_id: folder.id,
        project_id: project.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .returning()
      .get()!

    const result = getDocumentWithContent(doc.id)

    expect(result).toBeDefined()
    expect(result!.document).toBeDefined()
    expect(result!.project_name).toBe('Biology 101')
    expect(result!.folder_name).toBe('Chapter 1')
  })

  it('should return undefined when document does not exist', async () => {
    const { getDocumentWithContent } = await import('@main/services/document-service')

    const result = getDocumentWithContent(9999)

    expect(result).toBeUndefined()
  })
})
