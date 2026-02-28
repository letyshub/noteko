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
  listAllAttempts,
  getOverviewStats,
  getPerQuizStats,
  getWeakAreas,
} from './quiz-service'

// Dashboard operations
export {
  getDashboardStats,
  getRecentDocuments,
  getRecentQuizAttempts,
  getProjectsWithCounts,
} from './dashboard-service'

// Log operations
export { listLogs, getLogStatistics, clearLogs, parseCategory, CATEGORY_PREFIX_MAP } from './log-service'

// File operations
export {
  validateFile,
  copyFileToStorage,
  openFilePickerDialog,
  deleteFileFromStorage,
  exportHistoryAsJson,
  exportAsCsv,
  getStorageBase,
} from './file-service'

// Parsing operations
export { parseDocument, queueDocument, retryDocument, resetStaleProcessingStatus } from './parsing-service'

// Ollama AI operations
export { checkHealth, listModels, generate, chat } from './ollama-service'

// Settings operations
export { getSetting, setSetting, getAllSettings } from './settings-service'

// Chunking / map-reduce AI operations
export { splitTextIntoChunks, runChunkedAiGeneration } from './chunking-service'

// Quiz generation AI operations
export {
  parseQuizQuestions,
  validateQuizQuestion,
  buildQuizPrompt,
  mergeQuizChunkResults,
} from './quiz-generation-service'

// AI prompt constants
export {
  QUIZ_GENERATION_PROMPT,
  COMBINE_QUIZ_QUESTIONS_PROMPT,
  QUIZ_RETRY_PROMPT,
  CHAT_SYSTEM_PROMPT,
} from './ai-prompts'

// Search operations
export {
  searchDocuments,
  saveRecentSearch,
  listRecentSearches,
  clearRecentSearches,
  deleteRecentSearch,
} from './search-service'

// Chat operations
export {
  getOrCreateConversation,
  addMessage,
  listMessages,
  deleteConversation,
  deleteConversationsByDocument,
} from './chat-service'

// Tag operations
export {
  listTags,
  createTag,
  updateTag,
  deleteTag,
  getDocumentTags,
  setDocumentTags,
  batchGetDocumentTags,
  getTagCloud,
  suggestTags,
  listDocumentsByTags,
} from './tag-service'
