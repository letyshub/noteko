import { eq, inArray, count, like, asc } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { tags, documentTags, documents } from '@main/database/schema'
import type { TagDto, TagCloudItemDto } from '@shared/types'

// ---------------------------------------------------------------------------
// Tag CRUD
// ---------------------------------------------------------------------------

/** List all tags, ordered alphabetically by name. */
export const listTags = (): TagDto[] => {
  return getDb().select().from(tags).orderBy(asc(tags.name)).all()
}

/** Create a new tag with the given name and optional color. */
export const createTag = (data: { name: string; color?: string }): TagDto => {
  return getDb()
    .insert(tags)
    .values({
      name: data.name,
      color: data.color ?? null,
      created_at: new Date().toISOString(),
    })
    .returning()
    .get()
}

/** Update an existing tag's name and/or color. */
export const updateTag = (id: number, data: { name?: string; color?: string }): TagDto | undefined => {
  return getDb().update(tags).set(data).where(eq(tags.id, id)).returning().get()
}

/**
 * Delete a tag and its junction entries within a transaction.
 * Returns the deleted tag and the count of documents that were affected.
 */
export const deleteTag = (id: number): { tag: TagDto; affectedDocumentCount: number } | undefined => {
  const db = getDb()

  let deletedTag: TagDto | undefined
  let affectedDocumentCount = 0

  db.transaction((tx) => {
    // Count how many documents are associated with this tag
    const countResult = tx
      .select({ value: count(documentTags.id) })
      .from(documentTags)
      .where(eq(documentTags.tag_id, id))
      .get()
    affectedDocumentCount = countResult?.value ?? 0

    // Delete junction entries
    tx.delete(documentTags).where(eq(documentTags.tag_id, id)).run()

    // Delete the tag itself
    deletedTag = tx.delete(tags).where(eq(tags.id, id)).returning().get()
  })

  if (!deletedTag) return undefined
  return { tag: deletedTag, affectedDocumentCount }
}

// ---------------------------------------------------------------------------
// Document-Tag Junction
// ---------------------------------------------------------------------------

/** Get all tags for a single document. */
export const getDocumentTags = (documentId: number): TagDto[] => {
  const rows = getDb()
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      created_at: tags.created_at,
    })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tag_id, tags.id))
    .where(eq(documentTags.document_id, documentId))
    .all()
  return rows
}

/**
 * Atomically replace all tags on a document.
 * Deletes all existing associations, then inserts new ones in a transaction.
 */
export const setDocumentTags = (documentId: number, tagIds: number[]): void => {
  const db = getDb()

  db.transaction((tx) => {
    // Delete all existing associations for this document
    tx.delete(documentTags).where(eq(documentTags.document_id, documentId)).run()

    // Insert new associations
    for (const tagId of tagIds) {
      tx.insert(documentTags)
        .values({
          document_id: documentId,
          tag_id: tagId,
          created_at: new Date().toISOString(),
        })
        .run()
    }
  })
}

/**
 * Batch-load tags for multiple documents.
 * Returns a map of document ID -> TagDto[].
 * Documents with no tags get an empty array.
 */
export const batchGetDocumentTags = (documentIds: number[]): Record<number, TagDto[]> => {
  const result: Record<number, TagDto[]> = {}

  // Initialize all requested IDs with empty arrays
  for (const id of documentIds) {
    result[id] = []
  }

  if (documentIds.length === 0) return result

  const rows = getDb()
    .select({
      document_id: documentTags.document_id,
      id: tags.id,
      name: tags.name,
      color: tags.color,
      created_at: tags.created_at,
    })
    .from(documentTags)
    .innerJoin(tags, eq(documentTags.tag_id, tags.id))
    .where(inArray(documentTags.document_id, documentIds))
    .all()

  for (const row of rows) {
    result[row.document_id].push({
      id: row.id,
      name: row.name,
      color: row.color,
      created_at: row.created_at,
    })
  }

  return result
}

// ---------------------------------------------------------------------------
// Tag Aggregation & Filtering
// ---------------------------------------------------------------------------

/** Get all tags with their document counts (for tag cloud display). */
export const getTagCloud = (): TagCloudItemDto[] => {
  return getDb()
    .select({
      id: tags.id,
      name: tags.name,
      color: tags.color,
      document_count: count(documentTags.id),
    })
    .from(tags)
    .leftJoin(documentTags, eq(documentTags.tag_id, tags.id))
    .groupBy(tags.id)
    .all()
}

/** Suggest tags matching a name prefix (for autocomplete). */
export const suggestTags = (query: string): TagDto[] => {
  return getDb()
    .select()
    .from(tags)
    .where(like(tags.name, `${query}%`))
    .orderBy(asc(tags.name))
    .all()
}

/**
 * List documents that have ANY of the provided tag IDs (OR semantics).
 * Returns distinct documents.
 */
export const listDocumentsByTags = (tagIds: number[]) => {
  if (tagIds.length === 0) return []

  const rows = getDb()
    .selectDistinct({
      id: documents.id,
      name: documents.name,
      file_path: documents.file_path,
      file_type: documents.file_type,
      file_size: documents.file_size,
      folder_id: documents.folder_id,
      project_id: documents.project_id,
      processing_status: documents.processing_status,
      created_at: documents.created_at,
      updated_at: documents.updated_at,
    })
    .from(documents)
    .innerJoin(documentTags, eq(documentTags.document_id, documents.id))
    .where(inArray(documentTags.tag_id, tagIds))
    .all()

  return rows
}
