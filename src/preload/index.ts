/**
 * Preload script for Noteko.
 *
 * Runs in a sandboxed context with access to a limited subset of Node.js APIs.
 * Uses contextBridge to safely expose a typed electronAPI object to the renderer.
 *
 * See: https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
 */

import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '@shared/ipc'
import type { ElectronAPI } from '@shared/ipc'

const electronAPI: ElectronAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
