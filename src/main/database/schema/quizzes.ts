import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { documents } from './documents'

export const quizzes = sqliteTable('quizzes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  document_id: integer('document_id')
    .notNull()
    .references(() => documents.id),
  title: text('title').notNull(),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
