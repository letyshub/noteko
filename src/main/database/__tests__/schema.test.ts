import { describe, expect, it } from 'vitest'
import { getTableColumns } from 'drizzle-orm'
import {
  projects,
  folders,
  documents,
  documentContent,
  quizzes,
  quizQuestions,
  quizAttempts,
  appLogs,
} from '@main/database/schema'

describe('schema definitions', () => {
  it('should export all 8 table definitions', () => {
    expect(projects).toBeDefined()
    expect(folders).toBeDefined()
    expect(documents).toBeDefined()
    expect(documentContent).toBeDefined()
    expect(quizzes).toBeDefined()
    expect(quizQuestions).toBeDefined()
    expect(quizAttempts).toBeDefined()
    expect(appLogs).toBeDefined()
  })

  it('should define projects table with correct columns', () => {
    const columns = getTableColumns(projects)
    const columnNames = Object.keys(columns)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('description')
    expect(columnNames).toContain('color')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('updated_at')
    expect(columnNames).toHaveLength(6)
  })

  it('should define folders table with self-referencing parent_folder_id foreign key', () => {
    const columns = getTableColumns(folders)
    const columnNames = Object.keys(columns)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('project_id')
    expect(columnNames).toContain('parent_folder_id')
    expect(columnNames).toContain('created_at')

    // parent_folder_id should be nullable (not marked notNull)
    expect(columns.parent_folder_id.notNull).toBe(false)
  })

  it('should define documents table with foreign keys to folders and projects', () => {
    const columns = getTableColumns(documents)
    const columnNames = Object.keys(columns)

    expect(columnNames).toContain('id')
    expect(columnNames).toContain('name')
    expect(columnNames).toContain('file_path')
    expect(columnNames).toContain('file_type')
    expect(columnNames).toContain('file_size')
    expect(columnNames).toContain('folder_id')
    expect(columnNames).toContain('project_id')
    expect(columnNames).toContain('created_at')
    expect(columnNames).toContain('updated_at')

    // folder_id and project_id should be present and required
    expect(columns.folder_id.notNull).toBe(true)
    expect(columns.project_id.notNull).toBe(true)
  })

  it('should define JSON columns with text column type', () => {
    const contentColumns = getTableColumns(documentContent)
    const questionColumns = getTableColumns(quizQuestions)
    const attemptColumns = getTableColumns(quizAttempts)
    const logColumns = getTableColumns(appLogs)

    // JSON columns use text({ mode: 'json' }), which drizzle reports as dataType 'json'
    expect(contentColumns.key_points.dataType).toBe('json')
    expect(questionColumns.options.dataType).toBe('json')
    expect(attemptColumns.answers.dataType).toBe('json')
    expect(logColumns.context.dataType).toBe('json')

    // Verify the underlying column type is 'text' in SQLite
    expect(contentColumns.key_points.columnType).toBe('SQLiteTextJson')
    expect(questionColumns.options.columnType).toBe('SQLiteTextJson')
    expect(attemptColumns.answers.columnType).toBe('SQLiteTextJson')
    expect(logColumns.context.columnType).toBe('SQLiteTextJson')
  })
})
