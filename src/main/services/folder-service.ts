import { eq } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { folders } from '@main/database/schema'

export const listFolders = (projectId: number) => {
  return getDb().select().from(folders).where(eq(folders.project_id, projectId)).all()
}

export const createFolder = (data: { name: string; project_id: number; parent_folder_id?: number }) => {
  return getDb()
    .insert(folders)
    .values({
      ...data,
      created_at: new Date().toISOString(),
    })
    .returning()
    .get()
}

export const updateFolder = (id: number, data: { name?: string; parent_folder_id?: number | null }) => {
  return getDb().update(folders).set(data).where(eq(folders.id, id)).returning().get()
}

export const deleteFolder = (id: number) => {
  return getDb().delete(folders).where(eq(folders.id, id)).returning().get()
}
