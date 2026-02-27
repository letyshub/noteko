import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { quizzes } from './quizzes'

export const quizQuestions = sqliteTable('quiz_questions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  quiz_id: integer('quiz_id')
    .notNull()
    .references(() => quizzes.id),
  question: text('question').notNull(),
  options: text('options', { mode: 'json' }).$type<string[]>(),
  correct_answer: text('correct_answer').notNull(),
  explanation: text('explanation'),
  type: text('type'),
  difficulty: text('difficulty'),
})
