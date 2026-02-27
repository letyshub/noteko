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
  `)
}

/**
 * Seed a project + folder + document chain. Returns the created document.
 */
const seedDocument = (db: BetterSQLite3Database<typeof schema>, name = 'test.pdf') => {
  const now = new Date().toISOString()

  // Reuse project id=1 if it exists
  let project = db.select().from(schema.projects).get()
  if (!project) {
    project = db
      .insert(schema.projects)
      .values({ name: 'Test Project', created_at: now, updated_at: now })
      .returning()
      .get()!
  }

  // Reuse folder id=1 if it exists
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

describe('tag-service', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-tag-svc-'))
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

  it('createTag() returns tag with id, name, color, created_at', async () => {
    const { createTag } = await import('@main/services/tag-service')
    const tag = createTag({ name: 'Biology', color: '#4CAF50' })

    expect(tag).toBeDefined()
    expect(tag.id).toBeTypeOf('number')
    expect(tag.name).toBe('Biology')
    expect(tag.color).toBe('#4CAF50')
    expect(tag.created_at).toBeTruthy()
  })

  it('listTags() returns all tags sorted alphabetically', async () => {
    const { createTag, listTags } = await import('@main/services/tag-service')

    createTag({ name: 'Zoology' })
    createTag({ name: 'Algebra' })
    createTag({ name: 'Chemistry' })

    const tags = listTags()
    expect(tags).toHaveLength(3)
    expect(tags[0].name).toBe('Algebra')
    expect(tags[1].name).toBe('Chemistry')
    expect(tags[2].name).toBe('Zoology')
  })

  it('updateTag() renames a tag and changes its color', async () => {
    const { createTag, updateTag } = await import('@main/services/tag-service')

    const original = createTag({ name: 'Bio', color: '#000' })
    const updated = updateTag(original.id, { name: 'Biology', color: '#4CAF50' })

    expect(updated).toBeDefined()
    expect(updated!.id).toBe(original.id)
    expect(updated!.name).toBe('Biology')
    expect(updated!.color).toBe('#4CAF50')
  })

  it('deleteTag() removes tag and returns affected document count', async () => {
    const { createTag, deleteTag, setDocumentTags } = await import('@main/services/tag-service')

    const tag = createTag({ name: 'Temp' })
    const doc1 = seedDocument(db, 'doc1.pdf')
    const doc2 = seedDocument(db, 'doc2.pdf')

    // Associate the tag with two documents
    setDocumentTags(doc1.id, [tag.id])
    setDocumentTags(doc2.id, [tag.id])

    const result = deleteTag(tag.id)
    expect(result).toBeDefined()
    expect(result!.tag.id).toBe(tag.id)
    expect(result!.affectedDocumentCount).toBe(2)

    // Verify the tag is actually gone
    const { listTags } = await import('@main/services/tag-service')
    expect(listTags()).toHaveLength(0)
  })

  it('setDocumentTags() atomically replaces all tags on a document', async () => {
    const { createTag, setDocumentTags, getDocumentTags } = await import('@main/services/tag-service')

    const tag1 = createTag({ name: 'Alpha' })
    const tag2 = createTag({ name: 'Beta' })
    const tag3 = createTag({ name: 'Gamma' })
    const doc = seedDocument(db)

    // Set initial tags
    setDocumentTags(doc.id, [tag1.id, tag2.id])
    let docTags = getDocumentTags(doc.id)
    expect(docTags).toHaveLength(2)

    // Replace with a different set
    setDocumentTags(doc.id, [tag2.id, tag3.id])
    docTags = getDocumentTags(doc.id)
    expect(docTags).toHaveLength(2)
    const tagNames = docTags.map((t) => t.name).sort()
    expect(tagNames).toEqual(['Beta', 'Gamma'])
  })

  it('batchGetDocumentTags() returns correct tag map for multiple document IDs', async () => {
    const { createTag, setDocumentTags, batchGetDocumentTags } = await import('@main/services/tag-service')

    const tagA = createTag({ name: 'TagA' })
    const tagB = createTag({ name: 'TagB' })
    const doc1 = seedDocument(db, 'd1.pdf')
    const doc2 = seedDocument(db, 'd2.pdf')
    const doc3 = seedDocument(db, 'd3.pdf')

    setDocumentTags(doc1.id, [tagA.id, tagB.id])
    setDocumentTags(doc2.id, [tagB.id])
    // doc3 has no tags

    const tagMap = batchGetDocumentTags([doc1.id, doc2.id, doc3.id])

    expect(tagMap[doc1.id]).toHaveLength(2)
    expect(tagMap[doc2.id]).toHaveLength(1)
    expect(tagMap[doc2.id][0].name).toBe('TagB')
    expect(tagMap[doc3.id]).toEqual([])
  })

  it('listDocumentsByTags() returns documents matching ANY of the provided tag IDs (OR semantics)', async () => {
    const { createTag, setDocumentTags, listDocumentsByTags } = await import('@main/services/tag-service')

    const tagX = createTag({ name: 'X' })
    const tagY = createTag({ name: 'Y' })
    const tagZ = createTag({ name: 'Z' })
    const doc1 = seedDocument(db, 'only-x.pdf')
    const doc2 = seedDocument(db, 'only-y.pdf')
    const doc3 = seedDocument(db, 'x-and-y.pdf')
    const doc4 = seedDocument(db, 'only-z.pdf')

    setDocumentTags(doc1.id, [tagX.id])
    setDocumentTags(doc2.id, [tagY.id])
    setDocumentTags(doc3.id, [tagX.id, tagY.id])
    setDocumentTags(doc4.id, [tagZ.id])

    // Filter by tagX OR tagY -- should return doc1, doc2, doc3 (not doc4)
    const results = listDocumentsByTags([tagX.id, tagY.id])
    expect(results).toHaveLength(3)

    const resultIds = results.map((d) => d.id).sort((a, b) => a - b)
    const expectedIds = [doc1.id, doc2.id, doc3.id].sort((a, b) => a - b)
    expect(resultIds).toEqual(expectedIds)
  })
})
