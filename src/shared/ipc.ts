/**
 * Shared IPC type definitions for Electron main <-> renderer communication.
 *
 * To add a new IPC channel:
 *   1. Add the channel name to IPC_CHANNELS
 *   2. Add the request/response type mapping to IpcChannelMap
 *   3. Add a handler in src/main/index.ts (ipcMain.handle)
 *   4. Expose the method in src/preload/index.ts (contextBridge)
 *
 * The ElectronAPI type is auto-derived from IpcChannelMap,
 * so steps 3 and 4 get full type safety automatically.
 */

import type {
  CreateProjectInput,
  UpdateProjectInput,
  CreateFolderInput,
  UpdateFolderInput,
  CreateDocumentInput,
  UpdateDocumentInput,
  CreateQuizInput,
  CreateQuizAttemptInput,
  FileUploadInput,
  FileValidationResult,
  ProjectDto,
  FolderDto,
  DocumentDto,
  DocumentDetailDto,
  QuizDto,
  QuizDetailDto,
  QuizAttemptDto,
  AiStreamEvent,
  OllamaModel,
  OllamaHealthResult,
  SummaryStyle,
} from './types'

// ---------------------------------------------------------------------------
// IPC Channel Names
// ---------------------------------------------------------------------------

/** IPC channel name constants. */
export const IPC_CHANNELS = {
  PING: 'ping',

  // Projects
  PROJECTS_LIST: 'db:projects:list',
  PROJECTS_GET: 'db:projects:get',
  PROJECTS_CREATE: 'db:projects:create',
  PROJECTS_UPDATE: 'db:projects:update',
  PROJECTS_DELETE: 'db:projects:delete',

  // Folders
  FOLDERS_LIST: 'db:folders:list',
  FOLDERS_CREATE: 'db:folders:create',
  FOLDERS_UPDATE: 'db:folders:update',
  FOLDERS_DELETE: 'db:folders:delete',

  // Documents
  DOCUMENTS_LIST: 'db:documents:list',
  DOCUMENTS_LIST_BY_PROJECT: 'db:documents:list-by-project',
  DOCUMENTS_GET: 'db:documents:get',
  DOCUMENTS_CREATE: 'db:documents:create',
  DOCUMENTS_UPDATE: 'db:documents:update',
  DOCUMENTS_DELETE: 'db:documents:delete',

  // Quizzes
  QUIZZES_LIST: 'db:quizzes:list',
  QUIZZES_GET: 'db:quizzes:get',
  QUIZZES_CREATE: 'db:quizzes:create',
  QUIZZES_DELETE: 'db:quizzes:delete',

  // Quiz Attempts
  QUIZ_ATTEMPTS_LIST: 'db:quiz-attempts:list',
  QUIZ_ATTEMPTS_CREATE: 'db:quiz-attempts:create',

  // Files
  FILE_OPEN_DIALOG: 'file:open-dialog',
  FILE_UPLOAD: 'file:upload',
  FILE_VALIDATE: 'file:validate',

  // Document Parsing
  DOC_PARSE: 'doc:parse',
  DOC_PARSE_RETRY: 'doc:parse:retry',

  // AI / Ollama
  AI_HEALTH_CHECK: 'ai:health-check',
  AI_LIST_MODELS: 'ai:list-models',
  AI_SUMMARIZE: 'ai:summarize',
  AI_EXTRACT_KEY_POINTS: 'ai:extract-key-points',
  AI_EXTRACT_KEY_TERMS: 'ai:extract-key-terms',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_GET_ALL: 'settings:get-all',

  // Events (push from main to renderer)
  PROGRESS: 'app:progress',
} as const

// ---------------------------------------------------------------------------
// IPC Result Types
// ---------------------------------------------------------------------------

/** Structured error returned from IPC handlers. */
export interface IpcError {
  code: string
  message: string
  details?: unknown
}

/** Discriminated union result type for all IPC responses. */
export type IpcResult<T> = { success: true; data: T } | { success: false; error: IpcError }

/** Create a successful IPC result. */
export function createIpcSuccess<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

/** Create a failed IPC result. */
export function createIpcError(code: string, message: string, details?: unknown): IpcResult<never> {
  return { success: false, error: { code, message, details } }
}

// ---------------------------------------------------------------------------
// IPC Channel Map (args + response for each channel)
// ---------------------------------------------------------------------------

/**
 * Maps each IPC channel to its request args tuple and response type.
 * Use string literal keys matching the values in IPC_CHANNELS.
 */
export interface IpcChannelMap {
  // Ping (backward-compatible)
  ping: { args: []; response: string }

