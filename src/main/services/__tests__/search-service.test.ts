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

/**
 * Create all tables needed for search service tests, including FTS5 virtual table
 * and triggers. Uses raw SQL for table creation (matching Drizzle schema) and
 * calls runMigrations logic for FTS5 setup.
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
    CREATE TABLE IF NOT EXISTS recent_searches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      query TEXT NOT NULL,
      result_count INTEGER NOT NULL DEFAULT 0,
      searched_at TEXT NOT NULL
    );
  `)

  // Create FTS5 virtual table and triggers (same as runMigrations)
  sqlite.exec(`
    CREATE VIRTUAL TABLE documents_fts USING fts5(
      raw_text,
      summary,
      content='document_content',
      content_rowid='id'
    )
  `)

  sqlite.exec(`
    CREATE TRIGGER documents_fts_ai AFTER INSERT ON document_content BEGIN
      INSERT INTO documents_fts(rowid, raw_text, summary)
      VALUES (NEW.id, NEW.raw_text, NEW.summary);
    END
  `)

  sqlite.exec(`
    CREATE TRIGGER documents_fts_au AFTER UPDATE ON document_content BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, raw_text, summary)
      VALUES('delete', OLD.id, OLD.raw_text, OLD.summary);
      INSERT INTO documents_fts(rowid, raw_text, summary)
      VALUES (NEW.id, NEW.raw_text, NEW.summary);
    END
  `)

  sqlite.exec(`
    CREATE TRIGGER documents_fts_ad AFTER DELETE ON document_content BEGIN
      INSERT INTO documents_fts(documents_fts, rowid, raw_text, summary)
      VALUES('delete', OLD.id, OLD.raw_text, OLD.summary);
    END
  `)
}

/** Helper to seed a project + folder and return their IDs. */
const seedProjectAndFolder = (
  sqlite: Database.Database,
  projectName = 'Test Project',
): { projectId: number; folderId: number } => {
  const now = new Date().toISOString()
  const pResult = sqlite
    .prepare('INSERT INTO projects (name, created_at, updated_at) VALUES (?, ?, ?)')
    .run(projectName, now, now)
  const projectId = pResult.lastInsertRowid as number

  const fResult = sqlite
    .prepare('INSERT INTO folders (name, project_id, created_at) VALUES (?, ?, ?)')
    .run('Root', projectId, now)
  const folderId = fResult.lastInsertRowid as number

  return { projectId, folderId }
}

