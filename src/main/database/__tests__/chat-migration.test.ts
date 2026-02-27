import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'

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

/**
 * Helper to create all prerequisite tables that `runMigrations` expects,
 * mirroring the Drizzle schema definitions.
 */
const createPrerequisiteTables = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      parent_folder_id INTEGER REFERENCES folders(id),
      created_at TEXT NOT NULL
    );
  `)

  db.exec(`
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
  `)

  db.exec(`
    CREATE TABLE IF NOT EXISTS document_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL UNIQUE REFERENCES documents(id),
      raw_text TEXT,
      summary TEXT,
      key_points TEXT,
      key_terms TEXT,
      summary_style TEXT,
      processed_at TEXT
    );
  `)
}

/**
 * Helper to seed a project + folder + document chain and return the document id.
 */
const insertDocument = (db: Database.Database, name = 'test.pdf'): number => {
  const existingProject = db.prepare('SELECT id FROM projects WHERE id = 1').get()
  if (!existingProject) {
    db.prepare('INSERT INTO projects (id, name, created_at, updated_at) VALUES (1, ?, ?, ?)').run(
      'Test Project',
      new Date().toISOString(),
      new Date().toISOString(),
    )
  }
  const existingFolder = db.prepare('SELECT id FROM folders WHERE id = 1').get()
  if (!existingFolder) {
    db.prepare('INSERT INTO folders (id, name, project_id, created_at) VALUES (1, ?, 1, ?)').run(
      'Test Folder',
      new Date().toISOString(),
    )
  }

  const result = db
    .prepare(
      'INSERT INTO documents (name, file_path, file_type, file_size, folder_id, project_id, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 1, ?, ?)',
    )
    .run(name, `/path/${name}`, 'pdf', 1024, new Date().toISOString(), new Date().toISOString())

  return result.lastInsertRowid as number
}

describe('Chat conversations and messages schema', () => {
  let tmpDir: string
  let sqlite: Database.Database

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-chat-'))
    const dbPath = path.join(tmpDir, 'test.db')
    sqlite = new Database(dbPath)
    sqlite.pragma('journal_mode = WAL')
    sqlite.pragma('foreign_keys = ON')
    createPrerequisiteTables(sqlite)
  })

  afterEach(() => {
    sqlite.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
    vi.resetModules()
  })

  it('should create chat_conversations table via migration', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Verify table exists
    const tableRow = sqlite
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='chat_conversations'")
      .get()
    expect(tableRow).toBeDefined()

    // Insert a conversation and verify round-trip
    const docId = insertDocument(sqlite)
    sqlite
      .prepare('INSERT INTO chat_conversations (document_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(docId, 'Test Chat', new Date().toISOString(), new Date().toISOString())

    const conv = sqlite.prepare('SELECT * FROM chat_conversations WHERE id = 1').get() as {
      id: number
      document_id: number
      title: string
      created_at: string
      updated_at: string
    }
    expect(conv).toBeDefined()
    expect(conv.id).toBe(1)
    expect(conv.document_id).toBe(docId)
    expect(conv.title).toBe('Test Chat')
    expect(conv.created_at).toBeTruthy()
    expect(conv.updated_at).toBeTruthy()
  })

  it('should create chat_messages table via migration', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Create prerequisite data
    const docId = insertDocument(sqlite)
    sqlite
      .prepare('INSERT INTO chat_conversations (document_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(docId, 'Test Chat', new Date().toISOString(), new Date().toISOString())
    const convId = 1

    // Insert a message and verify round-trip
    sqlite
      .prepare('INSERT INTO chat_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)')
      .run(convId, 'user', 'Hello, what is this document about?', new Date().toISOString())

    const msg = sqlite.prepare('SELECT * FROM chat_messages WHERE id = 1').get() as {
      id: number
      conversation_id: number
      role: string
      content: string
      created_at: string
    }
    expect(msg).toBeDefined()
    expect(msg.id).toBe(1)
    expect(msg.conversation_id).toBe(convId)
    expect(msg.role).toBe('user')
    expect(msg.content).toBe('Hello, what is this document about?')
    expect(msg.created_at).toBeTruthy()
  })

  it('should enforce FK constraint: chat_conversations.document_id references documents.id', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Attempt to insert a conversation referencing a non-existent document
    expect(() => {
      sqlite
        .prepare('INSERT INTO chat_conversations (document_id, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
        .run(9999, 'Bad Chat', new Date().toISOString(), new Date().toISOString())
    }).toThrow()
  })

  it('should enforce FK constraint: chat_messages.conversation_id references chat_conversations.id', async () => {
    const { runMigrations } = await import('@main/database/connection')
    runMigrations(sqlite)

    // Attempt to insert a message referencing a non-existent conversation
    expect(() => {
      sqlite
        .prepare('INSERT INTO chat_messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)')
        .run(9999, 'user', 'Orphan message', new Date().toISOString())
    }).toThrow()
  })
})
