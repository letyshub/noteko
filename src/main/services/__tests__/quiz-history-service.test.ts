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

describe('quiz history service', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-quiz-hist-test-'))
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

  // ─── listAllAttempts ──────────────────────────────────────────

  describe('listAllAttempts', () => {
    it('should return attempts joined with quiz title and document name', async () => {
      const { listAllAttempts, createQuiz, recordAttempt } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      const quiz = createQuiz({
        title: 'History Quiz',
        document_id: document.id,
        questions: [{ question: 'Q1?', options: ['A', 'B'], correct_answer: 'A' }],
      })!

      recordAttempt({ quiz_id: quiz.id, score: 8, total_questions: 10, answers: { '1': 'A' } })
      recordAttempt({ quiz_id: quiz.id, score: 9, total_questions: 10, answers: { '1': 'B' } })

      const result = listAllAttempts()

      expect(result).toHaveLength(2)
      // Ordered by completed_at DESC, so the second attempt is first
      expect(result[0].quiz_title).toBe('History Quiz')
      expect(result[0].document_name).toBe('test.pdf')
      expect(result[0].document_id).toBe(document.id)
      expect(result[0].score).toBe(9)
      expect(result[1].score).toBe(8)
    })

    it('should return empty array when no attempts exist', async () => {
      const { listAllAttempts } = await import('@main/services/quiz-service')

      const result = listAllAttempts()

      expect(result).toEqual([])
    })
  })

  // ─── getOverviewStats ─────────────────────────────────────────

  describe('getOverviewStats', () => {
    it('should return correct aggregates (count, avg, max, unique quizzes)', async () => {
      const { getOverviewStats, createQuiz, recordAttempt } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)

      const quiz1 = createQuiz({
        title: 'Quiz 1',
        document_id: document.id,
        questions: [{ question: 'Q1?', options: ['A', 'B'], correct_answer: 'A' }],
      })!

      const quiz2 = createQuiz({
        title: 'Quiz 2',
        document_id: document.id,
        questions: [{ question: 'Q2?', options: ['A', 'B'], correct_answer: 'B' }],
      })!

      // Quiz 1: two attempts, scores 60 and 80
      recordAttempt({ quiz_id: quiz1.id, score: 60, total_questions: 10 })
      recordAttempt({ quiz_id: quiz1.id, score: 80, total_questions: 10 })
      // Quiz 2: one attempt, score 90
      recordAttempt({ quiz_id: quiz2.id, score: 90, total_questions: 10 })

      const stats = getOverviewStats()

      expect(stats.total_attempts).toBe(3)
      // Average of 60, 80, 90 ≈ 76.67
      expect(stats.average_score).toBeCloseTo(76.67, 0)
      expect(stats.best_score).toBe(90)
      expect(stats.quizzes_taken).toBe(2)
    })

    it('should return zeroed stats when no attempts exist', async () => {
      const { getOverviewStats } = await import('@main/services/quiz-service')

      const stats = getOverviewStats()

      expect(stats.total_attempts).toBe(0)
      expect(stats.average_score).toBe(0)
      expect(stats.best_score).toBe(0)
      expect(stats.quizzes_taken).toBe(0)
    })
  })

  // ─── getWeakAreas ─────────────────────────────────────────────

  describe('getWeakAreas', () => {
    it('should correctly compute error rates by question type, skipping null answers', async () => {
      const { getWeakAreas, createQuiz, recordAttempt } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      const quiz = createQuiz({
        title: 'Weak Areas Quiz',
        document_id: document.id,
        questions: [
          {
            question: 'MC Q1?',
            options: ['A', 'B', 'C'],
            correct_answer: 'A',
            type: 'multiple-choice',
            difficulty: 'easy',
          },
          {
            question: 'TF Q1?',
            options: ['True', 'False'],
            correct_answer: 'True',
            type: 'true-false',
            difficulty: 'medium',
          },
          {
            question: 'MC Q2?',
            options: ['X', 'Y', 'Z'],
            correct_answer: 'Y',
            type: 'multiple-choice',
            difficulty: 'easy',
          },
        ],
      })!

      // Attempt 1: answers all questions (gets MC Q1 right, TF Q1 wrong, MC Q2 wrong)
      // Questions are inserted in order, so IDs are sequential
      const questions = db.select().from(schema.quizQuestions).all()
      const mcQ1 = questions[0]
      const tfQ1 = questions[1]
      const mcQ2 = questions[2]

      recordAttempt({
        quiz_id: quiz.id,
        score: 1,
        total_questions: 3,
        answers: {
          [String(mcQ1.id)]: 'A', // correct
          [String(tfQ1.id)]: 'False', // wrong
          [String(mcQ2.id)]: 'X', // wrong
        },
      })

      // Attempt 2: null answers (should be skipped)
      recordAttempt({
        quiz_id: quiz.id,
        score: 2,
        total_questions: 3,
      })

      const weakAreas = getWeakAreas()

      // Should have entries for type-based and difficulty-based groupings
      expect(weakAreas.length).toBeGreaterThan(0)

      // Check that the type-based groupings are correct
      const mcTypeArea = weakAreas.find((w) => w.category === 'type' && w.label === 'multiple-choice')
      expect(mcTypeArea).toBeDefined()
      // 2 MC questions, 1 wrong = 50% error rate
      expect(mcTypeArea!.total_count).toBe(2)
      expect(mcTypeArea!.error_count).toBe(1)
      expect(mcTypeArea!.error_rate).toBeCloseTo(0.5, 2)

      const tfTypeArea = weakAreas.find((w) => w.category === 'type' && w.label === 'true-false')
      expect(tfTypeArea).toBeDefined()
      // 1 TF question, 1 wrong = 100% error rate
      expect(tfTypeArea!.total_count).toBe(1)
      expect(tfTypeArea!.error_count).toBe(1)
      expect(tfTypeArea!.error_rate).toBeCloseTo(1.0, 2)
    })
  })

  // ─── exportHistoryAsJson ──────────────────────────────────────

  describe('exportHistoryAsJson', () => {
    it('should write data to file and return path (mock dialog)', async () => {
      const { dialog } = await import('electron')
      const { exportHistoryAsJson } = await import('@main/services/file-service')

      const exportPath = path.join(tmpDir, 'export.json')
      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: false,
        filePath: exportPath,
      })

      const result = await exportHistoryAsJson('{"data":"test"}', 'quiz-history.json')

      expect(result).toBe(exportPath)
      expect(fs.existsSync(exportPath)).toBe(true)
      expect(fs.readFileSync(exportPath, 'utf-8')).toBe('{"data":"test"}')
    })

    it('should return null if dialog is cancelled', async () => {
      const { dialog } = await import('electron')
      const { exportHistoryAsJson } = await import('@main/services/file-service')

      vi.mocked(dialog.showSaveDialog).mockResolvedValue({
        canceled: true,
        filePath: '',
      })

      const result = await exportHistoryAsJson('{"data":"test"}', 'quiz-history.json')

      expect(result).toBeNull()
    })
  })
})
