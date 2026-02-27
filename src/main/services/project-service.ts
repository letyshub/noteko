import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '@main/database/connection'
import { projects } from '@main/database/schema'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import log from 'electron-log'

export const listProjects = () => {
  return getDb().select().from(projects).all()
}

export const getProject = (id: number) => {
  return getDb().select().from(projects).where(eq(projects.id, id)).get()
}

export const createProject = (data: { name: string; description?: string; color?: string }) => {
  return getDb()
    .insert(projects)
    .values({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning()
    .get()
}

export const updateProject = (id: number, data: { name?: string; description?: string; color?: string }) => {
  return getDb()
    .update(projects)
    .set({ ...data, updated_at: new Date().toISOString() })
    .where(eq(projects.id, id))
    .returning()
    .get()
}

export const deleteProject = (id: number) => {
  return getDb().delete(projects).where(eq(projects.id, id)).returning().get()
}

export const cascadeDeleteProject = (id: number) => {
  const sqlite = getSqlite()

  log.info(`[cascadeDeleteProject] Starting cascade delete for project id=${id}`)

  // Collect all document IDs for this project
  const docRows = sqlite.prepare<[number], { id: number }>('SELECT id FROM documents WHERE project_id = ?').all(id)
  const docIds = docRows.map((d) => d.id)

  log.info(`[cascadeDeleteProject] documents to delete: ${docIds.length}`)

  const runDelete = sqlite.transaction(() => {
    if (docIds.length > 0) {
      const docPlaceholders = docIds.map(() => '?').join(',')

      // Quiz attempts → questions → quizzes
      const quizRows = sqlite
        .prepare<number[], { id: number }>(`SELECT id FROM quizzes WHERE document_id IN (${docPlaceholders})`)
        .all(...docIds)
      const quizIds = quizRows.map((q) => q.id)

      if (quizIds.length > 0) {
        const quizPlaceholders = quizIds.map(() => '?').join(',')
        sqlite.prepare(`DELETE FROM quiz_attempts WHERE quiz_id IN (${quizPlaceholders})`).run(...quizIds)
        sqlite.prepare(`DELETE FROM quiz_questions WHERE quiz_id IN (${quizPlaceholders})`).run(...quizIds)
        sqlite.prepare(`DELETE FROM quizzes WHERE id IN (${quizPlaceholders})`).run(...quizIds)
        log.info(`[cascadeDeleteProject] deleted ${quizIds.length} quiz(zes)`)
      }

      // Chat messages → conversations
      const convRows = sqlite
        .prepare<
          number[],
          { id: number }
        >(`SELECT id FROM chat_conversations WHERE document_id IN (${docPlaceholders})`)
        .all(...docIds)
      const convIds = convRows.map((c) => c.id)

      if (convIds.length > 0) {
        const convPlaceholders = convIds.map(() => '?').join(',')
        sqlite.prepare(`DELETE FROM chat_messages WHERE conversation_id IN (${convPlaceholders})`).run(...convIds)
        sqlite.prepare(`DELETE FROM chat_conversations WHERE id IN (${convPlaceholders})`).run(...convIds)
        log.info(`[cascadeDeleteProject] deleted ${convIds.length} chat conversation(s)`)
      }

      // document_tags, document_content, documents
      sqlite.prepare(`DELETE FROM document_tags WHERE document_id IN (${docPlaceholders})`).run(...docIds)
      sqlite.prepare(`DELETE FROM document_content WHERE document_id IN (${docPlaceholders})`).run(...docIds)
      sqlite.prepare('DELETE FROM documents WHERE project_id = ?').run(id)
      log.info(`[cascadeDeleteProject] deleted ${docIds.length} document(s)`)
    }

    // All folders for this project, then the project itself
    sqlite.prepare('DELETE FROM folders WHERE project_id = ?').run(id)
    sqlite.prepare('DELETE FROM projects WHERE id = ?').run(id)
    log.info(`[cascadeDeleteProject] deleted project id=${id}`)
  })

  runDelete()

  // Clean up physical files (best-effort)
  try {
    const docsDir = path.join(app.getPath('userData'), 'documents', String(id))
    fs.rmSync(docsDir, { recursive: true, force: true })
  } catch {
    // Ignore — directory may not exist in test/dev environments
  }
}
