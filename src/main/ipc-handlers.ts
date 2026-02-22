/**
 * IPC handler registration for the Electron main process.
 *
 * Each handler maps an IPC channel to a service function, wrapping
 * results in IpcResult format for consistent error handling.
 */

import { ipcMain } from 'electron'
import log from 'electron-log'
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
  AiStreamEvent,
  SummaryStyle,
  KeyTerm,
  QuizGenerationOptions,
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
  saveDocumentContent,
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
  queueDocument,
  retryDocument,
  checkHealth,
  listModels,
  generate,
  getSetting,
  setSetting,
  getAllSettings,
  splitTextIntoChunks,
  runChunkedAiGeneration,
  parseQuizQuestions,
  validateQuizQuestion,
  buildQuizPrompt,
} from '@main/services'
import { getMainWindow } from '@main/main-window'
import {
  KEY_POINTS_PROMPT,
  KEY_TERMS_PROMPT,
  DEFAULT_OLLAMA_MODEL,
  RAW_TEXT_MAX_LENGTH,
  COMBINE_SUMMARIES_PROMPT,
  COMBINE_KEY_POINTS_PROMPT,
  COMBINE_KEY_TERMS_PROMPT,
  QUIZ_GENERATION_PROMPT,
  COMBINE_QUIZ_QUESTIONS_PROMPT,
  QUIZ_RETRY_PROMPT,
  getSummaryPrompt,
} from '@main/services/ai-prompts'
import { CHUNK_SIZE } from '@main/services/chunking-service'

// ---------------------------------------------------------------------------
// AI generation helper (fire-and-forget, streams to renderer)
// ---------------------------------------------------------------------------

/**
 * Send an AI stream event to the renderer process.
 */
function sendStreamEvent(event: AiStreamEvent): void {
  const win = getMainWindow()
  if (win) {
    win.webContents.send('ai:stream', event)
  }
}

/**
 * Run AI text generation in the background, streaming chunks to the renderer.
 *
 * On completion:
 * - For 'summary': saves the accumulated text as the document summary (and optional summary_style).
 * - For 'key_points': parses lines starting with `-` and saves as string array.
 * - For 'key_terms': parses JSON `Array<{ term, definition }>`, with fallback to line-by-line parsing.
 *
 * On error: sends an error event via ai:stream.
 */
async function runAiGeneration(
  documentId: number,
  operationType: 'summary' | 'key_points' | 'key_terms',
  model: string,
  prompt: string,
  baseUrl?: string,
  summaryStyle?: SummaryStyle,
): Promise<void> {
  let fullText = ''

  try {
    log.info(`[ai] Starting ${operationType} generation for document ${documentId}`)

    const generator = generate({ model, prompt, baseUrl })

    for await (const chunk of generator) {
      fullText += chunk
      sendStreamEvent({
        documentId,
        operationType,
        chunk,
        done: false,
      })
    }

    // Save results
    if (operationType === 'summary') {
      saveDocumentContent({
        document_id: documentId,
        summary: fullText,
        ...(summaryStyle ? { summary_style: summaryStyle } : {}),
      })
    } else if (operationType === 'key_points') {
      const keyPoints = parseKeyPoints(fullText)
      saveDocumentContent({ document_id: documentId, key_points: keyPoints })
    } else if (operationType === 'key_terms') {
      // Parse key terms: try JSON first, then fall back to line-by-line
      const keyTerms = parseKeyTerms(fullText)
      saveDocumentContent({ document_id: documentId, key_terms: keyTerms })
    }

    // Send done event
    sendStreamEvent({
      documentId,
      operationType,
      chunk: '',
      done: true,
    })

    log.info(`[ai] Completed ${operationType} generation for document ${documentId}`)
  } catch (error) {
    log.error(
      `[ai] Error during ${operationType} generation for document ${documentId}:`,
      error instanceof Error ? error.message : error,
    )

    // Send error event
    sendStreamEvent({
      documentId,
      operationType,
      chunk: '',
      done: true,
      error: error instanceof Error ? error.message : 'Unknown error during AI generation',
    })
  }
}

