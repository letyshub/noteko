import { describe, expect, it, vi } from 'vitest'
import os from 'node:os'

// Mock electron and electron-log
vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: vi.fn().mockReturnValue(os.tmpdir()),
  },
  dialog: {
    showSaveDialog: vi.fn(),
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

vi.mock('@main/database/connection', () => ({
  getDb: vi.fn(),
}))

describe('parseCategory', () => {
  it('should parse [ai] prefix and return "ai" category', async () => {
    const { parseCategory } = await import('@main/services/log-service')
    expect(parseCategory('[ai] Starting generation')).toBe('ai')
  })

  it('should parse [parsing-service] prefix and return "document" category', async () => {
    const { parseCategory } = await import('@main/services/log-service')
    expect(parseCategory('[parsing-service] Processing file')).toBe('document')
  })

  it('should return "app" as default when no prefix pattern is present', async () => {
    const { parseCategory } = await import('@main/services/log-service')
    expect(parseCategory('No prefix message')).toBe('app')
  })

  it('should return "app" for unknown/unmapped prefixes', async () => {
    const { parseCategory } = await import('@main/services/log-service')
    expect(parseCategory('[unknown-prefix] Something')).toBe('app')
  })

  it('should only parse the first bracket prefix when message contains multiple', async () => {
    const { parseCategory } = await import('@main/services/log-service')
    // [ollama-service] is first and maps to 'ai', even though [quiz] appears later
    expect(parseCategory('[ollama-service] Processing [quiz] data')).toBe('ai')
  })

  it('should be case-insensitive for prefix matching', async () => {
    const { parseCategory } = await import('@main/services/log-service')
    expect(parseCategory('[AI] Starting generation')).toBe('ai')
    expect(parseCategory('[Startup] App ready')).toBe('app')
  })
})
