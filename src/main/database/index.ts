// Connection lifecycle
export { initializeDatabase, closeDatabase, getDb } from './connection'

// Schema tables and types
export { projects, folders, documents, documentContent, quizzes, quizQuestions, quizAttempts, appLogs } from './schema'

export type {
  Project,
  Folder,
  Document,
  DocumentContent,
  Quiz,
  QuizQuestion,
  QuizAttempt,
  AppLog,
  NewProject,
  NewFolder,
  NewDocument,
  NewDocumentContent,
  NewQuiz,
  NewQuizQuestion,
  NewQuizAttempt,
  NewAppLog,
} from './schema'
