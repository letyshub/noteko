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
  created_at: string
  updated_at: string
}

/** Includes parsed content for single-document views. */
export interface DocumentDetailDto extends DocumentDto {
  content: DocumentContentDto | null
}

export interface DocumentContentDto {
  id: number
  document_id: number
  raw_text: string | null
  summary: string | null
  key_points: string[] | null
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