  // Projects
  'db:projects:list': { args: []; response: IpcResult<ProjectDto[]> }
  'db:projects:get': { args: [id: number]; response: IpcResult<ProjectDto> }
  'db:projects:create': {
    args: [input: CreateProjectInput]
    response: IpcResult<ProjectDto>
  }
  'db:projects:update': {
    args: [id: number, input: UpdateProjectInput]
    response: IpcResult<ProjectDto>
  }
  'db:projects:delete': { args: [id: number]; response: IpcResult<void> }

  // Folders
  'db:folders:list': {
    args: [projectId: number]
    response: IpcResult<FolderDto[]>
  }
  'db:folders:create': {
    args: [input: CreateFolderInput]
    response: IpcResult<FolderDto>
  }
  'db:folders:update': {
    args: [id: number, input: UpdateFolderInput]
    response: IpcResult<FolderDto>
  }
  'db:folders:delete': { args: [id: number]; response: IpcResult<void> }

  // Documents
  'db:documents:list': {
    args: [folderId: number]
    response: IpcResult<DocumentDto[]>
  }
  'db:documents:list-by-project': {
    args: [projectId: number]
    response: IpcResult<DocumentDto[]>
  }
  'db:documents:get': {
    args: [id: number]
    response: IpcResult<DocumentDetailDto>
  }
  'db:documents:create': {
    args: [input: CreateDocumentInput]
    response: IpcResult<DocumentDto>
  }
  'db:documents:update': {
    args: [id: number, input: UpdateDocumentInput]
    response: IpcResult<DocumentDto>
  }
  'db:documents:delete': { args: [id: number]; response: IpcResult<void> }

  // Quizzes
  'db:quizzes:list': {
    args: [documentId: number]
    response: IpcResult<QuizDto[]>
  }
  'db:quizzes:get': {
    args: [id: number]
    response: IpcResult<QuizDetailDto>
  }
  'db:quizzes:create': {
    args: [input: CreateQuizInput]
    response: IpcResult<QuizDto>
  }
  'db:quizzes:delete': { args: [id: number]; response: IpcResult<void> }

  // Quiz Attempts
  'db:quiz-attempts:list': {
    args: [quizId: number]
    response: IpcResult<QuizAttemptDto[]>
  }
  'db:quiz-attempts:create': {
    args: [input: CreateQuizAttemptInput]
    response: IpcResult<QuizAttemptDto>
  }

  // Files
  'file:open-dialog': { args: []; response: IpcResult<string[]> }
  'file:upload': {
    args: [input: FileUploadInput]
    response: IpcResult<DocumentDto>
  }
  'file:validate': {
    args: [filePath: string]
    response: IpcResult<FileValidationResult>
  }

  // Document Parsing
  'doc:parse': { args: [documentId: number]; response: IpcResult<void> }
  'doc:parse:retry': { args: [documentId: number]; response: IpcResult<void> }

  // AI / Ollama
  'ai:health-check': { args: []; response: IpcResult<OllamaHealthResult> }
  'ai:list-models': { args: []; response: IpcResult<OllamaModel[]> }
  'ai:summarize': { args: [documentId: number, options?: { style?: SummaryStyle }]; response: IpcResult<void> }
  'ai:extract-key-points': { args: [documentId: number]; response: IpcResult<void> }
  'ai:extract-key-terms': { args: [documentId: number]; response: IpcResult<void> }

  // Settings
  'settings:get': { args: [key: string]; response: IpcResult<string | null> }
  'settings:set': { args: [key: string, value: string]; response: IpcResult<void> }
  'settings:get-all': { args: []; response: IpcResult<Record<string, string>> }
}

// ---------------------------------------------------------------------------
// IPC Event Types (main -> renderer push)
// ---------------------------------------------------------------------------

/** Progress event pushed from main process to renderer. */
export interface ProgressEvent {
  taskId: string
  progress: number // 0-100
  message: string
}

/** Maps event channels to their payload types. */
export interface IpcEventMap {
  'app:progress': ProgressEvent
  'ai:stream': AiStreamEvent
}

// ---------------------------------------------------------------------------
// Electron API (exposed to renderer via contextBridge)
// ---------------------------------------------------------------------------

/**
 * The typed API exposed to the renderer via contextBridge.
 * Each method corresponds to an IPC channel and returns a Promise of the
 * channel's response type. Also includes event subscription helpers.
 */
export type ElectronAPI = {
  [K in keyof IpcChannelMap]: (...args: IpcChannelMap[K]['args']) => Promise<IpcChannelMap[K]['response']>
} & {
  on: <K extends keyof IpcEventMap>(channel: K, callback: (data: IpcEventMap[K]) => void) => WrappedListener
  off: <K extends keyof IpcEventMap>(channel: K, callback: WrappedListener) => void
}

/**
 * Opaque type for the wrapped IPC listener returned by `on()`.
 * Must be passed back to `off()` to properly unsubscribe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type WrappedListener = (...args: any[]) => void
