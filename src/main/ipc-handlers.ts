/**
 * IPC handler registration for the Electron main process.
 *
 * Each handler maps an IPC channel to a service function, wrapping
 * results in IpcResult format for consistent error handling.
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS, createIpcSuccess, createIpcError } from '@shared/ipc'
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
} from '@shared/types'
import {
  listProjects,
  getProject,
  createProject,
  updateProject,
  cascadeDeleteProject,
  listFolders,
  createFolder,
  updateFolder,
  cascadeDeleteFolder,
  listDocumentsByProject,
  listDocumentsByFolder,
  getDocumentWithContent,
  createDocument,
  updateDocument,
  deleteDocument,
  listQuizzesByDocument,
  getQuizWithQuestions,
  createQuiz,
  deleteQuiz,
  listAttempts,
  recordAttempt,
  validateFile,
  copyFileToStorage,
  openFilePickerDialog,
  deleteFileFromStorage,
} from '@main/services'

/**
 * Register all IPC handlers.
 * Called once before the first BrowserWindow is created.
 */
export function registerIpcHandlers(): void {
  // ─── Ping ─────────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.PING, () => 'pong')

  // ─── Projects ─────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, async () => {
    try {
      const result = listProjects()
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('PROJECTS_LIST_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_GET, async (_event, id: number) => {
    try {
      const result = getProject(id)
      if (!result) {
        return createIpcError('NOT_FOUND', `Project ${id} not found`)
      }
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('PROJECTS_GET_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_CREATE, async (_event, input: CreateProjectInput) => {
    try {
      const result = createProject(input)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('PROJECTS_CREATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_UPDATE, async (_event, id: number, input: UpdateProjectInput) => {
    try {
      const result = updateProject(id, input)
      if (!result) {
        return createIpcError('NOT_FOUND', `Project ${id} not found`)
      }
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('PROJECTS_UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.PROJECTS_DELETE, async (_event, id: number) => {
    try {
      cascadeDeleteProject(id)
      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('PROJECTS_DELETE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── Folders ──────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FOLDERS_LIST, async (_event, projectId: number) => {
    try {
      const result = listFolders(projectId)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('FOLDERS_LIST_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.FOLDERS_CREATE, async (_event, input: CreateFolderInput) => {
    try {
      const result = createFolder(input)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('FOLDERS_CREATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.FOLDERS_UPDATE, async (_event, id: number, input: UpdateFolderInput) => {
    try {
      const result = updateFolder(id, input)
      if (!result) {
        return createIpcError('NOT_FOUND', `Folder ${id} not found`)
      }
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('FOLDERS_UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.FOLDERS_DELETE, async (_event, id: number) => {
    try {
      cascadeDeleteFolder(id)
      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('FOLDERS_DELETE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── Documents ────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_LIST_BY_PROJECT, async (_event, projectId: number) => {
    try {
      const result = listDocumentsByProject(projectId)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('DOCUMENTS_LIST_BY_PROJECT_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_LIST, async (_event, folderId: number) => {
    try {
      const result = listDocumentsByFolder(folderId)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('DOCUMENTS_LIST_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_GET, async (_event, id: number) => {
    try {
      const result = getDocumentWithContent(id)
      if (!result) {
        return createIpcError('NOT_FOUND', `Document ${id} not found`)
      }
      return createIpcSuccess({
        ...result.document,
        content: result.content ?? null,
      })
    } catch (error) {
      return createIpcError('DOCUMENTS_GET_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_CREATE, async (_event, input: CreateDocumentInput) => {
    try {
      const result = createDocument(input)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('DOCUMENTS_CREATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_UPDATE, async (_event, id: number, input: UpdateDocumentInput) => {
    try {
      const result = updateDocument(id, input)
      if (!result) {
        return createIpcError('NOT_FOUND', `Document ${id} not found`)
      }
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('DOCUMENTS_UPDATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOCUMENTS_DELETE, async (_event, id: number) => {
    try {
      deleteDocument(id)
      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('DOCUMENTS_DELETE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── Quizzes ──────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.QUIZZES_LIST, async (_event, documentId: number) => {
    try {
      const result = listQuizzesByDocument(documentId)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('QUIZZES_LIST_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.QUIZZES_GET, async (_event, id: number) => {
    try {
      const result = getQuizWithQuestions(id)
      if (!result) {
        return createIpcError('NOT_FOUND', `Quiz ${id} not found`)
      }
      return createIpcSuccess({
        ...result.quiz,
        questions: result.questions,
      })
    } catch (error) {
      return createIpcError('QUIZZES_GET_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.QUIZZES_CREATE, async (_event, input: CreateQuizInput) => {
    try {
      const result = createQuiz(input)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('QUIZZES_CREATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.QUIZZES_DELETE, async (_event, id: number) => {
    try {
      deleteQuiz(id)
      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('QUIZZES_DELETE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── Quiz Attempts ────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.QUIZ_ATTEMPTS_LIST, async (_event, quizId: number) => {
    try {
      const result = listAttempts(quizId)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('QUIZ_ATTEMPTS_LIST_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.QUIZ_ATTEMPTS_CREATE, async (_event, input: CreateQuizAttemptInput) => {
    try {
      const result = recordAttempt(input)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('QUIZ_ATTEMPTS_CREATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── Files ───────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.FILE_OPEN_DIALOG, async () => {
    try {
      const filePaths = await openFilePickerDialog()
      return createIpcSuccess(filePaths)
    } catch (error) {
      return createIpcError('FILE_OPEN_DIALOG_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_VALIDATE, async (_event, filePath: string) => {
    try {
      const result = validateFile(filePath)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('FILE_VALIDATE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.FILE_UPLOAD, async (_event, input: FileUploadInput) => {
    try {
      // 1. Validate the file
      const validation = validateFile(input.filePath)
      if (!validation.valid) {
        return createIpcError('FILE_VALIDATION_FAILED', validation.error ?? 'File validation failed')
      }

      // 2. Copy file to storage
      const storedPath = copyFileToStorage(input.filePath, input.projectId)

      // 3. Create document DB record
      try {
        const document = createDocument({
          name: validation.name,
          file_path: storedPath,
          file_type: validation.type,
          file_size: validation.size,
          folder_id: input.folderId,
          project_id: input.projectId,
        })
        return createIpcSuccess(document)
      } catch (dbError) {
        // 4. Rollback: delete copied file on DB failure
        deleteFileFromStorage(storedPath)
        return createIpcError('FILE_UPLOAD_DB_ERROR', dbError instanceof Error ? dbError.message : 'Unknown error')
      }
    } catch (error) {
      return createIpcError('FILE_UPLOAD_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })
}
