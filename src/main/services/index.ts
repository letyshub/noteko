// Project operations
export {
  listProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  cascadeDeleteProject,
} from './project-service'

// Folder operations
export { listFolders, createFolder, updateFolder, deleteFolder, cascadeDeleteFolder } from './folder-service'

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

// File operations
export { validateFile, copyFileToStorage, openFilePickerDialog, deleteFileFromStorage } from './file-service'

// Parsing operations
export { parseDocument, queueDocument, retryDocument, resetStaleProcessingStatus } from './parsing-service'

// Ollama AI operations
export { checkHealth, listModels, generate } from './ollama-service'

// Settings operations
export { getSetting, setSetting, getAllSettings } from './settings-service'

// Chunking / map-reduce AI operations
export { splitTextIntoChunks, runChunkedAiGeneration } from './chunking-service'
