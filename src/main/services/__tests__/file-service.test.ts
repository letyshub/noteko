import { describe, expect, it, beforeEach, vi } from 'vitest'
import path from 'node:path'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue('/mock/userData'),
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}))

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// Create mock functions for fs so we can control them per test
const mockExistsSync = vi.fn()
const mockStatSync = vi.fn()
const mockMkdirSync = vi.fn()
const mockCopyFileSync = vi.fn()
const mockUnlinkSync = vi.fn()

vi.mock('node:fs', () => ({
  default: {
    existsSync: (...args: unknown[]) => mockExistsSync(...args),
    statSync: (...args: unknown[]) => mockStatSync(...args),
    mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
    copyFileSync: (...args: unknown[]) => mockCopyFileSync(...args),
    unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
  },
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  statSync: (...args: unknown[]) => mockStatSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
  copyFileSync: (...args: unknown[]) => mockCopyFileSync(...args),
  unlinkSync: (...args: unknown[]) => mockUnlinkSync(...args),
}))

describe('file-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── validateFile ─────────────────────────────────────────────

  describe('validateFile', () => {
    it('should return valid result for an allowed file within size limit', async () => {
      const { validateFile } = await import('@main/services/file-service')

      mockExistsSync.mockReturnValue(true)
      mockStatSync.mockReturnValue({ size: 1024 * 1024 }) // 1 MB

      const result = validateFile('/some/path/document.pdf')

      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
      expect(result.name).toBe('document.pdf')
      expect(result.size).toBe(1024 * 1024)
      expect(result.type).toBe('pdf')
    })

    it('should return invalid result when file does not exist', async () => {
      const { validateFile } = await import('@main/services/file-service')

      mockExistsSync.mockReturnValue(false)

      const result = validateFile('/some/path/missing.pdf')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('does not exist')
    })

    it('should return invalid result when file exceeds 50 MB', async () => {
      const { validateFile } = await import('@main/services/file-service')

      mockExistsSync.mockReturnValue(true)
      mockStatSync.mockReturnValue({ size: 51 * 1024 * 1024 }) // 51 MB

      const result = validateFile('/some/path/huge.pdf')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('50 MB')
    })

    it('should return invalid result for a disallowed file type', async () => {
      const { validateFile } = await import('@main/services/file-service')

      mockExistsSync.mockReturnValue(true)
      mockStatSync.mockReturnValue({ size: 1024 })

      const result = validateFile('/some/path/script.exe')

      expect(result.valid).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('should accept all specified allowed extensions', async () => {
      const { validateFile } = await import('@main/services/file-service')

      const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'txt', 'csv', 'md']

      for (const ext of allowedExtensions) {
        mockExistsSync.mockReturnValue(true)
        mockStatSync.mockReturnValue({ size: 1024 })

        const result = validateFile(`/some/path/file.${ext}`)
        expect(result.valid).toBe(true)
        expect(result.type).toBe(ext)
      }
    })
  })

  // ─── copyFileToStorage ────────────────────────────────────────

  describe('copyFileToStorage', () => {
    it('should create the target directory and copy the file', async () => {
      const { copyFileToStorage } = await import('@main/services/file-service')

      mockCopyFileSync.mockReturnValue(undefined)
      mockMkdirSync.mockReturnValue(undefined)

      const destPath = copyFileToStorage('/source/report.pdf', 42)

      // Should have created the directory
      expect(mockMkdirSync).toHaveBeenCalledWith(expect.stringContaining(path.join('files', '42')), { recursive: true })

      // Should have copied the file
      expect(mockCopyFileSync).toHaveBeenCalledWith('/source/report.pdf', expect.stringContaining('report.pdf'))

      // Returned path should include the project ID directory and timestamp prefix
      expect(destPath).toContain(path.join('files', '42'))
      expect(destPath).toContain('report.pdf')
    })

    it('should generate a unique filename with a timestamp prefix', async () => {
      const { copyFileToStorage } = await import('@main/services/file-service')

      mockCopyFileSync.mockReturnValue(undefined)
      mockMkdirSync.mockReturnValue(undefined)

      const destPath = copyFileToStorage('/source/image.png', 7)

      // The filename should have a timestamp prefix (digits followed by dash)
      const filename = path.basename(destPath)
      expect(filename).toMatch(/^\d+-image\.png$/)
    })
  })

  // ─── deleteFileFromStorage ────────────────────────────────────

  describe('deleteFileFromStorage', () => {
    it('should delete the file at the given path', async () => {
      const { deleteFileFromStorage } = await import('@main/services/file-service')

      mockUnlinkSync.mockReturnValue(undefined)

      deleteFileFromStorage('/mock/userData/files/42/12345-report.pdf')

      expect(mockUnlinkSync).toHaveBeenCalledWith('/mock/userData/files/42/12345-report.pdf')
    })

    it('should not throw if the file does not exist', async () => {
      const { deleteFileFromStorage } = await import('@main/services/file-service')

      mockUnlinkSync.mockImplementation(() => {
        const err = new Error('ENOENT') as NodeJS.ErrnoException
        err.code = 'ENOENT'
        throw err
      })

      expect(() => deleteFileFromStorage('/nonexistent/file.pdf')).not.toThrow()
    })
  })

  // ─── openFilePickerDialog ─────────────────────────────────────

  describe('openFilePickerDialog', () => {
    it('should call dialog.showOpenDialog and return selected file paths', async () => {
      const { dialog } = await import('electron')
      const { openFilePickerDialog } = await import('@main/services/file-service')

      const mockDialog = dialog.showOpenDialog as ReturnType<typeof vi.fn>
      mockDialog.mockResolvedValue({ canceled: false, filePaths: ['/path/to/file.pdf'] })

      const result = await openFilePickerDialog()

      expect(result).toEqual(['/path/to/file.pdf'])
      expect(mockDialog).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.arrayContaining(['openFile']),
          filters: expect.arrayContaining([
            expect.objectContaining({
              extensions: expect.arrayContaining(['pdf', 'png', 'jpg']),
            }),
          ]),
        }),
      )
    })

    it('should return empty array when dialog is cancelled', async () => {
      const { dialog } = await import('electron')
      const { openFilePickerDialog } = await import('@main/services/file-service')

      const mockDialog = dialog.showOpenDialog as ReturnType<typeof vi.fn>
      mockDialog.mockResolvedValue({ canceled: true, filePaths: [] })

      const result = await openFilePickerDialog()

      expect(result).toEqual([])
    })
  })
})
