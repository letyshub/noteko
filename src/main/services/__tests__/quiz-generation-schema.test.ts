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

/**
 * Creates the full schema including the new quiz generation columns.
 * The new columns (type, difficulty on quiz_questions; question_count,
 * difficulty_level, question_types on quizzes) are nullable for backward
 * compatibility.
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

describe('quiz generation - schema and service extensions', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-quiz-gen-test-'))
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

  it('should accept type and difficulty fields on quiz questions via createQuiz()', async () => {
    const { createQuiz, getQuizWithQuestions } = await import('@main/services/quiz-service')

    const { document } = createDocumentPrerequisites(db)
    const quiz = createQuiz({
      title: 'Typed Quiz',
      document_id: document.id,
      questions: [
        {
          question: 'True or false: The sky is blue.',
          correct_answer: 'true',
          type: 'true-false',
          difficulty: 'easy',
        },
        {
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correct_answer: '4',
          type: 'multiple-choice',
          difficulty: 'hard',
        },
      ],
    })

    expect(quiz).toBeDefined()

    const result = getQuizWithQuestions(quiz!.id)
    expect(result).toBeDefined()
    expect(result!.questions).toHaveLength(2)

    const tfQuestion = result!.questions.find((q) => q.question.includes('True or false'))!
    expect(tfQuestion.type).toBe('true-false')
    expect(tfQuestion.difficulty).toBe('easy')

    const mcQuestion = result!.questions.find((q) => q.question.includes('2+2'))!
    expect(mcQuestion.type).toBe('multiple-choice')
    expect(mcQuestion.difficulty).toBe('hard')
  })

  it('should accept question_count, difficulty_level, and question_types metadata on quizzes via createQuiz()', async () => {
    const { createQuiz, getQuiz } = await import('@main/services/quiz-service')

    const { document } = createDocumentPrerequisites(db)
    const quiz = createQuiz({
      title: 'Metadata Quiz',
      document_id: document.id,
      question_count: 5,
      difficulty_level: 'hard',
      question_types: 'multiple-choice,true-false',
      questions: [
        {
          question: 'Sample question?',
          options: ['A', 'B'],
          correct_answer: 'A',
        },
      ],
    })

    expect(quiz).toBeDefined()

    const fetched = getQuiz(quiz!.id)
    expect(fetched).toBeDefined()
    expect(fetched!.question_count).toBe(5)
    expect(fetched!.difficulty_level).toBe('hard')
    expect(fetched!.question_types).toBe('multiple-choice,true-false')
  })

  it('should wrap quiz + questions insert in a transaction (partial failure does not leave orphaned quiz)', async () => {
    const { createQuiz } = await import('@main/services/quiz-service')

    const { document } = createDocumentPrerequisites(db)

    // Provide a question with a null correct_answer to trigger a NOT NULL constraint violation
    // The transaction should roll back, leaving no orphaned quiz record
    expect(() => {
      createQuiz({
        title: 'Should Rollback',
        document_id: document.id,
        questions: [
          {
            question: 'Valid question?',
            options: ['A', 'B'],
            correct_answer: 'A',
          },
          {
            question: 'Bad question?',
            options: ['X', 'Y'],
            correct_answer: null as unknown as string, // Force NOT NULL violation
          },
        ],
      })
    }).toThrow()

    // Verify no orphaned quiz was left behind
    const allQuizzes = db.select().from(schema.quizzes).all()
    expect(allQuizzes).toHaveLength(0)
  })

  it('should still work with existing createQuiz() calls without new fields (backward compatibility)', async () => {
    const { createQuiz, getQuiz, getQuizWithQuestions } = await import('@main/services/quiz-service')

    const { document } = createDocumentPrerequisites(db)

    // Call createQuiz exactly like existing code does - no type, difficulty, or metadata fields
    const quiz = createQuiz({
      title: 'Legacy Quiz',
      document_id: document.id,
      questions: [
        {
          question: 'What color is the sky?',
          options: ['Red', 'Blue', 'Green'],
          correct_answer: 'Blue',
          explanation: 'The sky appears blue due to Rayleigh scattering.',
        },
      ],
    })

    expect(quiz).toBeDefined()
    expect(quiz!.title).toBe('Legacy Quiz')

    // Verify quiz metadata fields default to null
    const fetchedQuiz = getQuiz(quiz!.id)
    expect(fetchedQuiz!.question_count).toBeNull()
    expect(fetchedQuiz!.difficulty_level).toBeNull()
    expect(fetchedQuiz!.question_types).toBeNull()

    // Verify question type/difficulty fields default to null
    const result = getQuizWithQuestions(quiz!.id)
    expect(result!.questions).toHaveLength(1)
    expect(result!.questions[0].type).toBeNull()
    expect(result!.questions[0].difficulty).toBeNull()

    // Verify existing fields still work
    expect(result!.questions[0].question).toBe('What color is the sky?')
    expect(result!.questions[0].correct_answer).toBe('Blue')
    expect(result!.questions[0].explanation).toBe('The sky appears blue due to Rayleigh scattering.')
  })
})
