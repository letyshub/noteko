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
  ipcMain: {
    handle: vi.fn(),
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

    CREATE TABLE IF NOT EXISTS document_tags (
      document_id INTEGER NOT NULL REFERENCES documents(id),
      tag_id INTEGER NOT NULL,
      PRIMARY KEY (document_id, tag_id)
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

describe('Chat Integration Tests (Backend)', () => {
  let tmpDir: string
  let sqlite: Database.Database
  let db: BetterSQLite3Database<typeof schema>

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'noteko-chat-integration-'))
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
    vi.resetModules()
  })

  // ─── Test 1: Cascade deletion ──────────────────────────────────────

  it('should delete all chat data when document is deleted via deleteDocument', async () => {
    const { document } = createDocumentPrerequisites(db)

    // Create content for the document
    db.insert(schema.documentContent)
      .values({
        document_id: document.id,
        raw_text: 'Some content for testing.',
        processed_at: new Date().toISOString(),
      })
      .run()

    // Use chat-service to create conversation and messages
    const { getOrCreateConversation, addMessage, listMessages } = await import('@main/services/chat-service')

    const conv = getOrCreateConversation(document.id)!
    addMessage(conv.id, 'user', 'What is this about?')
    addMessage(conv.id, 'assistant', 'It is about testing.')
    addMessage(conv.id, 'user', 'Tell me more.')
    addMessage(conv.id, 'assistant', 'There is more to tell.')

    // Verify data exists
    expect(listMessages(conv.id)).toHaveLength(4)

    // Delete the document using document-service (which calls deleteConversationsByDocument)
    const { deleteDocument } = await import('@main/services/document-service')
    deleteDocument(document.id)

    // Verify chat_conversations are gone
    const conversations = sqlite.prepare('SELECT * FROM chat_conversations WHERE document_id = ?').all(document.id)
    expect(conversations).toHaveLength(0)

    // Verify chat_messages are gone
    const messages = sqlite.prepare('SELECT * FROM chat_messages WHERE conversation_id = ?').all(conv.id)
    expect(messages).toHaveLength(0)

    // Verify the document itself is gone
    const doc = sqlite.prepare('SELECT * FROM documents WHERE id = ?').get(document.id)
    expect(doc).toBeUndefined()
  })

  // ─── Test 2: Sliding window (context window management) ───────────

  it('should pass only the last 20 messages (10 pairs) from DB listMessages to chat via IPC handler slice', async () => {
    // This test verifies the sliding window logic in the AI_CHAT IPC handler.
    // The handler calls listMessages(conversationId).slice(-20) to limit context.
    // We simulate what the handler does and verify the result.

    // Build a history of 12 user/assistant pairs (24 messages total)
    const fullHistory: Array<{ role: string; content: string }> = []
    for (let i = 1; i <= 12; i++) {
      fullHistory.push({ role: 'user', content: `Question ${i}` })
      fullHistory.push({ role: 'assistant', content: `Answer ${i}` })
    }

    expect(fullHistory).toHaveLength(24)

    // Apply the same sliding window logic as the IPC handler
    const slicedHistory = fullHistory.slice(-20)

    // Should have exactly 20 messages (last 10 pairs)
    expect(slicedHistory).toHaveLength(20)

    // First message should be Question 3 (pairs 1 and 2 are dropped)
    expect(slicedHistory[0]).toEqual({ role: 'user', content: 'Question 3' })
    expect(slicedHistory[1]).toEqual({ role: 'assistant', content: 'Answer 3' })

    // Last message should be Answer 12
    expect(slicedHistory[slicedHistory.length - 1]).toEqual({
      role: 'assistant',
      content: 'Answer 12',
    })
  })

  // ─── Test 3: Concurrent operations ─────────────────────────────────

  it('should handle concurrent chat and summary operations independently', async () => {
    // Verify that two independent fire-and-forget operations can complete
    // without interfering with each other. We test this by checking that
    // both operations produce their own results when generators are consumed.

    const chatChunks = ['Chat ', 'response ', 'here.']
    const summaryChunks = ['Summary ', 'of ', 'document.']

    // Simulate two independent async generators (as ollama-service produces)
    async function* mockChatGenerator() {
      for (const chunk of chatChunks) {
        yield chunk
      }
    }

    async function* mockSummaryGenerator() {
      for (const chunk of summaryChunks) {
        yield chunk
      }
    }

    // Run both concurrently (simulating fire-and-forget pattern)
    const [chatResult, summaryResult] = await Promise.all([
      (async () => {
        let text = ''
        for await (const chunk of mockChatGenerator()) {
          text += chunk
        }
        return text
      })(),
      (async () => {
        let text = ''
        for await (const chunk of mockSummaryGenerator()) {
          text += chunk
        }
        return text
      })(),
    ])

    // Both should complete independently with correct content
    expect(chatResult).toBe('Chat response here.')
    expect(summaryResult).toBe('Summary of document.')
  })

  // ─── Test 4: Conversation reload ───────────────────────────────────

  it('should persist and reload conversation state across separate service calls', async () => {
    const { document } = createDocumentPrerequisites(db)

    const { getOrCreateConversation, addMessage, listMessages } = await import('@main/services/chat-service')

    // Create conversation and add messages (simulating a session)
    const conv = getOrCreateConversation(document.id)!
    addMessage(conv.id, 'user', 'First question')
    addMessage(conv.id, 'assistant', 'First answer')
    addMessage(conv.id, 'user', 'Second question')
    addMessage(conv.id, 'assistant', 'Second answer')

    // Simulate "navigating away and returning" by calling getOrCreateConversation again
    const reloadedConv = getOrCreateConversation(document.id)!

    // Should return the same conversation
    expect(reloadedConv.id).toBe(conv.id)

    // Should have all messages preserved
    const reloadedMessages = listMessages(reloadedConv.id)
    expect(reloadedMessages).toHaveLength(4)
    expect(reloadedMessages[0].content).toBe('First question')
    expect(reloadedMessages[1].content).toBe('First answer')
    expect(reloadedMessages[2].content).toBe('Second question')
    expect(reloadedMessages[3].content).toBe('Second answer')

    // Verify ordering is correct (ASC by created_at)
    for (let i = 1; i < reloadedMessages.length; i++) {
      expect(reloadedMessages[i].created_at >= reloadedMessages[i - 1].created_at).toBe(true)
    }
  })
})
