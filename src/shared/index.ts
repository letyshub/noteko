// Shared types, constants, and utilities between main and renderer processes.

export { IPC_CHANNELS, createIpcSuccess, createIpcError } from './ipc'

export type { IpcError, IpcResult, IpcChannelMap, IpcEventMap, ProgressEvent, ElectronAPI } from './ipc'

export type {
  ProjectDto,
  CreateProjectInput,
  UpdateProjectInput,
  FolderDto,
  CreateFolderInput,
  UpdateFolderInput,
  DocumentDto,
  DocumentDetailDto,
  DocumentContentDto,
  CreateDocumentInput,
  UpdateDocumentInput,
  QuizDto,
  QuizDetailDto,
  QuizQuestionDto,
  CreateQuizInput,
  CreateQuizQuestionInput,
  QuizAttemptDto,
  CreateQuizAttemptInput,
} from './types'
