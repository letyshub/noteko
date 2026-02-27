import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import * as schema from '@main/database/schema'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Test DB setup
// ---------------------------------------------------------------------------

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

    CREATE TABLE IF NOT EXISTS chat_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id INTEGER NOT NULL REFERENCES documents(id),
      title TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES chat_conversations(id),
      role TEXT NOT NULL,
      content TEXT NOT NULL,
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('chat-service', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-chat-test-'))
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

  // ─── getOrCreateConversation ──────────────────────────────────

  it('should create a conversation on first call and return existing on second call for same documentId', async () => {
    const { document } = createDocumentPrerequisites(db)

    const { getOrCreateConversation } = await import('@main/services/chat-service')

    const conv1 = getOrCreateConversation(document.id)
    expect(conv1).toBeDefined()
    expect(conv1!.id).toBeTypeOf('number')
    expect(conv1!.document_id).toBe(document.id)

    const conv2 = getOrCreateConversation(document.id)
    expect(conv2).toBeDefined()
    expect(conv2!.id).toBe(conv1!.id) // Same conversation returned
  })

  // ─── addMessage + listMessages ────────────────────────────────

  it('should add messages and list them in creation order', async () => {
    const { document } = createDocumentPrerequisites(db)

    const { getOrCreateConversation, addMessage, listMessages } = await import('@main/services/chat-service')

    const conv = getOrCreateConversation(document.id)!

    addMessage(conv.id, 'user', 'Hello, what is this document about?')
    addMessage(conv.id, 'assistant', 'This document discusses testing patterns.')

    const messages = listMessages(conv.id)
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('user')
    expect(messages[0].content).toBe('Hello, what is this document about?')
    expect(messages[1].role).toBe('assistant')
    expect(messages[1].content).toBe('This document discusses testing patterns.')
  })

  // ─── deleteConversation ───────────────────────────────────────

  it('should delete a conversation and its cascaded messages', async () => {
    const { document } = createDocumentPrerequisites(db)

    const { getOrCreateConversation, addMessage, listMessages, deleteConversation } =
      await import('@main/services/chat-service')

    const conv = getOrCreateConversation(document.id)!
    addMessage(conv.id, 'user', 'Test message')
    addMessage(conv.id, 'assistant', 'Test reply')

    // Verify messages exist
    expect(listMessages(conv.id)).toHaveLength(2)

    // Delete the conversation
    deleteConversation(conv.id)

    // Verify messages are gone
    expect(listMessages(conv.id)).toHaveLength(0)

    // Verify conversation is gone (creating again should give a new id)
    const newConv = getOrCreateConversation(document.id)!
    expect(newConv.id).not.toBe(conv.id)
  })
})
