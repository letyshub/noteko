import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { chatConversations } from './chat-conversations'

export const chatMessages = sqliteTable('chat_messages', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  conversation_id: integer('conversation_id')
    .notNull()
    .references(() => chatConversations.id),
  role: text('role').notNull(),
  content: text('content').notNull(),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
