/**
 * Shared DTO types for renderer <-> main communication.
 *
 * These types are defined independently of the database schema so that
 * renderer code never imports from @main/database (which pulls in
 * electron/better-sqlite3 native modules).
 *
 * Keep these in sync with the Drizzle schema in src/main/database/schema/.
 */

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export interface ProjectDto {
  id: number
  name: string
  description: string | null
  color: string | null
  created_at: string
  updated_at: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  color?: string
}

export interface UpdateProjectInput {
  name?: string
  description?: string
  color?: string
}

// ---------------------------------------------------------------------------
// Folder
// ---------------------------------------------------------------------------

export interface FolderDto {
  id: number
  name: string
  project_id: number
  parent_folder_id: number | null
  created_at: string
}

export interface CreateFolderInput {
  name: string
  project_id: number
  parent_folder_id?: number
}

export interface UpdateFolderInput {
  name?: string
  parent_folder_id?: number | null
}

// ---------------------------------------------------------------------------
// Processing Status
// ---------------------------------------------------------------------------

export type ProcessingStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'unsupported'

// ---------------------------------------------------------------------------
// Document
// ---------------------------------------------------------------------------

export interface DocumentDto {
  id: number
  name: string
  file_path: string
  file_type: string
  file_size: number
  folder_id: number
  project_id: number
  processing_status: ProcessingStatus
  created_at: string
  updated_at: string
}

/** Includes parsed content for single-document views. */
export interface DocumentDetailDto extends DocumentDto {
  content: DocumentContentDto | null
  project_name: string
  folder_name: string
}

export interface DocumentContentDto {
  id: number
  document_id: number
  raw_text: string | null
  summary: string | null
  key_points: string[] | null
  key_terms: KeyTerm[] | null
  summary_style: SummaryStyle | null
  processed_at: string | null
}

export interface CreateDocumentInput {
  name: string
  file_path: string
  file_type: string
  file_size: number
  folder_id: number
  project_id: number
}

export interface UpdateDocumentInput {
  name?: string
  folder_id?: number
  project_id?: number
}

// ---------------------------------------------------------------------------
// Quiz
// ---------------------------------------------------------------------------

export interface QuizDto {
  id: number
  document_id: number
  title: string
  created_at: string
  question_count?: number
  difficulty_level?: string
  question_types?: string
}

/** Includes questions for single-quiz views. */
export interface QuizDetailDto extends QuizDto {
  questions: QuizQuestionDto[]
}

