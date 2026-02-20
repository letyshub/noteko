import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { folders } from './folders'
import { projects } from './projects'

export const documents = sqliteTable('documents', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  file_path: text('file_path').notNull(),
  file_type: text('file_type').notNull(),
  file_size: integer('file_size').notNull(),
  folder_id: integer('folder_id')
    .notNull()
    .references(() => folders.id),
  project_id: integer('project_id')
    .notNull()
    .references(() => projects.id),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
  updated_at: text('updated_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
