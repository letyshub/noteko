import { eq, asc } from 'drizzle-orm'
import log from 'electron-log'
import { getDb } from '@main/database/connection'
import { chatConversations, chatMessages } from '@main/database/schema'

// ---------------------------------------------------------------------------
// Conversation CRUD
// ---------------------------------------------------------------------------

/**
 * Get the existing conversation for a document, or create a new one.
 *
 * Each document has at most one active conversation.
 */
export const getOrCreateConversation = (documentId: number) => {
  const db = getDb()

  // Check for existing conversation
  const existing = db.select().from(chatConversations).where(eq(chatConversations.document_id, documentId)).get()

  if (existing) {
    log.info(`[chat-service] Found existing conversation ${existing.id} for document ${documentId}`)
    return existing
  }

  // Create new conversation
  const now = new Date().toISOString()
  const created = db
    .insert(chatConversations)
    .values({
      document_id: documentId,
      created_at: now,
      updated_at: now,
    })
    .returning()
    .get()

  log.info(`[chat-service] Created conversation ${created?.id} for document ${documentId}`)
  return created
}

// ---------------------------------------------------------------------------
// Message CRUD
// ---------------------------------------------------------------------------

/**
 * Insert a chat message into a conversation.
 */
export const addMessage = (conversationId: number, role: string, content: string) => {
  const db = getDb()

  const message = db
    .insert(chatMessages)
    .values({
      conversation_id: conversationId,
      role,
      content,
      created_at: new Date().toISOString(),
    })
    .returning()
    .get()

  log.info(`[chat-service] Added ${role} message to conversation ${conversationId}`)
  return message
}

/**
 * List all messages in a conversation, ordered by creation time ASC.
 */
export const listMessages = (conversationId: number) => {
  return getDb()
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.conversation_id, conversationId))
    .orderBy(asc(chatMessages.created_at))
    .all()
}

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

/**
 * Delete a conversation and all its messages.
 * Messages are deleted first to respect FK constraints.
 */
export const deleteConversation = (conversationId: number) => {
  const db = getDb()

  // Delete messages first (FK constraint)
  db.delete(chatMessages).where(eq(chatMessages.conversation_id, conversationId)).run()
  const deleted = db.delete(chatConversations).where(eq(chatConversations.id, conversationId)).returning().get()

  log.info(`[chat-service] Deleted conversation ${conversationId}`)
  return deleted
}

/**
 * Delete all conversations and their messages for a given document.
 * Used for cascade deletion when a document is removed.
 */
export const deleteConversationsByDocument = (documentId: number) => {
  const db = getDb()

  // Find all conversations for this document
  const conversations = db.select().from(chatConversations).where(eq(chatConversations.document_id, documentId)).all()

  // Delete messages for each conversation, then the conversations themselves
  for (const conv of conversations) {
    db.delete(chatMessages).where(eq(chatMessages.conversation_id, conv.id)).run()
  }
  db.delete(chatConversations).where(eq(chatConversations.document_id, documentId)).run()

  log.info(`[chat-service] Deleted ${conversations.length} conversation(s) for document ${documentId}`)
}
