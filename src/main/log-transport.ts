/**
 * Custom electron-log transport that persists all log calls to the app_logs table.
 *
 * Intercepts each log message, parses the category from the [prefix] pattern,
 * inserts into the database via Drizzle, and pushes a real-time `logs:new`
 * event to the renderer process.
 */

import log from 'electron-log'
import { getDb } from '@main/database/connection'
import { appLogs } from '@main/database/schema'
import { parseCategory } from '@main/services/log-service'
import { getMainWindow } from '@main/main-window'

/** Whether the DB transport is ready to accept writes. */
let dbReady = false

/**
 * Register the custom database transport on the electron-log instance.
 *
 * Must be called AFTER `initializeDatabase()` so the DB connection is available.
 * Wraps DB writes in try/catch to prevent infinite logging loops.
 */
export function registerLogTransport(): void {
  dbReady = true

  // Add a custom transport that writes to the database.
  // In electron-log v5, custom transports are functions assigned to log.transports.
  const dbTransport = (message: { data: unknown[]; level: string; date: Date }): void => {
    if (!dbReady) return

    try {
      const db = getDb()

      // Build message text from the data array
      const messageText = message.data
        .map((item) => {
          if (item instanceof Error) return item.message
          if (typeof item === 'string') return item
          try {
            return JSON.stringify(item)
          } catch {
            return String(item)
          }
        })
        .join(' ')

      const level = message.level
      const category = parseCategory(messageText)

      // Insert into database
      const inserted = db
        .insert(appLogs)
        .values({
          level,
          message: messageText,
          category,
          context: null,
          created_at: new Date().toISOString(),
        })
        .returning()
        .get()

      // Push real-time event to renderer
      const win = getMainWindow()
      if (win) {
        win.webContents.send('logs:new', { log: inserted })
      }
    } catch {
      // Do NOT re-log the error to prevent infinite loops.
      // Use console.error instead for diagnostics.

      console.error('log-transport: failed to persist log to database')
    }
  }

  // Register as a custom transport on electron-log
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(log.transports as any).db = dbTransport
}
