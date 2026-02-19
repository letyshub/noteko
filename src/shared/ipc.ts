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

/** IPC channel name constants. */
export const IPC_CHANNELS = {
  PING: 'ping',
} as const

/**
 * Maps each IPC channel to its request args tuple and response type.
 * Use string literal keys matching the values in IPC_CHANNELS.
 */
export interface IpcChannelMap {
  ping: { args: []; response: string }
}

/**
 * The typed API exposed to the renderer via contextBridge.
 * Each method corresponds to an IPC channel and returns a Promise of the
 * channel's response type.
 */
export type ElectronAPI = {
  [K in keyof IpcChannelMap]: (...args: IpcChannelMap[K]['args']) => Promise<IpcChannelMap[K]['response']>
}