/**
 * Parse key points from LLM output.
 * Extracts lines starting with "- " and returns as string array.
 */
function parseKeyPoints(text: string): string[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .map((line) => line.replace(/^-\s*/, ''))
    .filter((point) => point.length > 0)
}

/**
 * Parse key terms from LLM output.
 *
 * Tries JSON.parse first for `Array<{ term, definition }>`.
 * Falls back to line-by-line parsing where each line is "term: definition" or "term - definition".
 */
function parseKeyTerms(text: string): KeyTerm[] {
  // Try JSON parsing first
  try {
    const parsed = JSON.parse(text.trim())
    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item && typeof item.term === 'string' && typeof item.definition === 'string')
        .map((item) => ({ term: item.term, definition: item.definition }))
    }
  } catch {
    // JSON parsing failed, fall through to line-by-line
  }

  // Fallback: line-by-line parsing ("term: definition" or "term - definition")
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      // Try "term: definition" format
      const colonIdx = line.indexOf(':')
      if (colonIdx > 0) {
        return {
          term: line.slice(0, colonIdx).trim(),
          definition: line.slice(colonIdx + 1).trim(),
        }
      }
      // Try "term - definition" format
      const dashIdx = line.indexOf(' - ')
      if (dashIdx > 0) {
        return {
          term: line.slice(0, dashIdx).trim(),
          definition: line.slice(dashIdx + 3).trim(),
        }
      }
      return null
    })
    .filter((item): item is KeyTerm => item !== null && item.term.length > 0 && item.definition.length > 0)
}

// ---------------------------------------------------------------------------
// Quiz generation helper (fire-and-forget, streams to renderer)
// ---------------------------------------------------------------------------

/**
 * Run AI quiz generation in the background, streaming chunks to the renderer.
 *
 * On completion:
 * - Parses the LLM output as JSON quiz questions via parseQuizQuestions()
 * - Validates each question via validateQuizQuestion()
 * - Retries up to 2 times on malformed output using QUIZ_RETRY_PROMPT
 * - On success: saves quiz via createQuiz(), sends done event with quizId
 *
 * On error: sends an error event via ai:stream.
 */
