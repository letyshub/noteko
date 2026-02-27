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
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
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

const seedData = (db: BetterSQLite3Database<typeof schema>) => {
  const now = new Date().toISOString()

  // 2 projects
  const p1 = db
    .insert(schema.projects)
    .values({ name: 'Biology', color: '#22c55e', created_at: now, updated_at: now })
    .returning()
    .get()!
  const p2 = db
    .insert(schema.projects)
    .values({ name: 'Chemistry', color: '#3b82f6', created_at: now, updated_at: now })
    .returning()
    .get()!

  // Folders
  const f1 = db.insert(schema.folders).values({ name: 'Root', project_id: p1.id, created_at: now }).returning().get()!
  const f2 = db.insert(schema.folders).values({ name: 'Root', project_id: p2.id, created_at: now }).returning().get()!

  // 3 documents: 2 in Biology, 1 in Chemistry
  const d1 = db
    .insert(schema.documents)
    .values({
      name: 'bio-notes.pdf',
      file_path: '/bio.pdf',
      file_type: 'pdf',
      file_size: 1024,
      folder_id: f1.id,
      project_id: p1.id,
      created_at: '2026-02-20T10:00:00Z',
      updated_at: now,
    })
    .returning()
    .get()!
  const d2 = db
    .insert(schema.documents)
    .values({
      name: 'bio-slides.pptx',
      file_path: '/bio-slides.pptx',
      file_type: 'pptx',
      file_size: 2048,
      folder_id: f1.id,
      project_id: p1.id,
      created_at: '2026-02-21T10:00:00Z',
      updated_at: now,
    })
    .returning()
    .get()!
  const d3 = db
    .insert(schema.documents)
    .values({
      name: 'chem-intro.pdf',
      file_path: '/chem.pdf',
      file_type: 'pdf',
      file_size: 512,
      folder_id: f2.id,
      project_id: p2.id,
      created_at: '2026-02-22T10:00:00Z',
      updated_at: now,
    })
    .returning()
    .get()!

  // Quizzes and attempts
  const q1 = db
    .insert(schema.quizzes)
    .values({ document_id: d1.id, title: 'Bio Quiz 1', created_at: '2026-02-20T12:00:00Z' })
    .returning()
    .get()!
  const q2 = db
    .insert(schema.quizzes)
    .values({ document_id: d3.id, title: 'Chem Quiz 1', created_at: '2026-02-22T12:00:00Z' })
    .returning()
    .get()!

  // 3 attempts
  db.insert(schema.quizAttempts)
    .values({ quiz_id: q1.id, score: 80, total_questions: 10, completed_at: '2026-02-20T14:00:00Z' })
    .run()
  db.insert(schema.quizAttempts)
    .values({ quiz_id: q1.id, score: 90, total_questions: 10, completed_at: '2026-02-21T14:00:00Z' })
    .run()
  db.insert(schema.quizAttempts)
    .values({ quiz_id: q2.id, score: 60, total_questions: 10, completed_at: '2026-02-22T14:00:00Z' })
    .run()

  return { p1, p2, f1, f2, d1, d2, d3, q1, q2 }
}

describe('dashboard-service', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-dashboard-'))
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

  describe('getDashboardStats', () => {
    it('should return zeros when database is empty', async () => {
      const { getDashboardStats } = await import('@main/services/dashboard-service')
      const stats = getDashboardStats()
      expect(stats.total_projects).toBe(0)
      expect(stats.total_documents).toBe(0)
      expect(stats.total_quizzes_taken).toBe(0)
      expect(stats.average_score).toBe(0)
    })

    it('should return correct counts and average', async () => {
      const { getDashboardStats } = await import('@main/services/dashboard-service')
      seedData(db)
      const stats = getDashboardStats()
      expect(stats.total_projects).toBe(2)
      expect(stats.total_documents).toBe(3)
      expect(stats.total_quizzes_taken).toBe(3)
      // avg(80, 90, 60) = 76.67 → rounded to 77
      expect(stats.average_score).toBe(77)
    })
  })

  describe('getRecentDocuments', () => {
    it('should return empty array when no documents', async () => {
      const { getRecentDocuments } = await import('@main/services/dashboard-service')
      expect(getRecentDocuments()).toEqual([])
    })

    it('should return documents ordered by created_at desc with project name', async () => {
      const { getRecentDocuments } = await import('@main/services/dashboard-service')
      seedData(db)
      const docs = getRecentDocuments()
      expect(docs).toHaveLength(3)
      expect(docs[0].name).toBe('chem-intro.pdf')
      expect(docs[0].project_name).toBe('Chemistry')
      expect(docs[1].name).toBe('bio-slides.pptx')
      expect(docs[2].name).toBe('bio-notes.pdf')
    })

    it('should respect limit parameter', async () => {
      const { getRecentDocuments } = await import('@main/services/dashboard-service')
      seedData(db)
      const docs = getRecentDocuments(2)
      expect(docs).toHaveLength(2)
    })
  })

  describe('getRecentQuizAttempts', () => {
    it('should return empty array when no attempts', async () => {
      const { getRecentQuizAttempts } = await import('@main/services/dashboard-service')
      expect(getRecentQuizAttempts()).toEqual([])
    })

    it('should return attempts ordered by completed_at desc with context', async () => {
      const { getRecentQuizAttempts } = await import('@main/services/dashboard-service')
      seedData(db)
      const attempts = getRecentQuizAttempts()
      expect(attempts).toHaveLength(3)
      expect(attempts[0].quiz_title).toBe('Chem Quiz 1')
      expect(attempts[0].score).toBe(60)
      expect(attempts[0].document_name).toBe('chem-intro.pdf')
      expect(attempts[1].score).toBe(90)
      expect(attempts[2].score).toBe(80)
    })
  })

  describe('getProjectsWithCounts', () => {
    it('should return empty array when no projects', async () => {
      const { getProjectsWithCounts } = await import('@main/services/dashboard-service')
      expect(getProjectsWithCounts()).toEqual([])
    })

    it('should return projects with correct document counts', async () => {
      const { getProjectsWithCounts } = await import('@main/services/dashboard-service')
      seedData(db)
      const projectsList = getProjectsWithCounts()
      expect(projectsList).toHaveLength(2)

      const bio = projectsList.find((p) => p.name === 'Biology')
      expect(bio).toBeDefined()
      expect(bio!.document_count).toBe(2)
      expect(bio!.color).toBe('#22c55e')

      const chem = projectsList.find((p) => p.name === 'Chemistry')
      expect(chem).toBeDefined()
      expect(chem!.document_count).toBe(1)
    })

    it('should return 0 document count for projects with no documents', async () => {
      const { getProjectsWithCounts } = await import('@main/services/dashboard-service')
      const now = new Date().toISOString()
      db.insert(schema.projects).values({ name: 'Empty Project', created_at: now, updated_at: now }).run()
      const projectsList = getProjectsWithCounts()
      expect(projectsList).toHaveLength(1)
      expect(projectsList[0].document_count).toBe(0)
    })
  })
})
