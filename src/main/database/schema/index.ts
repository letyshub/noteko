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
import { recentSearches } from './recent-searches'
import { tags, documentTags } from './tags'

// Re-export all table definitions
export {
  projects,
  folders,
  documents,
  documentContent,
  quizzes,
  quizQuestions,
  quizAttempts,
  appLogs,
  appSettings,
  recentSearches,
  tags,
  documentTags,
}

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
export type RecentSearch = InferSelectModel<typeof recentSearches>
export type Tag = InferSelectModel<typeof tags>
export type DocumentTag = InferSelectModel<typeof documentTags>

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
export type NewRecentSearch = InferInsertModel<typeof recentSearches>
export type NewTag = InferInsertModel<typeof tags>
export type NewDocumentTag = InferInsertModel<typeof documentTags>
