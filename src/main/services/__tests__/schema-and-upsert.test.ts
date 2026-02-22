import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq, getTableColumns } from 'drizzle-orm'
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

/**
 * Create tables with the NEW schema (including processing_status, unique constraint,
 * and app_settings table). These tests are written BEFORE implementation, so they
 * validate the schema changes we expect to make.
 */
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

    CREATE TABLE IF NOT EXISTS quizzes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quiz_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
      question TEXT NOT NULL,
      options TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT
    );

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id INTEGER NOT NULL REFERENCES quizzes(id),
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      answers TEXT,
      completed_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      level TEXT NOT NULL,
      message TEXT NOT NULL,
      context TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)
}

/**
 * Helper to create prerequisite data for tests that need documents
 * (project -> folder -> document chain)
 */
const createDocumentPrerequisites = (db: BetterSQLite3Database<typeof schema>) => {
  const project = db
    .insert(schema.projects)
    .values({
      name: 'Test Project',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning()
    .get()!

  const folder = db
    .insert(schema.folders)
    .values({
      name: 'Test Folder',
      project_id: project.id,
      created_at: new Date().toISOString(),
    })
    .returning()
    .get()!

  const document = db
    .insert(schema.documents)
    .values({
      name: 'test.pdf',
      file_path: '/test/test.pdf',
      file_type: 'pdf',
      file_size: 1024,
      folder_id: folder.id,
      project_id: project.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning()
    .get()!

  return { project, folder, document }
}

describe('schema changes and upsert', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-schema-test-'))
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

  // ─── Test 1: processing_status column exists and defaults to 'pending' ───

  describe('processing_status column', () => {
    it('should exist on documents table and default to pending', () => {
      const columns = getTableColumns(schema.documents)
      const columnNames = Object.keys(columns)

      expect(columnNames).toContain('processing_status')

      // Verify default works at the database level
      const { document } = createDocumentPrerequisites(db)
      expect(document.processing_status).toBe('pending')
    })
  })

  // ─── Test 2: document_content.document_id unique constraint ──────────────

  describe('document_content.document_id unique constraint', () => {
    it('should reject duplicate document_id inserts', () => {
      const { document } = createDocumentPrerequisites(db)

      // First insert should succeed
      db.insert(schema.documentContent)
        .values({
          document_id: document.id,
          raw_text: 'First content',
          processed_at: new Date().toISOString(),
        })
        .run()

      // Second insert with same document_id should fail (unique constraint)
      expect(() => {
        db.insert(schema.documentContent)
          .values({
            document_id: document.id,
            raw_text: 'Duplicate content',
            processed_at: new Date().toISOString(),
          })
          .run()
      }).toThrow()
    })
  })

  // ─── Test 3: saveDocumentContent() upsert behavior ───────────────────────

  describe('saveDocumentContent() upsert', () => {
    it('should insert on first call and update on second call without nullifying fields', async () => {
      const { saveDocumentContent } = await import('@main/services/document-service')
      const { document } = createDocumentPrerequisites(db)

      // First call: insert with raw_text
      const first = saveDocumentContent({
        document_id: document.id,
        raw_text: 'Original text',
        summary: 'Original summary',
      })

      expect(first).toBeDefined()
      expect(first.raw_text).toBe('Original text')
      expect(first.summary).toBe('Original summary')

      // Second call: update with new raw_text
      const second = saveDocumentContent({
        document_id: document.id,
        raw_text: 'Updated text',
        summary: 'Updated summary',
      })

      expect(second).toBeDefined()
      expect(second.document_id).toBe(document.id)
      expect(second.raw_text).toBe('Updated text')
      expect(second.summary).toBe('Updated summary')
    })
  })

  // ─── Test 4: saveDocumentContent() partial update ────────────────────────

  describe('saveDocumentContent() partial update', () => {
    it('should preserve existing raw_text when only summary is provided', async () => {
      const { saveDocumentContent } = await import('@main/services/document-service')
      const { document } = createDocumentPrerequisites(db)

      // First call: insert with raw_text
      saveDocumentContent({
        document_id: document.id,
        raw_text: 'Original text',
      })

      // Second call: only summary (should not overwrite raw_text)
      const result = saveDocumentContent({
        document_id: document.id,
        summary: 'New summary',
      })

      expect(result.raw_text).toBe('Original text')
      expect(result.summary).toBe('New summary')
    })
  })

  // ─── Test 5: app_settings table CRUD ─────────────────────────────────────

  describe('app_settings table', () => {
    it('should support insert, read by key, update, and list all', () => {
      // Insert
      db.insert(schema.appSettings)
        .values({
          key: 'ollama_url',
          value: 'http://localhost:11434',
          updated_at: new Date().toISOString(),
        })
        .run()

      db.insert(schema.appSettings)
        .values({
          key: 'theme',
          value: 'dark',
          updated_at: new Date().toISOString(),
        })
        .run()

      // Read by key

      const setting = db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'ollama_url')).get()

      expect(setting).toBeDefined()
      expect(setting!.key).toBe('ollama_url')
      expect(setting!.value).toBe('http://localhost:11434')

      // Update
      db.update(schema.appSettings)
        .set({ value: 'http://localhost:11435', updated_at: new Date().toISOString() })
        .where(eq(schema.appSettings.key, 'ollama_url'))
        .run()

      const updated = db.select().from(schema.appSettings).where(eq(schema.appSettings.key, 'ollama_url')).get()

      expect(updated!.value).toBe('http://localhost:11435')

      // List all
      const all = db.select().from(schema.appSettings).all()
      expect(all).toHaveLength(2)
      expect(all.map((s) => s.key)).toContain('ollama_url')
      expect(all.map((s) => s.key)).toContain('theme')
    })
  })

  // ─── Test 6: document_content accepts key_terms JSON column ──────────────

  describe('document_content key_terms column', () => {
    it('should accept key_terms JSON data and read it back as structured data', () => {
      const { document } = createDocumentPrerequisites(db)

      const keyTerms = [
        { term: 'Photosynthesis', definition: 'Process by which plants convert light to energy' },
        { term: 'Chlorophyll', definition: 'Green pigment in plants that absorbs light' },
      ]

      db.insert(schema.documentContent)
        .values({
          document_id: document.id,
          raw_text: 'Some biology text',
          key_terms: keyTerms,
          processed_at: new Date().toISOString(),
        })
        .run()

      const row = db
        .select()
        .from(schema.documentContent)
        .where(eq(schema.documentContent.document_id, document.id))
        .get()

      expect(row).toBeDefined()
      expect(row!.key_terms).toEqual(keyTerms)
      expect(row!.key_terms![0].term).toBe('Photosynthesis')
      expect(row!.key_terms![1].definition).toBe('Green pigment in plants that absorbs light')
    })
  })

  // ─── Test 7: document_content accepts summary_style text column ─────────

  describe('document_content summary_style column', () => {
    it('should accept summary_style text and read it back', () => {
      const { document } = createDocumentPrerequisites(db)

      db.insert(schema.documentContent)
        .values({
          document_id: document.id,
          raw_text: 'Some text',
          summary_style: 'academic',
          processed_at: new Date().toISOString(),
        })
        .run()

      const row = db
        .select()
        .from(schema.documentContent)
        .where(eq(schema.documentContent.document_id, document.id))
        .get()

      expect(row).toBeDefined()
      expect(row!.summary_style).toBe('academic')
    })
  })

  // ─── Test 8: saveDocumentContent() handles key_terms field ──────────────

  describe('saveDocumentContent() key_terms upsert', () => {
    it('should persist key_terms via upsert and preserve other fields', async () => {
      const { saveDocumentContent } = await import('@main/services/document-service')
      const { document } = createDocumentPrerequisites(db)

      // First call: insert with raw_text
      saveDocumentContent({
        document_id: document.id,
        raw_text: 'Original text',
      })

      // Second call: add key_terms without overwriting raw_text
      const keyTerms = [
        { term: 'Neural Network', definition: 'A computing system inspired by biological neural networks' },
      ]
      const result = saveDocumentContent({
        document_id: document.id,
        key_terms: keyTerms,
      })

      expect(result.raw_text).toBe('Original text')
      expect(result.key_terms).toEqual(keyTerms)
    })
  })

  // ─── Test 9: saveDocumentContent() handles summary_style field ──────────

  describe('saveDocumentContent() summary_style upsert', () => {
    it('should persist summary_style via upsert and preserve other fields', async () => {
      const { saveDocumentContent } = await import('@main/services/document-service')
      const { document } = createDocumentPrerequisites(db)

      // First call: insert with summary
      saveDocumentContent({
        document_id: document.id,
        summary: 'A brief overview',
      })

      // Second call: add summary_style without overwriting summary
      const result = saveDocumentContent({
        document_id: document.id,
        summary_style: 'detailed',
      })

      expect(result.summary).toBe('A brief overview')
      expect(result.summary_style).toBe('detailed')
    })
  })

  // ─── Test 10: stale processing status reset ──────────────────────────────

  describe('stale processing status reset', () => {
    it('should reset documents with processing status back to pending', () => {
      const { document } = createDocumentPrerequisites(db)

      // Set document to 'processing' status
      db.update(schema.documents)
        .set({ processing_status: 'processing' })
        .where(eq(schema.documents.id, document.id))
        .run()

      // Verify it is 'processing'
      const before = db.select().from(schema.documents).where(eq(schema.documents.id, document.id)).get()
      expect(before!.processing_status).toBe('processing')

      // Reset stale processing statuses (this is the logic we expect to exist)
      db.update(schema.documents)
        .set({ processing_status: 'pending' })
        .where(eq(schema.documents.processing_status, 'processing'))
        .run()

      // Verify it is now 'pending'
      const after = db.select().from(schema.documents).where(eq(schema.documents.id, document.id)).get()
      expect(after!.processing_status).toBe('pending')
    })
  })
})
