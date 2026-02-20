import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color'),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
  updated_at: text('updated_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
