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

  // Event subscriptions (main -> renderer push)
  on: (channel, callback) => {
    const listener = (_event: IpcRendererEvent, data: unknown) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback(data as any)
    ipcRenderer.on(channel, listener)
  },
  off: (channel, callback) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ipcRenderer.removeListener(channel, callback as any)
  },
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
