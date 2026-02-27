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
const mockGetSqlite = vi.fn()
vi.mock('@main/database/connection', () => ({
  getDb: (...args: unknown[]) => mockGetDb(...args),
  getSqlite: (...args: unknown[]) => mockGetSqlite(...args),
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
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE COLLATE NOCASE,
      color TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS document_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      tag_id INTEGER NOT NULL REFERENCES tags(id),
      created_at TEXT NOT NULL,
      UNIQUE(document_id, tag_id)
    );
    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      question_count INTEGER,
      difficulty_level TEXT,
      question_types TEXT
    );
    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
      question TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      type TEXT,
      difficulty TEXT
    );
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      answers TEXT,
      completed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL UNIQUE REFERENCES documents(id),
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `)
}

/**
 * Seed a project + folder + document chain. Returns the created document.
 */
const seedDocument = (db: BetterSQLite3Database<typeof schema>, name = 'test.pdf') => {
  const now = new Date().toISOString()

  let project = db.select().from(schema.projects).get()
  if (!project) {
    project = db
      .insert(schema.projects)
      .values({ name: 'Test Project', created_at: now, updated_at: now })
      .returning()
      .get()!
  }

  let folder = db.select().from(schema.folders).get()
  if (!folder) {
    folder = db
      .insert(schema.folders)
      .values({ name: 'Root', project_id: project.id, created_at: now })
      .returning()
      .get()!
  }

  const doc = db
    .insert(schema.documents)
    .values({
      name,
      file_path: `/path/${name}`,
      file_type: 'pdf',
      file_size: 1024,
      folder_id: folder.id,
      project_id: project.id,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get()!

  return doc
}

/**
 * Seed a project + folder structure with nested folders for cascade tests.
 */
const seedNestedFolders = (db: BetterSQLite3Database<typeof schema>) => {
  const now = new Date().toISOString()

  const project = db
    .insert(schema.projects)
    .values({ name: 'Test Project', created_at: now, updated_at: now })
    .returning()
    .get()!

  const parentFolder = db
    .insert(schema.folders)
    .values({ name: 'Parent', project_id: project.id, created_at: now })
    .returning()
    .get()!

  const childFolder = db
    .insert(schema.folders)
    .values({ name: 'Child', project_id: project.id, parent_folder_id: parentFolder.id, created_at: now })
    .returning()
    .get()!

  const docInParent = db
    .insert(schema.documents)
    .values({
      name: 'parent-doc.pdf',
      file_path: '/path/parent-doc.pdf',
      file_type: 'pdf',
      file_size: 512,
      folder_id: parentFolder.id,
      project_id: project.id,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get()!

  const docInChild = db
    .insert(schema.documents)
    .values({
      name: 'child-doc.pdf',
      file_path: '/path/child-doc.pdf',
      file_type: 'pdf',
      file_size: 256,
      folder_id: childFolder.id,
      project_id: project.id,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get()!

  return { project, parentFolder, childFolder, docInParent, docInChild }
}

describe('tag-service gap tests', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-tag-gaps-'))
    const dbPath = path.join(tmpDir, 'test.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    createTables(sqlite)
    db = drizzle(sqlite, { schema })
    mockGetDb.mockReturnValue(db)
    mockGetSqlite.mockReturnValue(sqlite)
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    mockGetDb.mockReset()
    mockGetSqlite.mockReset()
  })

  it('setDocumentTags() with empty array clears all tags from a document', async () => {
    const { createTag, setDocumentTags, getDocumentTags } = await import('@main/services/tag-service')

    const tag1 = createTag({ name: 'Alpha' })
    const tag2 = createTag({ name: 'Beta' })
    const doc = seedDocument(db)

    // Assign two tags
    setDocumentTags(doc.id, [tag1.id, tag2.id])
    expect(getDocumentTags(doc.id)).toHaveLength(2)

    // Clear all tags by passing empty array
    setDocumentTags(doc.id, [])
    expect(getDocumentTags(doc.id)).toHaveLength(0)
  })

  it('suggestTags() returns tags matching a prefix (case-insensitive via LIKE)', async () => {
    const { createTag, suggestTags } = await import('@main/services/tag-service')

    createTag({ name: 'JavaScript' })
    createTag({ name: 'Java' })
    createTag({ name: 'Python' })
    createTag({ name: 'jargon' })

    // Prefix "Ja" should match "Java", "JavaScript", "jargon" (LIKE is case-insensitive in SQLite by default for ASCII)
    const suggestions = suggestTags('Ja')
    const names = suggestions.map((t) => t.name)

    expect(names).toContain('Java')
    expect(names).toContain('JavaScript')
    expect(names).not.toContain('Python')
  })

  it('getTagCloud() includes tags with zero document associations', async () => {
    const { createTag, setDocumentTags, getTagCloud } = await import('@main/services/tag-service')

    const tagUsed = createTag({ name: 'Used' })
    createTag({ name: 'Unused' })
    const doc = seedDocument(db)

    // Only associate one tag
    setDocumentTags(doc.id, [tagUsed.id])

    const cloud = getTagCloud()
    expect(cloud).toHaveLength(2)

    const usedEntry = cloud.find((c) => c.name === 'Used')
    const unusedEntry = cloud.find((c) => c.name === 'Unused')

    expect(usedEntry).toBeDefined()
    expect(usedEntry!.document_count).toBe(1)

    expect(unusedEntry).toBeDefined()
    expect(unusedEntry!.document_count).toBe(0)
  })

  it('cascadeDeleteFolder() removes document_tags junction entries for documents in nested folders', async () => {
    const { createTag, setDocumentTags } = await import('@main/services/tag-service')
    const { cascadeDeleteFolder } = await import('@main/services/folder-service')

    const { parentFolder, docInParent, docInChild } = seedNestedFolders(db)

    const tag1 = createTag({ name: 'TagA' })
    const tag2 = createTag({ name: 'TagB' })

    // Associate tags with documents in both parent and child folders
    setDocumentTags(docInParent.id, [tag1.id, tag2.id])
    setDocumentTags(docInChild.id, [tag1.id])

    // Verify 3 junction entries exist
    const beforeCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags').get() as { cnt: number }
    expect(beforeCount.cnt).toBe(3)

    // Cascade delete the parent folder (should delete child folder, both docs, and all junction entries)
    cascadeDeleteFolder(parentFolder.id)

    // Verify all junction entries are gone
    const afterCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags').get() as { cnt: number }
    expect(afterCount.cnt).toBe(0)

    // Verify tags themselves still exist
    const tagCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM tags').get() as { cnt: number }
    expect(tagCount.cnt).toBe(2)

    // Verify documents are gone
    const docCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM documents').get() as { cnt: number }
    expect(docCount.cnt).toBe(0)
  })

  it('cascadeDeleteProject() removes document_tags junction entries for all project documents', async () => {
    const { createTag, setDocumentTags } = await import('@main/services/tag-service')
    const { cascadeDeleteProject } = await import('@main/services/project-service')

    const { project, docInParent, docInChild } = seedNestedFolders(db)

    const tag1 = createTag({ name: 'TagX' })
    const tag2 = createTag({ name: 'TagY' })

    setDocumentTags(docInParent.id, [tag1.id])
    setDocumentTags(docInChild.id, [tag1.id, tag2.id])

    const beforeCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags').get() as { cnt: number }
    expect(beforeCount.cnt).toBe(3)

    cascadeDeleteProject(project.id)

    // All junction entries should be removed
    const afterCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM document_tags').get() as { cnt: number }
    expect(afterCount.cnt).toBe(0)

    // Tags still exist
    const tagCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM tags').get() as { cnt: number }
    expect(tagCount.cnt).toBe(2)

    // Project, folders, and documents are all gone
    const projectCount = sqlite.prepare('SELECT COUNT(*) as cnt FROM projects').get() as { cnt: number }
    expect(projectCount.cnt).toBe(0)
  })

  it('batchGetDocumentTags() with empty input returns empty object', async () => {
    const { batchGetDocumentTags } = await import('@main/services/tag-service')

    const result = batchGetDocumentTags([])
    expect(result).toEqual({})
  })
})
