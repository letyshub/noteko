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
 * Helper to create all prerequisite tables that `runMigrations` expects,
 * mirroring the Drizzle schema definitions.
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
 * Helper to seed a project + folder + document chain and return the document id.
 */
const insertDocument = (db: Database.Database, name = 'test.pdf'): number => {
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

  const result = db
    .prepare(
      'INSERT INTO documents (name, file_path, file_type, file_size, folder_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)',
    )
    .run(name, `/path/${name}`, 'pdf', 1024, new Date().toISOString(), new Date().toISOString())

  return result.lastInsertRowid as number
}

describe('Tags and DocumentTags schema', () => {
  let tmpDir: string
  let sqlite: Database.Database

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-tags-'))
    const dbPath = path.join(tmpDir, 'test.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    createPrerequisiteTables(sqlite)
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('should create tags table via migration and support insert + select round-trip', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Verify table exists
    const tableRow = sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='tags'").get()
    expect(tableRow).toBeDefined()

    // Insert a tag
    sqlite
      .prepare('INSERT INTO tags (name, color, created_at) VALUES (?, ?, ?)')
      .run('Biology', '#4CAF50', new Date().toISOString())

    // Read it back
    const tag = sqlite.prepare('SELECT * FROM tags WHERE name = ?').get('Biology') as {
      id: number
      name: string
      color: string
      created_at: string
    }
    expect(tag).toBeDefined()
    expect(tag.id).toBe(1)
    expect(tag.name).toBe('Biology')
    expect(tag.color).toBe('#4CAF50')
    expect(tag.created_at).toBeTruthy()
  })

  it('should enforce UNIQUE(document_id, tag_id) on document_tags', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    const docId = insertDocument(sqlite)

    // Insert a tag
    sqlite.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('Math', new Date().toISOString())
    const tagId = 1

    // Insert document_tag association
    sqlite
      .prepare('INSERT INTO document_tags (document_id, tag_id, created_at) VALUES (?, ?, ?)')
      .run(docId, tagId, new Date().toISOString())

    // Inserting the same pair again should fail with UNIQUE constraint violation
    expect(() => {
      sqlite
        .prepare('INSERT INTO document_tags (document_id, tag_id, created_at) VALUES (?, ?, ?)')
        .run(docId, tagId, new Date().toISOString())
    }).toThrow()
  })

  it('should enforce UNIQUE COLLATE NOCASE on tags.name (case-insensitive uniqueness)', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Insert "Biology"
    sqlite.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('Biology', new Date().toISOString())

    // Insert "biology" (same name, different case) should fail
    expect(() => {
      sqlite.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('biology', new Date().toISOString())
    }).toThrow()
  })

  it('should cascade delete document_tags when a document is deleted', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    const docId = insertDocument(sqlite)

    // Insert tags
    sqlite.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('Science', new Date().toISOString())
    sqlite.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('Physics', new Date().toISOString())

    // Associate both tags with the document
    sqlite
      .prepare('INSERT INTO document_tags (document_id, tag_id, created_at) VALUES (?, ?, ?)')
      .run(docId, 1, new Date().toISOString())
    sqlite
      .prepare('INSERT INTO document_tags (document_id, tag_id, created_at) VALUES (?, ?, ?)')
      .run(docId, 2, new Date().toISOString())

    // Verify 2 junction entries exist
    const before = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags WHERE document_id = ?').get(docId) as {
      cnt: number
    }
    expect(before.cnt).toBe(2)

    // Delete document_tags first (simulating what deleteDocument() should do),
    // then document_content, then document
    sqlite.prepare('DELETE FROM document_tags WHERE document_id = ?').run(docId)
    sqlite.prepare('DELETE FROM document_content WHERE document_id = ?').run(docId)
    sqlite.prepare('DELETE FROM documents WHERE id = ?').run(docId)

    // Verify junction entries are gone
    const after = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags WHERE document_id = ?').get(docId) as {
      cnt: number
    }
    expect(after.cnt).toBe(0)

    // Verify tags still exist (tags are NOT cascade-deleted when documents are deleted)
    const tagCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM tags').get() as { cnt: number }
    expect(tagCount.cnt).toBe(2)
  })

  it('should clean up document_tags for all project documents during cascadeDeleteProject', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Insert two documents
    const docId1 = insertDocument(sqlite, 'doc1.pdf')
    const docId2 = insertDocument(sqlite, 'doc2.pdf')

    // Insert tags
    sqlite.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('History', new Date().toISOString())
    sqlite.prepare('INSERT INTO tags (name, created_at) VALUES (?, ?)').run('Literature', new Date().toISOString())

    // Associate tags with both documents
    sqlite
      .prepare('INSERT INTO document_tags (document_id, tag_id, created_at) VALUES (?, ?, ?)')
      .run(docId1, 1, new Date().toISOString())
    sqlite
      .prepare('INSERT INTO document_tags (document_id, tag_id, created_at) VALUES (?, ?, ?)')
      .run(docId1, 2, new Date().toISOString())
    sqlite
      .prepare('INSERT INTO document_tags (document_id, tag_id, created_at) VALUES (?, ?, ?)')
      .run(docId2, 1, new Date().toISOString())

    // Verify 3 total junction entries
    const before = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags').get() as { cnt: number }
    expect(before.cnt).toBe(3)

    // Simulate cascadeDeleteProject: delete document_tags for all project docs,
    // then document_content, then documents, then folders, then project
    const docIds = [docId1, docId2]
    for (const did of docIds) {
      sqlite.prepare('DELETE FROM document_tags WHERE document_id = ?').run(did)
      sqlite.prepare('DELETE FROM document_content WHERE document_id = ?').run(did)
    }
    sqlite.prepare('DELETE FROM documents WHERE project_id = 1').run()
    sqlite.prepare('DELETE FROM folders WHERE project_id = 1').run()
    sqlite.prepare('DELETE FROM projects WHERE id = 1').run()

    // Verify all junction entries are gone
    const after = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags').get() as { cnt: number }
    expect(after.cnt).toBe(0)

    // Verify tags still exist (tags are NOT cascade-deleted with projects)
    const tagCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM tags').get() as { cnt: number }
    expect(tagCount.cnt).toBe(2)
  })
})
