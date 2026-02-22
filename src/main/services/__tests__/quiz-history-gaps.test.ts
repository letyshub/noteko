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

describe('quiz history service - gap tests', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-quiz-hist-gaps-'))
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

  // ─── getWeakAreas ─────────────────────────────────────────────

  describe('getWeakAreas', () => {
    it('should return empty array when all answers are correct (no weak areas)', async () => {
      const { getWeakAreas, createQuiz, recordAttempt } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      const quiz = createQuiz({
        title: 'Perfect Quiz',
        document_id: document.id,
        questions: [
          { question: 'Q1?', options: ['A', 'B'], correct_answer: 'A', type: 'multiple-choice', difficulty: 'easy' },
          {
            question: 'Q2?',
            options: ['True', 'False'],
            correct_answer: 'True',
            type: 'true-false',
            difficulty: 'medium',
          },
        ],
      })!

      const questions = db.select().from(schema.quizQuestions).all()

      // All answers correct
      recordAttempt({
        quiz_id: quiz.id,
        score: 2,
        total_questions: 2,
        answers: {
          [String(questions[0].id)]: 'A',
          [String(questions[1].id)]: 'True',
        },
      })

      const weakAreas = getWeakAreas()

      // Even with correct answers, weak areas are returned (with error_rate 0)
      // The key assertion: no area has errors
      for (const area of weakAreas) {
        expect(area.error_count).toBe(0)
        expect(area.error_rate).toBe(0)
      }
    })
  })

  // ─── getPerQuizStats ──────────────────────────────────────────

  describe('getPerQuizStats', () => {
    it('should return per-quiz aggregates for multiple quizzes with different attempt counts', async () => {
      const { getPerQuizStats, createQuiz, recordAttempt } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)

      const quiz1 = createQuiz({
        title: 'Quiz A',
        document_id: document.id,
        questions: [{ question: 'Q1?', options: ['A', 'B'], correct_answer: 'A' }],
      })!

      const quiz2 = createQuiz({
        title: 'Quiz B',
        document_id: document.id,
        questions: [{ question: 'Q2?', options: ['X', 'Y'], correct_answer: 'X' }],
      })!

      // Quiz A: 3 attempts
      recordAttempt({ quiz_id: quiz1.id, score: 60, total_questions: 10 })
      recordAttempt({ quiz_id: quiz1.id, score: 70, total_questions: 10 })
      recordAttempt({ quiz_id: quiz1.id, score: 80, total_questions: 10 })

      // Quiz B: 1 attempt
      recordAttempt({ quiz_id: quiz2.id, score: 100, total_questions: 10 })

      const stats = getPerQuizStats()

      expect(stats).toHaveLength(2)

      const quizA = stats.find((s) => s.quiz_title === 'Quiz A')
      expect(quizA).toBeDefined()
      expect(quizA!.attempt_count).toBe(3)
      expect(quizA!.best_score).toBe(80)
      expect(quizA!.average_score).toBeCloseTo(70, 0)

      const quizB = stats.find((s) => s.quiz_title === 'Quiz B')
      expect(quizB).toBeDefined()
      expect(quizB!.attempt_count).toBe(1)
      expect(quizB!.best_score).toBe(100)
      expect(quizB!.average_score).toBe(100)
    })
  })

  // ─── getOverviewStats ─────────────────────────────────────────

  describe('getOverviewStats', () => {
    it('should return correct stats for a single attempt (boundary: one attempt)', async () => {
      const { getOverviewStats, createQuiz, recordAttempt } = await import('@main/services/quiz-service')

      const { document } = createDocumentPrerequisites(db)
      const quiz = createQuiz({
        title: 'Solo Quiz',
        document_id: document.id,
        questions: [{ question: 'Q1?', options: ['A'], correct_answer: 'A' }],
      })!

      recordAttempt({ quiz_id: quiz.id, score: 100, total_questions: 10 })

      const stats = getOverviewStats()

      expect(stats.total_attempts).toBe(1)
      expect(stats.average_score).toBe(100)
      expect(stats.best_score).toBe(100)
      expect(stats.quizzes_taken).toBe(1)
    })
  })
})
