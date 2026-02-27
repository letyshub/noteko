import { eq } from 'drizzle-orm'
import { getDb, getSqlite } from '@main/database/connection'
import { folders } from '@main/database/schema'
import log from 'electron-log'

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

/**
 * Cascade-delete a folder and all its descendants, including every document,
 * quiz, chat conversation/message, tag junction, and content record inside them.
 * Uses raw better-sqlite3 statements to avoid any Drizzle ORM transaction quirks.
 */
export const cascadeDeleteFolder = (id: number) => {
  const sqlite = getSqlite()

  // BFS: collect the root folder + all descendant folder IDs
  const allFolderIds: number[] = [id]
  let queue: number[] = [id]

  const childrenStmt = sqlite.prepare<[number], { id: number }>('SELECT id FROM folders WHERE parent_folder_id = ?')

  while (queue.length > 0) {
    const nextQueue: number[] = []
    for (const folderId of queue) {
      const children = childrenStmt.all(folderId)
      for (const child of children) {
        allFolderIds.push(child.id)
        nextQueue.push(child.id)
      }
    }
    queue = nextQueue
  }

  log.info(`[cascadeDeleteFolder] folder id=${id}, total folders to delete: ${allFolderIds.length}`)

  // Collect document IDs across all affected folders
  const folderPlaceholders = allFolderIds.map(() => '?').join(',')
  const docRows = sqlite
    .prepare<number[], { id: number }>(`SELECT id FROM documents WHERE folder_id IN (${folderPlaceholders})`)
    .all(...allFolderIds)
  const docIds = docRows.map((d) => d.id)

  log.info(`[cascadeDeleteFolder] documents to delete: ${docIds.length}`)

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
        log.info(`[cascadeDeleteFolder] deleted ${quizIds.length} quiz(zes)`)
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
        log.info(`[cascadeDeleteFolder] deleted ${convIds.length} chat conversation(s)`)
      }

      // document_tags, document_content, documents
      sqlite.prepare(`DELETE FROM document_tags WHERE document_id IN (${docPlaceholders})`).run(...docIds)
      sqlite.prepare(`DELETE FROM document_content WHERE document_id IN (${docPlaceholders})`).run(...docIds)
      sqlite.prepare(`DELETE FROM documents WHERE id IN (${docPlaceholders})`).run(...docIds)
      log.info(`[cascadeDeleteFolder] deleted ${docIds.length} document(s)`)
    }

    // Delete folders children-first (reverse BFS order satisfies self-referencing FK)
    for (let i = allFolderIds.length - 1; i >= 0; i--) {
      sqlite.prepare('DELETE FROM folders WHERE id = ?').run(allFolderIds[i])
    }
    log.info(`[cascadeDeleteFolder] deleted ${allFolderIds.length} folder(s)`)
  })

  runDelete()
}
