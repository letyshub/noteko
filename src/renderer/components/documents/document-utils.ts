import { File, FileText, FileImage } from 'lucide-react'

/**
 * Format bytes into a human-readable string (e.g., "2.3 MB", "156 KB").
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = bytes / Math.pow(k, i)
  return `${value % 1 === 0 ? value : value.toFixed(1)} ${units[i]}`
}

/**
 * Get the appropriate icon component based on file type (extension-based).
 */
export function getFileIcon(fileType: string) {
  if (fileType === 'pdf') return FileText
  if (['png', 'jpg', 'jpeg', 'gif'].includes(fileType)) return FileImage
  if (['doc', 'docx', 'txt', 'md', 'csv'].includes(fileType)) return FileText
  return File
}

// ---------------------------------------------------------------------------
// File-type categorization helpers
// ---------------------------------------------------------------------------

/** Check if the file type is a PDF (bare extension, not MIME type). */
export function isPdf(fileType: string): boolean {
  return fileType === 'pdf'
}

/** Check if the file type is an image (bare extension, not MIME type). */
export function isImage(fileType: string): boolean {
  return ['png', 'jpg', 'jpeg', 'gif'].includes(fileType)
}

/** Check if the file type is text-based (bare extension, not MIME type). */
export function isTextBased(fileType: string): boolean {
  return ['txt', 'md', 'csv', 'doc', 'docx'].includes(fileType)
}

/** Check if the file type can be previewed in the document viewer. */
export function isPreviewable(fileType: string): boolean {
  return isPdf(fileType) || isImage(fileType) || isTextBased(fileType)
}

/**
 * Build a noteko-file:// URL from an absolute file path stored in the DB.
 *
 * The protocol handler uses `new URL(request.url).pathname` to extract the
 * path, so we need a well-formed URL: `noteko-file://localhost/D:/path/file`.
 * On Windows the DB stores backslash paths (`D:\foo\bar`), which must be
 * converted to forward slashes for the URL to parse correctly.
 */
export function buildFileUrl(filePath: string): string {
  // Normalize Windows backslashes to forward slashes
  const normalized = filePath.replace(/\\/g, '/')
  // Ensure there is a leading slash (absolute paths like D:/... need one for URL)
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`
  return `noteko-file://localhost${withLeadingSlash}`
}
