/**
 * File service for validating, copying, and managing uploaded files.
 *
 * Handles file validation (type, size), storage management (copy to
 * app storage directory), file picker dialog, and cleanup (delete).
 */

import fs from 'node:fs'
import path from 'node:path'
import { app, dialog } from 'electron'
import log from 'electron-log'
import type { FileValidationResult } from '@shared/types'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum file size in bytes (50 MB). */
const MAX_FILE_SIZE = 50 * 1024 * 1024

/** File extensions allowed for upload. */
const ALLOWED_EXTENSIONS = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'txt', 'csv', 'md']

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the base storage directory for uploaded files.
 * - Production: `userData/files/`
 * - Development: `cwd()/files/`
 */
const getStorageBase = (): string => {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'files')
  }
  return path.join(process.cwd(), 'files')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a file at the given path.
 * Checks existence, file size (max 50 MB), and extension against the allow-list.
 */
export const validateFile = (filePath: string): FileValidationResult => {
  const fileName = path.basename(filePath)
  const ext = path.extname(filePath).replace('.', '').toLowerCase()

  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `File does not exist: ${filePath}`, name: fileName, size: 0, type: ext }
  }

  const stats = fs.statSync(filePath)

  if (stats.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File exceeds maximum size of 50 MB (${(stats.size / (1024 * 1024)).toFixed(1)} MB)`,
      name: fileName,
      size: stats.size,
      type: ext,
    }
  }

  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: `File type "${ext}" is not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`,
      name: fileName,
      size: stats.size,
      type: ext,
    }
  }

  return { valid: true, name: fileName, size: stats.size, type: ext }
}

/**
 * Copy a file from its source location into the app's storage directory.
 * Creates the target directory if it doesn't exist.
 * Uses a timestamp prefix to avoid filename collisions.
 *
 * @returns The absolute path to the copied file.
 */
export const copyFileToStorage = (sourcePath: string, projectId: number): string => {
  const fileName = path.basename(sourcePath)
  const uniqueName = `${Date.now()}-${fileName}`
  const destDir = path.join(getStorageBase(), String(projectId))
  const destPath = path.join(destDir, uniqueName)

  fs.mkdirSync(destDir, { recursive: true })
  fs.copyFileSync(sourcePath, destPath)

  log.info(`File copied to storage: ${destPath}`)
  return destPath
}

/**
 * Open Electron's native file picker dialog.
 * Filters by the allowed file types.
 *
 * @returns Array of selected file paths, or empty array if cancelled.
 */
export const openFilePickerDialog = async (): Promise<string[]> => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters: [
      {
        name: 'Documents',
        extensions: ALLOWED_EXTENSIONS,
      },
    ],
  })

  if (result.canceled) {
    return []
  }

  return result.filePaths
}

/**
 * Delete a file from storage.
 * Used for rollback when a DB insert fails after copying.
 * Silently ignores ENOENT errors (file already gone).
 */
export const deleteFileFromStorage = (filePath: string): void => {
  try {
    fs.unlinkSync(filePath)
    log.info(`File deleted from storage: ${filePath}`)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      log.warn(`File not found during delete (already removed?): ${filePath}`)
      return
    }
    throw error
  }
}
