/**
 * Preload script for Noteko.
 *
 * Runs in a sandboxed context with access to a limited subset of Node.js APIs.
 * Uses contextBridge to safely expose a typed electronAPI object to the renderer.
 *
 * See: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */

import { contextBridge, ipcRenderer } from 'electron'
import type { IpcRendererEvent } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { ElectronAPI } from '@shared/ipc'

const electronAPI: ElectronAPI = {
  // Ping
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),

  // Projects
  'db:projects:list': () => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST),
  'db:projects:get': (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_GET, id),
  'db:projects:create': (input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CREATE, input),
  'db:projects:update': (id, input) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_UPDATE, id, input),
  'db:projects:delete': (id) => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_DELETE, id),

  // Folders
  'db:folders:list': (projectId) => ipcRenderer.invoke(IPC_CHANNELS.FOLDERS_LIST, projectId),
  'db:folders:create': (input) => ipcRenderer.invoke(IPC_CHANNELS.FOLDERS_CREATE, input),
  'db:folders:update': (id, input) => ipcRenderer.invoke(IPC_CHANNELS.FOLDERS_UPDATE, id, input),
  'db:folders:delete': (id) => ipcRenderer.invoke(IPC_CHANNELS.FOLDERS_DELETE, id),

  // Documents
  'db:documents:list': (folderId) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_LIST, folderId),
  'db:documents:list-by-project': (projectId) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_LIST_BY_PROJECT, projectId),
  'db:documents:get': (id) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_GET, id),
  'db:documents:create': (input) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_CREATE, input),
  'db:documents:update': (id, input) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_UPDATE, id, input),
  'db:documents:delete': (id) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_DELETE, id),

  // Quizzes
  'db:quizzes:list': (documentId) => ipcRenderer.invoke(IPC_CHANNELS.QUIZZES_LIST, documentId),
  'db:quizzes:get': (id) => ipcRenderer.invoke(IPC_CHANNELS.QUIZZES_GET, id),
  'db:quizzes:create': (input) => ipcRenderer.invoke(IPC_CHANNELS.QUIZZES_CREATE, input),
  'db:quizzes:delete': (id) => ipcRenderer.invoke(IPC_CHANNELS.QUIZZES_DELETE, id),

  // Quiz Attempts
  'db:quiz-attempts:list': (quizId) => ipcRenderer.invoke(IPC_CHANNELS.QUIZ_ATTEMPTS_LIST, quizId),
  'db:quiz-attempts:create': (input) => ipcRenderer.invoke(IPC_CHANNELS.QUIZ_ATTEMPTS_CREATE, input),

  // Dashboard
  'db:dashboard:stats': () => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_STATS),
  'db:dashboard:recent-docs': () => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_RECENT_DOCS),
  'db:dashboard:recent-attempts': () => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_RECENT_ATTEMPTS),
  'db:dashboard:projects-with-counts': () => ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD_PROJECTS_WITH_COUNTS),

  // Quiz History (aggregates)
  'db:quiz-history:list-all': () => ipcRenderer.invoke(IPC_CHANNELS.QUIZ_HISTORY_LIST_ALL),
  'db:quiz-history:overview-stats': () => ipcRenderer.invoke(IPC_CHANNELS.QUIZ_HISTORY_OVERVIEW_STATS),
  'db:quiz-history:per-quiz-stats': () => ipcRenderer.invoke(IPC_CHANNELS.QUIZ_HISTORY_PER_QUIZ_STATS),
  'db:quiz-history:weak-areas': () => ipcRenderer.invoke(IPC_CHANNELS.QUIZ_HISTORY_WEAK_AREAS),

  // Files
  'file:open-dialog': () => ipcRenderer.invoke(IPC_CHANNELS.FILE_OPEN_DIALOG),
  'file:upload': (input) => ipcRenderer.invoke(IPC_CHANNELS.FILE_UPLOAD, input),
  'file:validate': (filePath) => ipcRenderer.invoke(IPC_CHANNELS.FILE_VALIDATE, filePath),
  'file:export-json': (data, defaultFilename) =>
    ipcRenderer.invoke(IPC_CHANNELS.FILE_EXPORT_JSON, data, defaultFilename),

  // Document Parsing
  'doc:parse': (documentId) => ipcRenderer.invoke(IPC_CHANNELS.DOC_PARSE, documentId),
  'doc:parse:retry': (documentId) => ipcRenderer.invoke(IPC_CHANNELS.DOC_PARSE_RETRY, documentId),

  // AI / Ollama
  'ai:health-check': () => ipcRenderer.invoke(IPC_CHANNELS.AI_HEALTH_CHECK),
  'ai:list-models': () => ipcRenderer.invoke(IPC_CHANNELS.AI_LIST_MODELS),
  'ai:summarize': (documentId, options) => ipcRenderer.invoke(IPC_CHANNELS.AI_SUMMARIZE, documentId, options),
  'ai:extract-key-points': (documentId) => ipcRenderer.invoke(IPC_CHANNELS.AI_EXTRACT_KEY_POINTS, documentId),
  'ai:extract-key-terms': (documentId) => ipcRenderer.invoke(IPC_CHANNELS.AI_EXTRACT_KEY_TERMS, documentId),
  'ai:generate-quiz': (documentId, options) => ipcRenderer.invoke(IPC_CHANNELS.AI_GENERATE_QUIZ, documentId, options),
  'ai:chat': (input) => ipcRenderer.invoke(IPC_CHANNELS.AI_CHAT, input),

  // Chat (DB)
  'db:chat:conversations:get': (documentId) => ipcRenderer.invoke(IPC_CHANNELS.DB_CHAT_CONVERSATIONS_GET, documentId),
  'db:chat:messages:list': (conversationId) => ipcRenderer.invoke(IPC_CHANNELS.DB_CHAT_MESSAGES_LIST, conversationId),
  'db:chat:messages:create': (conversationId, role, content) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CHAT_MESSAGES_CREATE, conversationId, role, content),
  'db:chat:conversations:delete': (conversationId) =>
    ipcRenderer.invoke(IPC_CHANNELS.DB_CHAT_CONVERSATIONS_DELETE, conversationId),

  // Settings
  'settings:get': (key) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET, key),
  'settings:set': (key, value) => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, key, value),
  'settings:get-all': () => ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_ALL),

  // Logs
  'db:logs:list': (filter) => ipcRenderer.invoke(IPC_CHANNELS.LOGS_LIST, filter),
  'db:logs:stats': () => ipcRenderer.invoke(IPC_CHANNELS.LOGS_STATS),
  'db:logs:clear': () => ipcRenderer.invoke(IPC_CHANNELS.LOGS_CLEAR),
  'db:logs:report-error': (level, message, context) =>
    ipcRenderer.invoke(IPC_CHANNELS.LOGS_REPORT_ERROR, level, message, context),

  // Search
  'db:documents:search': (filter) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_SEARCH, filter),
  'db:search:recent-list': () => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_RECENT_LIST),
  'db:search:recent-save': (query, resultCount) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_RECENT_SAVE, query, resultCount),
  'db:search:recent-clear': () => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_RECENT_CLEAR),
  'db:search:recent-delete': (id) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_RECENT_DELETE, id),

  // CSV Export
  'file:export-csv': (data, defaultFilename) => ipcRenderer.invoke(IPC_CHANNELS.FILE_EXPORT_CSV, data, defaultFilename),

  // Tags
  'db:tags:list': () => ipcRenderer.invoke(IPC_CHANNELS.TAGS_LIST),
  'db:tags:create': (input) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_CREATE, input),
  'db:tags:update': (id, input) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_UPDATE, id, input),
  'db:tags:delete': (id) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_DELETE, id),
  'db:document-tags:get': (documentId) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENT_TAGS_GET, documentId),
  'db:document-tags:set': (input) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENT_TAGS_SET, input),
  'db:document-tags:batch-get': (documentIds) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENT_TAGS_BATCH_GET, documentIds),
  'db:tags:cloud': () => ipcRenderer.invoke(IPC_CHANNELS.TAGS_CLOUD),
  'db:tags:suggest': (query) => ipcRenderer.invoke(IPC_CHANNELS.TAGS_SUGGEST, query),
  'db:documents:by-tags': (tagIds) => ipcRenderer.invoke(IPC_CHANNELS.DOCUMENTS_BY_TAGS, tagIds),

  // App
  'app:get-storage-path': () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_STORAGE_PATH),
  'app:clear-cache': () => ipcRenderer.invoke(IPC_CHANNELS.APP_CLEAR_CACHE),

  // Event subscriptions (main -> renderer push)
  on: (channel, callback) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback(data as any)
    ipcRenderer.on(channel, listener)
    return listener
  },
  off: (channel, callback) => {
    ipcRenderer.removeListener(channel, callback)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
