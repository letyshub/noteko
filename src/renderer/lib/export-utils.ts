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

/**
 * Convert an array of row objects to a CSV string.
 *
 * @param rows - Array of objects to serialize.
 * @param columns - Column definitions: `{ key, header }` pairs.
 * @returns A CSV string with headers and data rows.
 */
export function toCsvString<T extends object>(rows: T[], columns: Array<{ key: keyof T; header: string }>): string {
  const header = columns.map((c) => escapeCsvField(String(c.header))).join(',')
  const dataRows = rows.map((row) => columns.map((c) => escapeCsvField(String(row[c.key] ?? ''))).join(','))
  return [header, ...dataRows].join('\n')
}

/**
 * Escape a single CSV field value.
 * Wraps in double quotes if the value contains commas, quotes, or newlines.
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Serialise `data` as CSV and save it to disk via the Electron main process.
 *
 * Opens a native "Save As" dialog with `defaultFilename` pre-filled.
 * Returns the chosen file path on success, or `null` if the user cancels.
 */
export async function exportAsCsv(data: string, defaultFilename: string): Promise<string | null> {
  const result = await window.electronAPI['file:export-csv'](data, defaultFilename)
  if (!result.success) return null
  return result.data ?? null
}
