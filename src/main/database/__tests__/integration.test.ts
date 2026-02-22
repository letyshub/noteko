import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from '@main/database/schema'
import { projects, folders, documents, documentContent, appLogs } from '@main/database/schema'

// Mock electron module since tests run outside Electron
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue(os.tmpdir()),
  },
}))

// Mock electron-log to prevent side effects
vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
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

describe('integration tests - gap coverage', () => {
  describe('connection lifecycle', () => {
    afterEach(() => {
      vi.resetModules()
    })

    it('should throw when getDb() is called before initializeDatabase()', async () => {
      const { getDb } = await import('@main/database/connection')

      expect(() => getDb()).toThrow('Database not initialized. Call initializeDatabase() first.')
    })

    it('should support init-close-reinit lifecycle', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-lifecycle-'))

      try {
        const { initializeDatabase, closeDatabase, getDb } = await import('@main/database/connection')

        // First init
        const dbPath = path.join(tmpDir, 'lifecycle.db')
        initializeDatabase(dbPath)
        expect(() => getDb()).not.toThrow()

        // Close
        closeDatabase()

        // getDb should throw after close
        expect(() => getDb()).toThrow('Database not initialized')

        // Reinit with same path
        vi.resetModules()
        const mod = await import('@main/database/connection')
        mod.initializeDatabase(dbPath)
        expect(() => mod.getDb()).not.toThrow()

        mod.closeDatabase()
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    })
  })

  describe('schema type exports', () => {
    it('should export all 16 inferred types (8 Select + 8 Insert) from the schema barrel', async () => {
      // Dynamically import to check what the barrel exports
      const schemaModule = await import('@main/database/schema')

      // Select types (these exist as type-only exports, so we verify via the barrel's index.ts)
      // In TypeScript, type-only exports are erased at runtime, so we verify the barrel file
      // contains the type export statements
      const barrelPath = path.resolve(__dirname, '../schema/index.ts')
      const barrelContent = fs.readFileSync(barrelPath, 'utf-8')

      // Select model types
      const selectTypes = [
        'Project',
        'Folder',
        'Document',
        'DocumentContent',
        'Quiz',
        'QuizQuestion',
        'QuizAttempt',
        'AppLog',
      ]

      // Insert model types
      const insertTypes = [
        'NewProject',
        'NewFolder',
        'NewDocument',
        'NewDocumentContent',
        'NewQuiz',
        'NewQuizQuestion',
        'NewQuizAttempt',
        'NewAppLog',
      ]

      for (const typeName of selectTypes) {
        expect(barrelContent, `Missing select type export: ${typeName}`).toContain(`type ${typeName}`)
      }

      for (const typeName of insertTypes) {
        expect(barrelContent, `Missing insert type export: ${typeName}`).toContain(`type ${typeName}`)
      }

      // Also verify the table definition re-exports exist at runtime
      expect(schemaModule.projects).toBeDefined()
      expect(schemaModule.folders).toBeDefined()
      expect(schemaModule.documents).toBeDefined()
      expect(schemaModule.documentContent).toBeDefined()
      expect(schemaModule.quizzes).toBeDefined()
      expect(schemaModule.quizQuestions).toBeDefined()
      expect(schemaModule.quizAttempts).toBeDefined()
      expect(schemaModule.appLogs).toBeDefined()
    })
  })

  describe('foreign key constraint enforcement', () => {
    let tmpDir: string
    let sqlite: Database.Database
    let db: BetterSQLite3Database<typeof schema>

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-fk-test-'))
      const dbPath = path.join(tmpDir, 'fk-test.db')
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

    it('should reject inserting a folder with a non-existent project_id', () => {
      expect(() => {
        db.insert(folders)
          .values({
            name: 'Invalid Folder',
            project_id: 9999,
            created_at: new Date().toISOString(),
          })
          .run()
      }).toThrow()
    })
  })

  describe('JSON column serialization', () => {
    let tmpDir: string
    let sqlite: Database.Database
    let db: BetterSQLite3Database<typeof schema>

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-json-test-'))
      const dbPath = path.join(tmpDir, 'json-test.db')
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

    it('should round-trip JSON data through insert and select for key_points column', () => {
      // Insert a project, folder, and document first (FK requirements)
      const [project] = db
        .insert(projects)
        .values({
          name: 'JSON Test Project',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returning()
        .all()

      const [folder] = db
        .insert(folders)
        .values({
          name: 'JSON Test Folder',
          project_id: project.id,
          created_at: new Date().toISOString(),
        })
        .returning()
        .all()

      const [doc] = db
        .insert(documents)
        .values({
          name: 'test.pdf',
          file_path: '/test/test.pdf',
          file_type: 'pdf',
          file_size: 1000,
          folder_id: folder.id,
          project_id: project.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .returning()
        .all()

      const keyPoints = ['Point one', 'Point two', 'Point three']

      db.insert(documentContent)
        .values({
          document_id: doc.id,
          raw_text: 'Test content',
          summary: 'Test summary',
          key_points: keyPoints,
          processed_at: new Date().toISOString(),
        })
        .run()

      // Read back and verify JSON round-trip
      const rows = sqlite.prepare('SELECT key_points FROM document_content WHERE document_id = ?').all(doc.id) as {
        key_points: string
      }[]
      const parsed = JSON.parse(rows[0].key_points)

      expect(parsed).toEqual(keyPoints)
    })

    it('should round-trip JSON data through insert and select for app_logs context column', () => {
      const contextData = { userId: 42, action: 'login', metadata: { browser: 'chrome', version: '120' } }

      db.insert(appLogs)
        .values({
          level: 'info',
          message: 'JSON round-trip test',
          context: contextData,
          created_at: new Date().toISOString(),
        })
        .run()

      // Read back and verify JSON round-trip
      const rows = sqlite.prepare('SELECT context FROM app_logs WHERE message = ?').all('JSON round-trip test') as {
        context: string
      }[]
      const parsed = JSON.parse(rows[0].context)

      expect(parsed).toEqual(contextData)
    })
  })

  describe('npm scripts', () => {
    it('should have db:push and db:generate scripts in package.json', () => {
      const packageJsonPath = path.resolve(__dirname, '../../../../package.json')
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

      expect(packageJson.scripts['db:push']).toBe('drizzle-kit push')
      expect(packageJson.scripts['db:generate']).toBe('drizzle-kit generate')
      expect(packageJson.scripts['db:seed']).toBe('tsx src/main/database/seed.ts')
    })
  })
})
