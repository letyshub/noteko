// Project operations
export { listProjects, getProject, createProject, updateProject, deleteProject } from './project-service'

// Folder operations
export { listFolders, createFolder, updateFolder, deleteFolder } from './folder-service'

// Document operations
export {
  listDocumentsByProject,
  listDocumentsByFolder,
  getDocument,
  getDocumentWithContent,
  createDocument,
  updateDocument,
  deleteDocument,
  saveDocumentContent,
} from './document-service'

// Quiz operations
export {
  listQuizzesByDocument,
  getQuiz,
  getQuizWithQuestions,
  createQuiz,
  deleteQuiz,
  recordAttempt,
  listAttempts,
} from './quiz-service'
