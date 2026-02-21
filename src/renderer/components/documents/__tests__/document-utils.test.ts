import { describe, expect, it } from 'vitest'
import { isPdf, isImage, isTextBased, isPreviewable, buildFileUrl } from '../document-utils'

describe('document-utils file-type categorization', () => {
  // ─── isPdf ──────────────────────────────────────────────────────
  describe('isPdf', () => {
    it('should return true for "pdf"', () => {
      expect(isPdf('pdf')).toBe(true)
    })

    it('should return false for non-pdf types', () => {
      expect(isPdf('png')).toBe(false)
      expect(isPdf('txt')).toBe(false)
      expect(isPdf('docx')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isPdf('')).toBe(false)
    })
  })

  // ─── isImage ────────────────────────────────────────────────────
  describe('isImage', () => {
    it('should return true for image extensions', () => {
      expect(isImage('png')).toBe(true)
      expect(isImage('jpg')).toBe(true)
      expect(isImage('jpeg')).toBe(true)
      expect(isImage('gif')).toBe(true)
    })

    it('should return false for non-image types', () => {
      expect(isImage('pdf')).toBe(false)
      expect(isImage('txt')).toBe(false)
      expect(isImage('docx')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isImage('')).toBe(false)
    })
  })

  // ─── isTextBased ────────────────────────────────────────────────
  describe('isTextBased', () => {
    it('should return true for text-based extensions', () => {
      expect(isTextBased('txt')).toBe(true)
      expect(isTextBased('md')).toBe(true)
      expect(isTextBased('csv')).toBe(true)
      expect(isTextBased('doc')).toBe(true)
      expect(isTextBased('docx')).toBe(true)
    })

    it('should return false for non-text types', () => {
      expect(isTextBased('pdf')).toBe(false)
      expect(isTextBased('png')).toBe(false)
      expect(isTextBased('gif')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isTextBased('')).toBe(false)
    })
  })

  // ─── isPreviewable ──────────────────────────────────────────────
  describe('isPreviewable', () => {
    it('should return true for all previewable extensions', () => {
      // PDF
      expect(isPreviewable('pdf')).toBe(true)
      // Images
      expect(isPreviewable('png')).toBe(true)
      expect(isPreviewable('jpg')).toBe(true)
      expect(isPreviewable('jpeg')).toBe(true)
      expect(isPreviewable('gif')).toBe(true)
      // Text-based
      expect(isPreviewable('txt')).toBe(true)
      expect(isPreviewable('md')).toBe(true)
      expect(isPreviewable('csv')).toBe(true)
      expect(isPreviewable('doc')).toBe(true)
      expect(isPreviewable('docx')).toBe(true)
    })

    it('should return false for unknown extension', () => {
      expect(isPreviewable('xyz')).toBe(false)
      expect(isPreviewable('exe')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isPreviewable('')).toBe(false)
    })
  })

  // ─── buildFileUrl ───────────────────────────────────────────────
  describe('buildFileUrl', () => {
    it('should handle Windows absolute paths with backslashes', () => {
      expect(buildFileUrl('D:\\Projects\\noteko\\files\\1\\doc.pdf')).toBe(
        'noteko-file://localhost/D:/Projects/noteko/files/1/doc.pdf',
      )
    })

    it('should handle Unix-style absolute paths', () => {
      expect(buildFileUrl('/files/research-paper.pdf')).toBe('noteko-file://localhost/files/research-paper.pdf')
    })

    it('should handle paths with forward slashes already', () => {
      expect(buildFileUrl('D:/Projects/noteko/files/1/doc.pdf')).toBe(
        'noteko-file://localhost/D:/Projects/noteko/files/1/doc.pdf',
      )
    })

    it('should not double leading slashes', () => {
      const url = buildFileUrl('/files/photo.png')
      expect(url).toBe('noteko-file://localhost/files/photo.png')
      // Ensure no double slash after localhost
      expect(url).not.toContain('localhost//')
    })
  })
})
