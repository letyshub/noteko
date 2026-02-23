import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { documents } from './documents'

export const tags = sqliteTable('tags', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  color: text('color'),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})

export const documentTags = sqliteTable(
  'document_tags',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    document_id: integer('document_id')
      .notNull()
      .references(() => documents.id),
    tag_id: integer('tag_id')
      .notNull()
      .references(() => tags.id),
    created_at: text('created_at')
      .notNull()
      .$default(() => new Date().toISOString()),
  },
  (table) => [uniqueIndex('document_tags_document_id_tag_id_unique').on(table.document_id, table.tag_id)],
)
