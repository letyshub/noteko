import { eq } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { projects } from '@main/database/schema'

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
