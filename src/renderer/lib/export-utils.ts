/**
 * Export utilities for saving data to the local filesystem.
 * Delegates file-writing to the main process via IPC.
 */

/**
 * Serialise `data` as pretty-printed JSON and save it to disk via the
 * Electron main process.
 *
 * Opens a native "Save As" dialog with `defaultFilename` pre-filled.
 * Returns the chosen file path on success, or `null` if the user cancels.
 */
export async function exportAsJson(data: unknown, defaultFilename: string): Promise<string | null> {
  const serialized = JSON.stringify(data, null, 2)
  const result = await window.electronAPI['file:export-json'](serialized, defaultFilename)
  if (!result.success) return null
  return result.data ?? null
}
