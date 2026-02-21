/**
 * Module-level reference to the main BrowserWindow instance.
 *
 * Used by services (e.g. parsing-service) to push events to the renderer
 * process without requiring a direct import of the window creation code.
 */

import type { BrowserWindow } from 'electron'

let mainWindow: BrowserWindow | null = null

/**
 * Store a reference to the main BrowserWindow.
 * Called from createWindow() in index.ts.
 */
export function setMainWindow(win: BrowserWindow | null): void {
  mainWindow = win
}

/**
 * Get the current main BrowserWindow reference.
 * Returns null if no window has been created or it has been destroyed.
 */
export function getMainWindow(): BrowserWindow | null {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return mainWindow
  }
  return null
}