/** Helper to insert a document with optional content. */
const insertDocument = (
  sqlite: Database.Database,
  opts: {
    name: string
    fileType: string
    projectId: number
    folderId: number
    processingStatus?: string
    rawText?: string | null
    summary?: string | null
    createdAt?: string
  },
): number => {
  const now = opts.createdAt ?? new Date().toISOString()
  const status = opts.processingStatus ?? 'completed'

  const docResult = sqlite
    .prepare(
      `INSERT INTO documents (name, file_path, file_type, file_size, folder_id, project_id, processing_status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(opts.name, `/path/${opts.name}`, opts.fileType, 1024, opts.folderId, opts.projectId, status, now, now)
  const documentId = docResult.lastInsertRowid as number

  // Insert document_content if rawText or summary is provided
  if (opts.rawText !== undefined || opts.summary !== undefined) {
    sqlite
      .prepare('INSERT INTO document_content (document_id, raw_text, summary) VALUES (?, ?, ?)')
      .run(documentId, opts.rawText ?? null, opts.summary ?? null)
  }

  return documentId
}

describe('search-service', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-search-'))
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

  describe('searchDocuments', () => {
    it('should return FTS5 content matches with snippets containing <mark> tags', async () => {
      const { searchDocuments } = await import('@main/services/search-service')
      const { projectId, folderId } = seedProjectAndFolder(sqlite)

      insertDocument(sqlite, {
        name: 'biology-notes.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        rawText: 'Photosynthesis is the process by which green plants convert sunlight into energy',
      })

      const result = searchDocuments({ query: 'photosynthesis' })

      expect(result.results).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.results[0].documentName).toBe('biology-notes.pdf')
      expect(result.results[0].matchType).toBe('content')
      expect(result.results[0].snippet).not.toBeNull()
      expect(result.results[0].snippet).toContain('<mark>')
      expect(result.results[0].snippet).toContain('</mark>')
    })

    it('should return name-only matches via LIKE query for documents without parsed content', async () => {
      const { searchDocuments } = await import('@main/services/search-service')
      const { projectId, folderId } = seedProjectAndFolder(sqlite)

      // Document with NO content (pending status, no document_content row)
      insertDocument(sqlite, {
        name: 'chemistry-homework.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        processingStatus: 'pending',
        // No rawText, no content row
      })

      const result = searchDocuments({ query: 'chemistry' })

      expect(result.results).toHaveLength(1)
      expect(result.results[0].documentName).toBe('chemistry-homework.pdf')
      expect(result.results[0].matchType).toBe('name')
      expect(result.results[0].snippet).toBeNull()
    })

    it('should merge and deduplicate results when a document matches both name and content', async () => {
      const { searchDocuments } = await import('@main/services/search-service')
      const { projectId, folderId } = seedProjectAndFolder(sqlite)

      // Document whose name AND content both match "biology"
      insertDocument(sqlite, {
        name: 'biology-lecture.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        rawText: 'This lecture covers biology fundamentals including cell structure',
      })

      const result = searchDocuments({ query: 'biology' })

      // Should appear exactly once (deduplicated), as content match
      expect(result.results).toHaveLength(1)
      expect(result.results[0].documentName).toBe('biology-lecture.pdf')
      expect(result.results[0].matchType).toBe('content')
    })

    it('should apply project filter, file type filter, and date range filter correctly', async () => {
      const { searchDocuments } = await import('@main/services/search-service')

      const proj1 = seedProjectAndFolder(sqlite, 'Biology')
      const proj2 = seedProjectAndFolder(sqlite, 'Chemistry')

      // Doc in Biology, pdf, recent
      insertDocument(sqlite, {
        name: 'notes-alpha.pdf',
        fileType: 'pdf',
        projectId: proj1.projectId,
        folderId: proj1.folderId,
        rawText: 'Study notes about molecules and atoms',
        createdAt: new Date().toISOString(),
      })

      // Doc in Chemistry, docx, recent
      insertDocument(sqlite, {
        name: 'notes-beta.docx',
        fileType: 'docx',
        projectId: proj2.projectId,
        folderId: proj2.folderId,
        rawText: 'Study notes about chemical reactions',
        createdAt: new Date().toISOString(),
      })

      // Doc in Biology, pdf, old (40 days ago)
      insertDocument(sqlite, {
        name: 'notes-gamma.pdf',
        fileType: 'pdf',
        projectId: proj1.projectId,
        folderId: proj1.folderId,
        rawText: 'Study notes about ecosystems',
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
      })

      // Project filter: only Biology
      const byProject = searchDocuments({ query: 'notes', projectId: proj1.projectId })
      expect(byProject.results).toHaveLength(2)
      for (const r of byProject.results) {
        expect(r.projectName).toBe('Biology')
      }

      // File type filter: only pdf
      const byType = searchDocuments({ query: 'notes', fileType: 'pdf' })
      expect(byType.results).toHaveLength(2)
      for (const r of byType.results) {
        expect(r.fileType).toBe('pdf')
      }

      // Date range filter: last 7 days (excludes 40-day-old doc)
      const byDate = searchDocuments({ query: 'notes', dateRange: '7d' })
      expect(byDate.results).toHaveLength(2)
      const names = byDate.results.map((r) => r.documentName)
      expect(names).not.toContain('notes-gamma.pdf')
    })

    it('should sanitize FTS5 special characters in query input', async () => {
      const { searchDocuments } = await import('@main/services/search-service')
      const { projectId, folderId } = seedProjectAndFolder(sqlite)

      insertDocument(sqlite, {
        name: 'test-doc.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        rawText: 'This document discusses quantum mechanics and wave functions',
      })

      // Query with FTS5 special characters that would cause syntax errors
      // Should not throw and should still return results for the sanitized terms
      expect(() => searchDocuments({ query: '"quantum" AND NOT (wave*)' })).not.toThrow()
      expect(() => searchDocuments({ query: 'NEAR(quantum, wave)' })).not.toThrow()

      const result = searchDocuments({ query: '"quantum" OR "mechanics"' })
      // After sanitization, the meaningful terms "quantum" and "mechanics" should still match
      expect(result.results.length).toBeGreaterThanOrEqual(1)
    })

    it('should return empty results when database has no documents', async () => {
      const { searchDocuments } = await import('@main/services/search-service')

      // No documents inserted — completely empty database
      const result = searchDocuments({ query: 'anything' })

      expect(result).toEqual({ results: [], total: 0, hasMore: false })
    })

    it('should return empty results (not error) when query contains only FTS5 special characters', async () => {
      const { searchDocuments } = await import('@main/services/search-service')
      const { projectId, folderId } = seedProjectAndFolder(sqlite)

      insertDocument(sqlite, {
        name: 'test-doc.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        rawText: 'Some content for testing',
      })

      // Query that is entirely FTS5 operators / special chars — sanitizes to empty string
      const result = searchDocuments({ query: '"AND" OR NOT * ()' })

      // After sanitization all meaningful tokens are FTS5 operators, so ftsQuery = ""
      // The LIKE fallback on the name will still run against "%\"AND\" OR NOT * ()%"
      // which won't match any document name. The overall result should be empty, not an error.
      expect(result.results).toEqual([])
      expect(result.total).toBe(0)
      expect(result.hasMore).toBe(false)
    })

    it('should return results matching all words for multi-word query (implicit AND)', async () => {
      const { searchDocuments } = await import('@main/services/search-service')
      const { projectId, folderId } = seedProjectAndFolder(sqlite)

      // Document that contains both "machine" and "learning"
      insertDocument(sqlite, {
        name: 'ml-paper.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        rawText: 'Machine learning algorithms are used for prediction and classification',
      })

      // Document that contains only "machine" but not "learning"
      insertDocument(sqlite, {
        name: 'machine-manual.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        rawText: 'This machine manual describes assembly and maintenance',
      })

      // Multi-word query "machine learning" should use implicit AND
      const result = searchDocuments({ query: 'machine learning' })

      // Only the first document matches both terms
      const contentResults = result.results.filter((r) => r.matchType === 'content')
      expect(contentResults).toHaveLength(1)
      expect(contentResults[0].documentName).toBe('ml-paper.pdf')
    })

    it('should return snippet with <mark> tags wrapping the matched term', async () => {
      const { searchDocuments } = await import('@main/services/search-service')
      const { projectId, folderId } = seedProjectAndFolder(sqlite)

      insertDocument(sqlite, {
        name: 'physics-notes.pdf',
        fileType: 'pdf',
        projectId,
        folderId,
        rawText: 'Einstein developed the theory of relativity which changed physics forever',
      })

      const result = searchDocuments({ query: 'relativity' })

      expect(result.results).toHaveLength(1)
      const snippet = result.results[0].snippet!
      // The snippet should wrap the matched term in <mark> tags
      expect(snippet).toContain('<mark>relativity</mark>')
    })
  })

  describe('saveRecentSearch', () => {
    it('should enforce max 10 entries by deleting oldest when 11th is inserted', async () => {
      const { saveRecentSearch, listRecentSearches } = await import('@main/services/search-service')

      // Insert 10 searches
      for (let i = 0; i < 10; i++) {
        saveRecentSearch(`query-${i}`, i)
      }

      let searches = listRecentSearches()
      expect(searches).toHaveLength(10)

      // Insert an 11th
      saveRecentSearch('query-overflow', 99)

      searches = listRecentSearches()
      expect(searches).toHaveLength(10)
      // The oldest (query-0) should have been evicted
      const queries = searches.map((s) => s.query)
      expect(queries).not.toContain('query-0')
      expect(queries).toContain('query-overflow')
    })

    it('should keep exactly 10 entries when at boundary and new entry is inserted (oldest removed)', async () => {
      const { saveRecentSearch, listRecentSearches } = await import('@main/services/search-service')

      // Insert exactly 10 searches with explicit timestamps so ordering is deterministic
      for (let i = 0; i < 10; i++) {
        sqlite
          .prepare('INSERT INTO recent_searches (query, result_count, searched_at) VALUES (?, ?, ?)')
          .run(`search-${i}`, i, `2026-02-23T${String(i).padStart(2, '0')}:00:00.000Z`)
      }

      let searches = listRecentSearches()
      expect(searches).toHaveLength(10)
      // Oldest is search-0 (00:00)
      expect(searches[searches.length - 1].query).toBe('search-0')

      // Insert 1 new entry (11th total)
      saveRecentSearch('search-new', 42)

      searches = listRecentSearches()
      // Still exactly 10 entries
      expect(searches).toHaveLength(10)
      // search-0 (the oldest) should have been evicted
      const queries = searches.map((s) => s.query)
      expect(queries).not.toContain('search-0')
      // All others (1-9) plus the new one should be present
      expect(queries).toContain('search-new')
      expect(queries).toContain('search-1')
      expect(queries).toContain('search-9')
    })
  })

  describe('listRecentSearches', () => {
    it('should return entries ordered by searched_at DESC', async () => {
      const { saveRecentSearch, listRecentSearches } = await import('@main/services/search-service')

      // Insert in non-chronological order
      saveRecentSearch('old-search', 3)

      // Small delay to ensure different timestamps
      const laterTime = new Date(Date.now() + 1000).toISOString()
      sqlite
        .prepare('INSERT INTO recent_searches (query, result_count, searched_at) VALUES (?, ?, ?)')
        .run('newer-search', 5, laterTime)

      const evenLaterTime = new Date(Date.now() + 2000).toISOString()
      sqlite
        .prepare('INSERT INTO recent_searches (query, result_count, searched_at) VALUES (?, ?, ?)')
        .run('newest-search', 8, evenLaterTime)

      const searches = listRecentSearches()
      expect(searches).toHaveLength(3)
      expect(searches[0].query).toBe('newest-search')
      expect(searches[1].query).toBe('newer-search')
      expect(searches[2].query).toBe('old-search')
      expect(searches[0].resultCount).toBe(8)
    })
  })

  describe('clearRecentSearches / deleteRecentSearch', () => {
    it('should clear all entries and delete a single entry correctly', async () => {
      const { saveRecentSearch, listRecentSearches, clearRecentSearches, deleteRecentSearch } =
        await import('@main/services/search-service')

      saveRecentSearch('search-a', 1)
      saveRecentSearch('search-b', 2)
      saveRecentSearch('search-c', 3)

      // Delete single entry
      let searches = listRecentSearches()
      expect(searches).toHaveLength(3)

      const idToDelete = searches.find((s) => s.query === 'search-b')!.id
      deleteRecentSearch(idToDelete)

      searches = listRecentSearches()
      expect(searches).toHaveLength(2)
      expect(searches.map((s) => s.query)).not.toContain('search-b')

      // Clear all remaining
      clearRecentSearches()

      searches = listRecentSearches()
      expect(searches).toHaveLength(0)
    })
  })
})
