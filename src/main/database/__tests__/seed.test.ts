import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from '@main/database/schema'
import { seed } from '@main/database/seed'

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
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS document_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      raw_text TEXT,
      summary TEXT,
      key_points TEXT,
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
  `)
}

describe('seed script', () => {
  let tmpDir: string
  let dbPath: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-seed-test-'))
    dbPath = path.join(tmpDir, 'test-seed.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    createTables(sqlite)
    db = drizzle(sqlite, { schema })
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should populate all 8 tables with data', () => {
    seed(db)

    const tables = [
      'projects',
      'folders',
      'documents',
      'document_content',
      'quizzes',
      'quiz_questions',
      'quiz_attempts',
      'app_logs',
    ] as const

    for (const table of tables) {
      const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
      expect(result.count, `Expected ${table} to have rows`).toBeGreaterThan(0)
    }
  })

  it('should be idempotent (running twice produces the same row counts)', () => {
    seed(db)

    const getRowCounts = (): Record<string, number> => {
      const tables = [
        'projects',
        'folders',
        'documents',
        'document_content',
        'quizzes',
        'quiz_questions',
        'quiz_attempts',
        'app_logs',
      ]
      const counts: Record<string, number> = {}
      for (const table of tables) {
        const result = sqlite.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number }
        counts[table] = result.count
      }
      return counts
    }

    const firstRunCounts = getRowCounts()

    seed(db)

    const secondRunCounts = getRowCounts()

    expect(secondRunCounts).toEqual(firstRunCounts)
  })

  it('should maintain valid foreign key relationships', () => {
    seed(db)

    // All folder.project_id values should exist in projects
    const invalidFolderProjects = sqlite
      .prepare('SELECT f.id FROM folders f LEFT JOIN projects p ON f.project_id = p.id WHERE p.id IS NULL')
      .all()
    expect(invalidFolderProjects, 'All folder project_id values should reference valid projects').toHaveLength(0)

    // All folder.parent_folder_id values (when not null) should exist in folders
    const invalidParentFolders = sqlite
      .prepare(
        'SELECT f.id FROM folders f LEFT JOIN folders p ON f.parent_folder_id = p.id WHERE f.parent_folder_id IS NOT NULL AND p.id IS NULL',
      )
      .all()
    expect(invalidParentFolders, 'All parent_folder_id values should reference valid folders').toHaveLength(0)

    // All document.folder_id values should exist in folders
    const invalidDocFolders = sqlite
      .prepare('SELECT d.id FROM documents d LEFT JOIN folders f ON d.folder_id = f.id WHERE f.id IS NULL')
      .all()
    expect(invalidDocFolders, 'All document folder_id values should reference valid folders').toHaveLength(0)

    // All document.project_id values should exist in projects
    const invalidDocProjects = sqlite
      .prepare('SELECT d.id FROM documents d LEFT JOIN projects p ON d.project_id = p.id WHERE p.id IS NULL')
      .all()
    expect(invalidDocProjects, 'All document project_id values should reference valid projects').toHaveLength(0)

    // All quiz.document_id values should exist in documents
    const invalidQuizDocs = sqlite
      .prepare('SELECT q.id FROM quizzes q LEFT JOIN documents d ON q.document_id = d.id WHERE d.id IS NULL')
      .all()
    expect(invalidQuizDocs, 'All quiz document_id values should reference valid documents').toHaveLength(0)

    // All quiz_questions.quiz_id values should exist in quizzes
    const invalidQuestionQuizzes = sqlite
      .prepare('SELECT qq.id FROM quiz_questions qq LEFT JOIN quizzes q ON qq.quiz_id = q.id WHERE q.id IS NULL')
      .all()
    expect(invalidQuestionQuizzes, 'All quiz_questions quiz_id values should reference valid quizzes').toHaveLength(0)

    // All quiz_attempts.quiz_id values should exist in quizzes
    const invalidAttemptQuizzes = sqlite
      .prepare('SELECT qa.id FROM quiz_attempts qa LEFT JOIN quizzes q ON qa.quiz_id = q.id WHERE q.id IS NULL')
      .all()
    expect(invalidAttemptQuizzes, 'All quiz_attempts quiz_id values should reference valid quizzes').toHaveLength(0)

    // All document_content.document_id values should exist in documents
    const invalidContentDocs = sqlite
      .prepare(
        'SELECT dc.id FROM document_content dc LEFT JOIN documents d ON dc.document_id = d.id WHERE d.id IS NULL',
      )
      .all()
    expect(invalidContentDocs, 'All document_content document_id values should reference valid documents').toHaveLength(
      0,
    )
  })
})
