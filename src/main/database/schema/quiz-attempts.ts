import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { quizzes } from './quizzes'

export const quizAttempts = sqliteTable('quiz_attempts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quiz_id: integer('quiz_id')
    .notNull()
    .references(() => quizzes.id),
  score: integer('score').notNull(),
  total_questions: integer('total_questions').notNull(),
  answers: text('answers', { mode: 'json' }).$type<Record<string, string>>(),
  completed_at: text('completed_at')
    .notNull()
    .$default(() => new Date().toISOString()),
})
