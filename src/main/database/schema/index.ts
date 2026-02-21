import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { projects } from './projects'
import { folders } from './folders'
import { documents } from './documents'
import { documentContent } from './document-content'
import { quizzes } from './quizzes'
import { quizQuestions } from './quiz-questions'
import { quizAttempts } from './quiz-attempts'
import { appLogs } from './app-logs'
import { appSettings } from './app-settings'

// Re-export all table definitions
export { projects, folders, documents, documentContent, quizzes, quizQuestions, quizAttempts, appLogs, appSettings }

// Select model types (for reading from DB)
export type Project = InferSelectModel<typeof projects>
export type Folder = InferSelectModel<typeof folders>
export type Document = InferSelectModel<typeof documents>
export type DocumentContent = InferSelectModel<typeof documentContent>
export type Quiz = InferSelectModel<typeof quizzes>
export type QuizQuestion = InferSelectModel<typeof quizQuestions>
export type QuizAttempt = InferSelectModel<typeof quizAttempts>
export type AppLog = InferSelectModel<typeof appLogs>
export type AppSetting = InferSelectModel<typeof appSettings>

// Insert model types (for writing to DB)
export type NewProject = InferInsertModel<typeof projects>
export type NewFolder = InferInsertModel<typeof folders>
export type NewDocument = InferInsertModel<typeof documents>
export type NewDocumentContent = InferInsertModel<typeof documentContent>
export type NewQuiz = InferInsertModel<typeof quizzes>
export type NewQuizQuestion = InferInsertModel<typeof quizQuestions>
export type NewQuizAttempt = InferInsertModel<typeof quizAttempts>
export type NewAppLog = InferInsertModel<typeof appLogs>
export type NewAppSetting = InferInsertModel<typeof appSettings>
