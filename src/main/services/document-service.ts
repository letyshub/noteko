import { eq } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { documents, documentContent } from '@main/database/schema'
import type { Document, DocumentContent } from '@main/database/schema'

export const listDocumentsByProject = (projectId: number) => {
  return getDb().select().from(documents).where(eq(documents.project_id, projectId)).all()
}

export const listDocumentsByFolder = (folderId: number) => {
  return getDb().select().from(documents).where(eq(documents.folder_id, folderId)).all()
}

export const getDocument = (id: number) => {
  return getDb().select().from(documents).where(eq(documents.id, id)).get()
}

export const getDocumentWithContent = (
  id: number,
): { document: Document; content: DocumentContent | undefined } | undefined => {
  const doc = getDb().select().from(documents).where(eq(documents.id, id)).get()
  if (!doc) return undefined

  const content = getDb().select().from(documentContent).where(eq(documentContent.document_id, id)).get()

  return { document: doc, content }
}

export const createDocument = (data: {
  name: string
  file_path: string
  file_type: string
  file_size: number
  folder_id: number
  project_id: number
}) => {
  return getDb()
    .insert(documents)
    .values({
      ...data,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .returning()
    .get()
}

export const updateDocument = (id: number, data: { name?: string; folder_id?: number; project_id?: number }) => {
  return getDb()
    .update(documents)
    .set({ ...data, updated_at: new Date().toISOString() })
    .where(eq(documents.id, id))
    .returning()
    .get()
}

export const deleteDocument = (id: number) => {
  // Delete associated content first (FK constraint)
  getDb().delete(documentContent).where(eq(documentContent.document_id, id)).run()
  return getDb().delete(documents).where(eq(documents.id, id)).returning().get()
}

export const saveDocumentContent = (data: {
  document_id: number
  raw_text?: string
  summary?: string
  key_points?: string[]
}) => {
  return getDb()
    .insert(documentContent)
    .values({
      ...data,
      processed_at: new Date().toISOString(),
    })
    .returning()
    .get()
}