export interface QuizQuestionDto {
  id: number
  quiz_id: number
  question: string
  options: string[] | null
  correct_answer: string
  explanation: string | null
  type?: 'multiple-choice' | 'true-false' | 'short-answer'
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface CreateQuizInput {
  document_id: number
  title: string
  questions: CreateQuizQuestionInput[]
}

export interface CreateQuizQuestionInput {
  question: string
  options?: string[]
  correct_answer: string
  explanation?: string
  type?: 'multiple-choice' | 'true-false' | 'short-answer'
  difficulty?: 'easy' | 'medium' | 'hard'
}

// ---------------------------------------------------------------------------
// Quiz Attempt
// ---------------------------------------------------------------------------

export interface QuizAttemptDto {
  id: number
  quiz_id: number
  score: number
  total_questions: number
  answers: Record<string, string> | null
  completed_at: string
}

export interface CreateQuizAttemptInput {
  quiz_id: number
  score: number
  total_questions: number
  answers?: Record<string, string>
}

/** Quiz attempt enriched with quiz and document context for history views. */
export interface QuizAttemptWithContextDto extends QuizAttemptDto {
  quiz_title: string
  document_name: string
  document_id: number
}

/** Aggregate statistics across all quiz attempts. */
export interface QuizOverviewStatsDto {
  total_attempts: number
  average_score: number
  best_score: number
  quizzes_taken: number
}

/** Per-quiz aggregate statistics for the history page. */
export interface QuizPerQuizStatsDto {
  quiz_id: number
  quiz_title: string
  document_name: string
  average_score: number
  attempt_count: number
  best_score: number
}

/** A weak area identified from quiz attempt error patterns. */
export interface WeakAreaDto {
  label: string
  category: 'type' | 'difficulty'
  error_count: number
  total_count: number
  error_rate: number
}

// ---------------------------------------------------------------------------
// AI / Ollama
// ---------------------------------------------------------------------------

/** Style used when generating a document summary. */
export type SummaryStyle = 'brief' | 'detailed' | 'academic'

/** A single extracted key term with its definition. */
export interface KeyTerm {
  term: string
  definition: string
}

/** Options for AI-powered quiz generation. */
export interface QuizGenerationOptions {
  questionCount: number
  questionTypes: string
  difficulty: string
}

/** Event payload streamed from main to renderer during AI operations. */
export interface AiStreamEvent {
  documentId: number
  operationType: 'summary' | 'key_points' | 'key_terms' | 'quiz' | 'chat'
  chunk: string
  done: boolean
  error?: string
  chunkIndex?: number
  totalChunks?: number
  quizId?: number
  conversationId?: number
}

/** Model information returned by Ollama's /api/tags endpoint. */
export interface OllamaModel {
  name: string
  size: number
  modified_at: string
}

/** Result of an Ollama health check. */
export interface OllamaHealthResult {
  connected: boolean
  models: string[]
}

// ---------------------------------------------------------------------------
// Chat
// ---------------------------------------------------------------------------

export interface ChatConversationDto {
  id: number
  document_id: number
  title: string | null
  created_at: string
  updated_at: string
}

export interface ChatMessageDto {
  id: number
  conversation_id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  created_at: string
}

export interface AiChatInput {
  documentId: number
  conversationId: number | null
  message: string
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

/** Aggregate stats for the dashboard overview cards. */
export interface DashboardStatsDto {
  total_projects: number
  total_documents: number
  total_quizzes_taken: number
  average_score: number
}

/** Recent document for the dashboard activity feed. */
export interface RecentDocumentDto {
  id: number
  name: string
  file_type: string
  project_name: string
  created_at: string
}

/** Recent quiz attempt for the dashboard activity feed. */
export interface RecentQuizAttemptDto {
  id: number
  quiz_id: number
  quiz_title: string
  document_name: string
  score: number
  completed_at: string
}

/** Project with document count for the dashboard project grid. */
export interface ProjectWithCountDto {
  id: number
  name: string
  color: string | null
  document_count: number
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

/** Log category derived from message prefix. */
export type LogCategory = 'app' | 'document' | 'ai' | 'quiz'

/** Supported date range filters for log queries. */
export type LogDateRange = '24h' | '7d' | '30d' | 'all'

/** A single app log entry for display in the log viewer. */
export interface AppLogDto {
  id: number
  level: string
  message: string
  category: string | null
  context: Record<string, unknown> | null
  created_at: string
}

/** Filter input for the listLogs query. */
export interface LogFilterInput {
  level?: string
  category?: string
  search?: string
  dateRange?: LogDateRange
  page?: number
  limit?: number
}

/** Paginated result from listLogs. */
export interface LogListResultDto {
  logs: AppLogDto[]
  total: number
  hasMore: boolean
}

/** Aggregate statistics for the log viewer dashboard. */
export interface LogStatisticsDto {
  total: number
  errors: number
  warnings: number
  infos: number
  debugs: number
  trend: Array<{ date: string; errorCount: number }>
}

/** Event payload for real-time log streaming from main to renderer. */
export interface LogStreamEvent {
  log: AppLogDto
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Filter input for the searchDocuments query. */
export interface SearchFilterInput {
  query: string
  projectId?: number
  fileType?: string
  dateRange?: LogDateRange
}

/** A single search result entry. */
export interface SearchResultDto {
  documentId: number
  documentName: string
  projectName: string
  fileType: string
  snippet: string | null
  createdAt: string
  processingStatus: ProcessingStatus
  matchType: 'content' | 'name'
}

/** Paginated result from searchDocuments. */
export interface SearchListResultDto {
  results: SearchResultDto[]
  total: number
  hasMore: boolean
}

/** A recent search entry for the search history. */
export interface RecentSearchDto {
  id: number
  query: string
  resultCount: number
  searchedAt: string
}

// ---------------------------------------------------------------------------
// File Upload
// ---------------------------------------------------------------------------

/** Input for the file:upload IPC channel. */
export interface FileUploadInput {
  filePath: string // Source file path on disk
  projectId: number // Target project
  folderId: number // Target folder
}

/** Result of file validation. */
export interface FileValidationResult {
  valid: boolean
  error?: string
  name: string
  size: number
  type: string
}

// ---------------------------------------------------------------------------
// Tag
// ---------------------------------------------------------------------------

export interface TagDto {
  id: number
  name: string
  color: string | null
  created_at: string
}

export interface TagCloudItemDto {
  id: number
  name: string
  color: string | null
  document_count: number
}

export interface CreateTagInput {
  name: string
  color?: string
}

export interface UpdateTagInput {
  name?: string
  color?: string
}

export interface SetDocumentTagsInput {
  document_id: number
  tag_ids: number[]
}
