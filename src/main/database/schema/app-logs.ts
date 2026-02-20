import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const appLogs = sqliteTable('app_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  level: text('level').notNull(),
  message: text('message').notNull(),
  context: text('context', { mode: 'json' }).$type<Record<string, unknown>>(),
  created_at: text('created_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