async function runQuizGeneration(
  documentId: number,
  documentName: string,
  model: string,
  prompt: string,
  options: QuizGenerationOptions,
  rawText: string,
  baseUrl?: string,
): Promise<void> {
  const maxRetries = 2
  let lastError = ''

  try {
    log.info(`[ai] Starting quiz generation for document ${documentId}`)

    let currentPrompt = prompt
    let fullText = ''
    let validQuestions: ReturnType<typeof validateQuizQuestion>[] = []

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      fullText = ''

      const generator = generate({ model, prompt: currentPrompt, baseUrl })

      for await (const chunk of generator) {
        fullText += chunk
        sendStreamEvent({
          documentId,
          operationType: 'quiz',
          chunk,
          done: false,
        })
      }

      // Parse and validate
      const parsed = parseQuizQuestions(fullText)
      if (!parsed) {
        lastError = 'Failed to parse JSON array from LLM output'
        log.warn(`[ai] Quiz generation attempt ${attempt + 1}: ${lastError}`)

        if (attempt < maxRetries) {
          currentPrompt = QUIZ_RETRY_PROMPT.replace('{error}', lastError)
            .replace('{questionCount}', String(options.questionCount))
            .replace('{questionTypes}', options.questionTypes)
            .replace('{difficulty}', options.difficulty)
            .replace('{text}', rawText.slice(0, RAW_TEXT_MAX_LENGTH))
          continue
        }
        break
      }

      // Validate each question
      validQuestions = parsed.map((q) => validateQuizQuestion(q)).filter((q) => q !== null)

      if (validQuestions.length === 0) {
        lastError = 'All parsed questions failed validation'
        log.warn(`[ai] Quiz generation attempt ${attempt + 1}: ${lastError}`)

        if (attempt < maxRetries) {
          currentPrompt = QUIZ_RETRY_PROMPT.replace('{error}', lastError)
            .replace('{questionCount}', String(options.questionCount))
            .replace('{questionTypes}', options.questionTypes)
            .replace('{difficulty}', options.difficulty)
            .replace('{text}', rawText.slice(0, RAW_TEXT_MAX_LENGTH))
          continue
        }
        break
      }

      // Success: we have valid questions
      log.info(`[ai] Quiz generation: ${validQuestions.length} valid questions after attempt ${attempt + 1}`)

      const quizTitle = `Quiz: ${documentName} - ${options.difficulty} (${validQuestions.length}Q)`
      const quiz = createQuiz({
        document_id: documentId,
        title: quizTitle,
        question_count: validQuestions.length,
        difficulty_level: options.difficulty,
        question_types: options.questionTypes,
        questions: validQuestions.map((q) => ({
          question: q!.question,
          options: q!.options ?? undefined,
          correct_answer: q!.correct_answer,
          explanation: q!.explanation ?? undefined,
          type: q!.type,
          difficulty: q!.difficulty,
        })),
      })

      // Send done event with quizId
      sendStreamEvent({
        documentId,
        operationType: 'quiz',
        chunk: '',
        done: true,
        quizId: quiz.id,
      })

      log.info(`[ai] Completed quiz generation for document ${documentId}, quiz ${quiz.id}`)
      return
    }

    // All retries exhausted
    log.error(`[ai] Quiz generation failed after ${maxRetries + 1} attempts for document ${documentId}: ${lastError}`)
    sendStreamEvent({
      documentId,
      operationType: 'quiz',
      chunk: '',
      done: true,
      error: `Quiz generation failed after retries: ${lastError}`,
    })
  } catch (error) {
    log.error(
      `[ai] Error during quiz generation for document ${documentId}:`,
      error instanceof Error ? error.message : error,
    )

    sendStreamEvent({
      documentId,
      operationType: 'quiz',
      chunk: '',
      done: true,
      error: error instanceof Error ? error.message : 'Unknown error during quiz generation',
    })
  }
}

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
        project_name: result.project_name,
        folder_name: result.folder_name,
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

        // 4. Auto-parse: fire-and-forget (no await, no error propagation)
        queueDocument(document.id)

        return createIpcSuccess(document)
      } catch (dbError) {
        // 5. Rollback: delete copied file on DB failure
        deleteFileFromStorage(storedPath)
        return createIpcError('FILE_UPLOAD_DB_ERROR', dbError instanceof Error ? dbError.message : 'Unknown error')
      }
    } catch (error) {
      return createIpcError('FILE_UPLOAD_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── Document Parsing ──────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.DOC_PARSE, async (_event, documentId: number) => {
    try {
      queueDocument(documentId)
      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('DOC_PARSE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.DOC_PARSE_RETRY, async (_event, documentId: number) => {
    try {
      retryDocument(documentId)
      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('DOC_PARSE_RETRY_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── AI / Ollama ────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.AI_HEALTH_CHECK, async () => {
    try {
      const baseUrl = getSetting('ollama.url') ?? undefined
      const result = await checkHealth(baseUrl)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('AI_HEALTH_CHECK_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_LIST_MODELS, async () => {
    try {
      const baseUrl = getSetting('ollama.url') ?? undefined
      const result = await listModels(baseUrl)
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('AI_LIST_MODELS_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_SUMMARIZE, async (_event, documentId: number, options?: { style?: SummaryStyle }) => {
    try {
      // 1. Get document with content
      const result = getDocumentWithContent(documentId)
      if (!result) {
        return createIpcError('NOT_FOUND', `Document ${documentId} not found`)
      }

      const rawText = result.content?.raw_text
      if (!rawText) {
        return createIpcError('NO_CONTENT', 'Document has no extracted text to summarize')
      }

      // 2. Get Ollama settings
      const baseUrl = getSetting('ollama.url') ?? undefined
      const model = getSetting('ollama.model') ?? DEFAULT_OLLAMA_MODEL

      // 3. Resolve style and get appropriate prompt template
      const style: SummaryStyle = options?.style ?? 'brief'
      const promptTemplate = getSummaryPrompt(style)

      // 4. Check text length for chunking
      if (rawText.length > CHUNK_SIZE) {
        // Long document: use chunked generation (map-reduce)
        const chunks = splitTextIntoChunks(rawText)
        runChunkedAiGeneration({
          documentId,
          operationType: 'summary',
          model,
          baseUrl,
          chunks,
          promptTemplate,
          combinePromptTemplate: COMBINE_SUMMARIES_PROMPT,
          sendStreamEvent,
          saveResult: (finalText: string) => {
            saveDocumentContent({
              document_id: documentId,
              summary: finalText,
              summary_style: style,
            })
          },
        })
      } else {
        // Short document: single-pass generation
        const truncatedText = rawText.slice(0, RAW_TEXT_MAX_LENGTH)
        const prompt = promptTemplate.replace('{text}', truncatedText)
        runAiGeneration(documentId, 'summary', model, prompt, baseUrl, style)
      }

      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('AI_SUMMARIZE_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_EXTRACT_KEY_POINTS, async (_event, documentId: number) => {
    try {
      // 1. Get document with content
      const result = getDocumentWithContent(documentId)
      if (!result) {
        return createIpcError('NOT_FOUND', `Document ${documentId} not found`)
      }

      const rawText = result.content?.raw_text
      if (!rawText) {
        return createIpcError('NO_CONTENT', 'Document has no extracted text for key point extraction')
      }

      // 2. Get Ollama settings
      const baseUrl = getSetting('ollama.url') ?? undefined
      const model = getSetting('ollama.model') ?? DEFAULT_OLLAMA_MODEL

      // 3. Check text length for chunking
      if (rawText.length > CHUNK_SIZE) {
        // Long document: use chunked generation (map-reduce)
        const chunks = splitTextIntoChunks(rawText)
        runChunkedAiGeneration({
          documentId,
          operationType: 'key_points',
          model,
          baseUrl,
          chunks,
          promptTemplate: KEY_POINTS_PROMPT,
          combinePromptTemplate: COMBINE_KEY_POINTS_PROMPT,
          sendStreamEvent,
          saveResult: (finalText: string) => {
            const keyPoints = parseKeyPoints(finalText)
            saveDocumentContent({ document_id: documentId, key_points: keyPoints })
          },
        })
      } else {
        // Short document: single-pass generation
        const truncatedText = rawText.slice(0, RAW_TEXT_MAX_LENGTH)
        const prompt = KEY_POINTS_PROMPT.replace('{text}', truncatedText)
        runAiGeneration(documentId, 'key_points', model, prompt, baseUrl)
      }

      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('AI_EXTRACT_KEY_POINTS_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_EXTRACT_KEY_TERMS, async (_event, documentId: number) => {
    try {
      // 1. Get document with content
      const result = getDocumentWithContent(documentId)
      if (!result) {
        return createIpcError('NOT_FOUND', `Document ${documentId} not found`)
      }

      const rawText = result.content?.raw_text
      if (!rawText) {
        return createIpcError('NO_CONTENT', 'Document has no extracted text for key term extraction')
      }

      // 2. Get Ollama settings
      const baseUrl = getSetting('ollama.url') ?? undefined
      const model = getSetting('ollama.model') ?? DEFAULT_OLLAMA_MODEL

      // 3. Check text length for chunking
      if (rawText.length > CHUNK_SIZE) {
        // Long document: use chunked generation (map-reduce)
        const chunks = splitTextIntoChunks(rawText)
        runChunkedAiGeneration({
          documentId,
          operationType: 'key_terms',
          model,
          baseUrl,
          chunks,
          promptTemplate: KEY_TERMS_PROMPT,
          combinePromptTemplate: COMBINE_KEY_TERMS_PROMPT,
          sendStreamEvent,
          saveResult: (finalText: string) => {
            const keyTerms = parseKeyTerms(finalText)
            saveDocumentContent({ document_id: documentId, key_terms: keyTerms })
          },
        })
      } else {
        // Short document: single-pass generation
        const truncatedText = rawText.slice(0, RAW_TEXT_MAX_LENGTH)
        const prompt = KEY_TERMS_PROMPT.replace('{text}', truncatedText)
        runAiGeneration(documentId, 'key_terms', model, prompt, baseUrl)
      }

      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('AI_EXTRACT_KEY_TERMS_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.AI_GENERATE_QUIZ, async (_event, documentId: number, options: QuizGenerationOptions) => {
    try {
      // 1. Get document with content
      const result = getDocumentWithContent(documentId)
      if (!result) {
        return createIpcError('NOT_FOUND', `Document ${documentId} not found`)
      }

      const rawText = result.content?.raw_text
      if (!rawText) {
        return createIpcError('NO_CONTENT', 'Document has no extracted text for quiz generation')
      }

      // 2. Get Ollama settings
      const baseUrl = getSetting('ollama.url') ?? undefined
      const model = getSetting('ollama.model') ?? DEFAULT_OLLAMA_MODEL

      // 3. Check text length for chunking
      if (rawText.length > CHUNK_SIZE) {
        // Long document: use chunked generation (map-reduce)
        const chunks = splitTextIntoChunks(rawText)

        // Build quiz prompt template with placeholders replaced except {text}
        const quizPromptTemplate = QUIZ_GENERATION_PROMPT.replace('{questionCount}', String(options.questionCount))
          .replace('{questionTypes}', options.questionTypes)
          .replace('{difficulty}', options.difficulty)

        const combinePrompt = COMBINE_QUIZ_QUESTIONS_PROMPT.replace('{questionCount}', String(options.questionCount))

        runChunkedAiGeneration({
          documentId,
          operationType: 'quiz',
          model,
          baseUrl,
          chunks,
          promptTemplate: quizPromptTemplate,
          combinePromptTemplate: combinePrompt,
          sendStreamEvent,
          saveResult: (finalText: string) => {
            // Parse and validate quiz questions from combined result
            const parsed = parseQuizQuestions(finalText)
            if (parsed) {
              const valid = parsed.map((q) => validateQuizQuestion(q)).filter((q) => q !== null)

              if (valid.length > 0) {
                const quizTitle = `Quiz: ${result.document.name} - ${options.difficulty} (${valid.length}Q)`
                const quiz = createQuiz({
                  document_id: documentId,
                  title: quizTitle,
                  question_count: valid.length,
                  difficulty_level: options.difficulty,
                  question_types: options.questionTypes,
                  questions: valid.map((q) => ({
                    question: q!.question,
                    options: q!.options ?? undefined,
                    correct_answer: q!.correct_answer,
                    explanation: q!.explanation ?? undefined,
                    type: q!.type,
                    difficulty: q!.difficulty,
                  })),
                })
                log.info(`[ai] Chunked quiz generation saved quiz ${quiz.id} for document ${documentId}`)

                // Send done event with quizId for toast navigation
                sendStreamEvent({
                  documentId,
                  operationType: 'quiz',
                  chunk: '',
                  done: true,
                  quizId: quiz.id,
                })
              }
            }
          },
        })
      } else {
        // Short document: single-pass generation with quiz-specific helper
        const prompt = buildQuizPrompt(rawText, options)
        runQuizGeneration(documentId, result.document.name, model, prompt, options, rawText, baseUrl)
      }

      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('AI_GENERATE_QUIZ_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  // ─── Settings ──────────────────────────────────────────────────
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, async (_event, key: string) => {
    try {
      const value = getSetting(key)
      return createIpcSuccess(value)
    } catch (error) {
      return createIpcError('SETTINGS_GET_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_SET, async (_event, key: string, value: string) => {
    try {
      setSetting(key, value)
      return createIpcSuccess(undefined as void)
    } catch (error) {
      return createIpcError('SETTINGS_SET_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_ALL, async () => {
    try {
      const result = getAllSettings()
      return createIpcSuccess(result)
    } catch (error) {
      return createIpcError('SETTINGS_GET_ALL_ERROR', error instanceof Error ? error.message : 'Unknown error')
    }
  })
}
