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
