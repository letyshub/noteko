import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { documents } from './documents'

export const documentContent = sqliteTable('document_content', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  document_id: integer('document_id')
    .notNull()
    .references(() => documents.id)
    .unique(),
  raw_text: text('raw_text'),
  summary: text('summary'),
  key_points: text('key_points', { mode: 'json' }).$type<string[]>(),
  key_terms: text('key_terms', { mode: 'json' }).$type<Array<{ term: string; definition: string }>>(),
  summary_style: text('summary_style'),
  processed_at: text('processed_at'),
})
