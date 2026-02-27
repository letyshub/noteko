import { describe, it, expect } from 'vitest'
import { toCsvString } from '@renderer/lib/export-utils'

describe('toCsvString', () => {
  it('should handle special characters in values (commas, quotes, newlines)', () => {
    const rows = [
      { id: 1, message: 'Error with "quotes" and, commas', level: 'error' },
      { id: 2, message: 'Multi\nline\nmessage', level: 'info' },
    ]
    const columns = [
      { key: 'id' as const, header: 'ID' },
      { key: 'level' as const, header: 'Level' },
      { key: 'message' as const, header: 'Message' },
    ]

    const csv = toCsvString(rows, columns)
    const lines = csv.split('\n')

    // Header line
    expect(lines[0]).toBe('ID,Level,Message')
    // First data line: quotes should be escaped (doubled)
    expect(lines[1]).toBe('1,error,"Error with ""quotes"" and, commas"')
    // Second data line: newline should cause quoting
    expect(lines[2]).toContain('"Multi')
  })

  it('should return only header line when rows array is empty', () => {
    const columns = [
      { key: 'id' as const, header: 'ID' },
      { key: 'level' as const, header: 'Level' },
    ]

    const csv = toCsvString([], columns)
    expect(csv).toBe('ID,Level')
  })

  it('should handle null/undefined values gracefully', () => {
    const rows = [{ id: 1, category: null as unknown as string, message: 'test' }]
    const columns = [
      { key: 'id' as const, header: 'ID' },
      { key: 'category' as const, header: 'Category' },
      { key: 'message' as const, header: 'Message' },
    ]

    const csv = toCsvString(rows, columns)
    const lines = csv.split('\n')
    // null should become empty string
    expect(lines[1]).toBe('1,,test')
  })
})
