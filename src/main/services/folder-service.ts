import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { folders, documents, documentContent, quizzes, quizQuestions, quizAttempts } from '@main/database/schema'

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

export const cascadeDeleteFolder = (id: number) => {
  const db = getDb()

  db.transaction((tx) => {
    // BFS to collect all descendant folder IDs (including the target folder)
    const allFolderIds: number[] = [id]
    let queue: number[] = [id]

    while (queue.length > 0) {
      const childRows = tx
        .select({ id: folders.id })
        .from(folders)
        .where(inArray(folders.parent_folder_id, queue))
        .all()
      const childIds = childRows.map((f) => f.id)
      if (childIds.length === 0) break
      allFolderIds.push(...childIds)
      queue = childIds
    }

    // Collect document IDs in all those folders
    const docRows = tx
      .select({ id: documents.id })
      .from(documents)
      .where(inArray(documents.folder_id, allFolderIds))
      .all()
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
      tx.delete(documents).where(inArray(documents.folder_id, allFolderIds)).run()
    }

    // Delete folders in reverse order (children first) to satisfy FK constraints
    // Since we're deleting all at once with inArray, we need to handle parent refs.
    // With foreign_keys ON, delete children before parents by reversing the collected order.
    const reversedFolderIds = [...allFolderIds].reverse()
    for (const folderId of reversedFolderIds) {
      tx.delete(folders).where(eq(folders.id, folderId)).run()
    }
  })
}
