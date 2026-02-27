import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'

export const recentSearches = sqliteTable('recent_searches', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  query: text('query').notNull(),
  result_count: integer('result_count').notNull().default(0),
  searched_at: text('searched_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
