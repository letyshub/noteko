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

    db = drizzle(sqlite, { schema })

    log.info(`Database initialized at ${resolvedPath}`)
  } catch (error) {
    log.error('Failed to initialize database:', error)
    throw error
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

export { initializeDatabase, closeDatabase, getDb }
