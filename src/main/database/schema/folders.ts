import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { projects } from './projects'

export const folders = sqliteTable('folders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  project_id: integer('project_id')
    .notNull()
    .references(() => projects.id),
  parent_folder_id: integer('parent_folder_id').references((): AnySQLiteColumn => folders.id),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
