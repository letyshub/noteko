import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import {
  projects,
  folders,
  documents,
  documentContent,
  quizzes,
  quizQuestions,
  quizAttempts,
} from '@main/database/schema'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'

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
  const db = getDb()

  db.transaction((tx) => {
    // Collect document IDs for this project
    const docRows = tx.select({ id: documents.id }).from(documents).where(eq(documents.project_id, id)).all()
    const docIds = docRows.map((d) => d.id)

    if (docIds.length > 0) {
      // Collect quiz IDs for those documents
      const quizRows = tx.select({ id: quizzes.id }).from(quizzes).where(inArray(quizzes.document_id, docIds)).all()
      const quizIds = quizRows.map((q) => q.id)

      if (quizIds.length > 0) {
        tx.delete(quizAttempts).where(inArray(quizAttempts.quiz_id, quizIds)).run()
        tx.delete(quizQuestions).where(inArray(quizQuestions.quiz_id, quizIds)).run()
        tx.delete(quizzes).where(inArray(quizzes.document_id, docIds)).run()
      }

      tx.delete(documentContent).where(inArray(documentContent.document_id, docIds)).run()
      tx.delete(documents).where(eq(documents.project_id, id)).run()
    }

    tx.delete(folders).where(eq(folders.project_id, id)).run()
    tx.delete(projects).where(eq(projects.id, id)).run()
  })

  // Clean up physical files (best-effort, won't work in tests)
  try {
    const docsDir = path.join(app.getPath('userData'), 'documents', String(id))
    fs.rmSync(docsDir, { recursive: true, force: true })
  } catch {
    // Ignore file cleanup errors (e.g., directory doesn't exist, test environment)
  }
}
