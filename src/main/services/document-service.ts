import { eq, sql } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { documents, documentContent, projects, folders } from '@main/database/schema'
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
):
  | { document: Document; content: DocumentContent | undefined; project_name: string; folder_name: string }
  | undefined => {
  const doc = getDb().select().from(documents).where(eq(documents.id, id)).get()
  if (!doc) return undefined

  const content = getDb().select().from(documentContent).where(eq(documentContent.document_id, id)).get()

  const project = getDb().select({ name: projects.name }).from(projects).where(eq(projects.id, doc.project_id)).get()
  const folder = getDb().select({ name: folders.name }).from(folders).where(eq(folders.id, doc.folder_id)).get()

  return {
    document: doc,
    content,
    project_name: project?.name ?? '',
    folder_name: folder?.name ?? '',
  }
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
  key_terms?: Array<{ term: string; definition: string }>
  summary_style?: string
}) => {
  return getDb()
    .insert(documentContent)
    .values({
      ...data,
      processed_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: documentContent.document_id,
      set: {
        raw_text: data.raw_text !== undefined ? sql`${data.raw_text}` : sql`${documentContent.raw_text}`,
        summary: data.summary !== undefined ? sql`${data.summary}` : sql`${documentContent.summary}`,
        key_points:
          data.key_points !== undefined ? sql`${JSON.stringify(data.key_points)}` : sql`${documentContent.key_points}`,
        key_terms:
          data.key_terms !== undefined ? sql`${JSON.stringify(data.key_terms)}` : sql`${documentContent.key_terms}`,
        summary_style:
          data.summary_style !== undefined ? sql`${data.summary_style}` : sql`${documentContent.summary_style}`,
        processed_at: new Date().toISOString(),
      },
    })
    .returning()
    .get()
}
