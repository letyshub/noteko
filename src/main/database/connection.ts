import Database from 'better-sqlite3'
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import log from 'electron-log'
import * as schema from './schema'

let sqlite: Database.Database | null = null
let db: BetterSQLite3Database<typeof schema> | null = null

/**
 * Resolve the database file path.
 * - Production: stored in the user data directory (e.g. AppData/Roaming/Noteko)
 * - Development: stored in the project root as noteko-dev.db
 */
const getDbPath = (): string => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'noteko.db')
  }
  return path.join(process.cwd(), 'noteko-dev.db')
}

/**
 * Initialize the SQLite database connection and Drizzle ORM client.
 * Enables WAL journal mode and foreign key enforcement.
 *
 * @param dbPath - Optional path override, primarily for test isolation.
 */
const initializeDatabase = (dbPath?: string): void => {
  try {
    const resolvedPath = dbPath ?? getDbPath()
    sqlite = new Database(resolvedPath)

    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')

    runMigrations(sqlite)

    db = drizzle(sqlite, { schema })

    log.info(`Database initialized at ${resolvedPath}`)
  } catch (error) {
    log.error('Failed to initialize database:', error)
    throw error
  }
}

/**
 * Run lightweight schema migrations to add columns that were introduced
 * after the initial table creation.  Each migration is idempotent — it
 * checks whether the column already exists via PRAGMA table_info before
 * attempting ALTER TABLE.
 */
const runMigrations = (db: Database.Database): void => {
  const tableExists = (table: string): boolean => {
    const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table) as unknown
    return row != null
  }

  const hasColumn = (table: string, column: string): boolean => {
    const cols = db.pragma(`table_info(${table})`) as Array<{ name: string }>
    return cols.some((c) => c.name === column)
  }

  // Only migrate tables that already exist (skip on fresh databases)
  if (tableExists('document_content')) {
    if (!hasColumn('document_content', 'key_terms')) {
      db.exec('ALTER TABLE document_content ADD COLUMN key_terms TEXT')
      log.info('[migration] Added document_content.key_terms')
    }
    if (!hasColumn('document_content', 'summary_style')) {
      db.exec('ALTER TABLE document_content ADD COLUMN summary_style TEXT')
      log.info('[migration] Added document_content.summary_style')
    }
  }

  if (tableExists('app_logs')) {
    if (!hasColumn('app_logs', 'category')) {
      db.exec('ALTER TABLE app_logs ADD COLUMN category TEXT')
      log.info('[migration] Added app_logs.category')
    }
  }

  if (tableExists('quizzes')) {
    if (!hasColumn('quizzes', 'question_count')) {
      db.exec('ALTER TABLE quizzes ADD COLUMN question_count INTEGER')
      log.info('[migration] Added quizzes.question_count')
    }
    if (!hasColumn('quizzes', 'difficulty_level')) {
      db.exec('ALTER TABLE quizzes ADD COLUMN difficulty_level TEXT')
      log.info('[migration] Added quizzes.difficulty_level')
    }
    if (!hasColumn('quizzes', 'question_types')) {
      db.exec('ALTER TABLE quizzes ADD COLUMN question_types TEXT')
      log.info('[migration] Added quizzes.question_types')
    }
  }

  if (tableExists('quiz_questions')) {
    if (!hasColumn('quiz_questions', 'type')) {
      db.exec('ALTER TABLE quiz_questions ADD COLUMN type TEXT')
      log.info('[migration] Added quiz_questions.type')
    }
    if (!hasColumn('quiz_questions', 'difficulty')) {
      db.exec('ALTER TABLE quiz_questions ADD COLUMN difficulty TEXT')
      log.info('[migration] Added quiz_questions.difficulty')
    }
    if (!hasColumn('quiz_questions', 'explanation')) {
      db.exec('ALTER TABLE quiz_questions ADD COLUMN explanation TEXT')
      log.info('[migration] Added quiz_questions.explanation')
    }
  }

  // FTS5 full-text search index on document_content
  if (tableExists('document_content')) {
    const ftsExists = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='documents_fts'")
      .get() as unknown
    if (ftsExists == null) {
      // Create FTS5 virtual table using external content mode (no data duplication)
      db.exec(`
        CREATE VIRTUAL TABLE documents_fts USING fts5(
          raw_text,
          summary,
          content='document_content',
          content_rowid='id'
        )
      `)
      log.info('[migration] Created documents_fts virtual table')

      // AFTER INSERT trigger: sync new rows into FTS5
      db.exec(`
        CREATE TRIGGER documents_fts_ai AFTER INSERT ON document_content BEGIN
          INSERT INTO documents_fts(rowid, raw_text, summary)
          VALUES (NEW.id, NEW.raw_text, NEW.summary);
        END
      `)
      log.info('[migration] Created documents_fts AFTER INSERT trigger')

      // AFTER UPDATE trigger: delete old entry then insert new entry (required for external content mode)
      db.exec(`
        CREATE TRIGGER documents_fts_au AFTER UPDATE ON document_content BEGIN
          INSERT INTO documents_fts(documents_fts, rowid, raw_text, summary)
          VALUES('delete', OLD.id, OLD.raw_text, OLD.summary);
          INSERT INTO documents_fts(rowid, raw_text, summary)
          VALUES (NEW.id, NEW.raw_text, NEW.summary);
        END
      `)
      log.info('[migration] Created documents_fts AFTER UPDATE trigger')

      // AFTER DELETE trigger: remove entry from FTS5
      db.exec(`
        CREATE TRIGGER documents_fts_ad AFTER DELETE ON document_content BEGIN
          INSERT INTO documents_fts(documents_fts, rowid, raw_text, summary)
          VALUES('delete', OLD.id, OLD.raw_text, OLD.summary);
        END
      `)
      log.info('[migration] Created documents_fts AFTER DELETE trigger')

      // Backfill: index all existing document_content rows with non-null raw_text
      db.exec(`
        INSERT INTO documents_fts(rowid, raw_text, summary)
        SELECT id, raw_text, summary FROM document_content WHERE raw_text IS NOT NULL
      `)
      log.info('[migration] Backfilled documents_fts from existing document_content rows')
    }
  }

  // Recent searches table for search history
  if (!tableExists('recent_searches')) {
    db.exec(`
      CREATE TABLE recent_searches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        result_count INTEGER NOT NULL DEFAULT 0,
        searched_at TEXT NOT NULL
      )
    `)
    log.info('[migration] Created recent_searches table')
  }
}

/**
 * Close the database connection and release resources.
 */
const closeDatabase = (): void => {
  if (sqlite) {
    sqlite.close()
    log.info('Database connection closed')
  }
  sqlite = null
  db = null
}

/**
 * Get the Drizzle ORM database client.
 * Throws if the database has not been initialized.
 */
const getDb = (): BetterSQLite3Database<typeof schema> => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

export { initializeDatabase, closeDatabase, getDb, runMigrations }
