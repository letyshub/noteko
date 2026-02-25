import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { documents } from './documents'

export const chatConversations = sqliteTable('chat_conversations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  document_id: integer('document_id')
    .notNull()
    .unique()
    .references(() => documents.id),
  title: text('title'),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
  updated_at: text('updated_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
