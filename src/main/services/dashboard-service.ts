import { eq, count, avg, desc } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { projects, documents, quizAttempts, quizzes } from '@main/database/schema'
import type { DashboardStatsDto, RecentDocumentDto, RecentQuizAttemptDto, ProjectWithCountDto } from '@shared/types'

/** Aggregate stats for the dashboard overview cards. */
export const getDashboardStats = (): DashboardStatsDto => {
  const db = getDb()

  const projectCount = db
    .select({ value: count(projects.id) })
    .from(projects)
    .get()
  const documentCount = db
    .select({ value: count(documents.id) })
    .from(documents)
    .get()
  const attemptRow = db
    .select({
      total: count(quizAttempts.id),
      avg_score: avg(quizAttempts.score),
    })
    .from(quizAttempts)
    .get()

  return {
    total_projects: projectCount?.value ?? 0,
    total_documents: documentCount?.value ?? 0,
    total_quizzes_taken: attemptRow?.total ?? 0,
    average_score: attemptRow?.avg_score ? Math.round(Number(attemptRow.avg_score)) : 0,
  }
}

/** Last N documents with project name for the dashboard feed. */
export const getRecentDocuments = (limitCount = 5): RecentDocumentDto[] => {
  return getDb()
    .select({
      id: documents.id,
      name: documents.name,
      file_type: documents.file_type,
      project_name: projects.name,
      created_at: documents.created_at,
    })
    .from(documents)
    .innerJoin(projects, eq(documents.project_id, projects.id))
    .orderBy(desc(documents.created_at))
    .limit(limitCount)
    .all()
}

/** Last N quiz attempts with quiz/document context for the dashboard feed. */
export const getRecentQuizAttempts = (limitCount = 5): RecentQuizAttemptDto[] => {
  return getDb()
    .select({
      id: quizAttempts.id,
      quiz_id: quizAttempts.quiz_id,
      quiz_title: quizzes.title,
      document_name: documents.name,
      score: quizAttempts.score,
      completed_at: quizAttempts.completed_at,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quiz_id, quizzes.id))
    .innerJoin(documents, eq(quizzes.document_id, documents.id))
    .orderBy(desc(quizAttempts.completed_at))
    .limit(limitCount)
    .all()
}

/** All projects with document count for the dashboard grid. */
export const getProjectsWithCounts = (): ProjectWithCountDto[] => {
  const db = getDb()

  const rows = db
    .select({
      id: projects.id,
      name: projects.name,
      color: projects.color,
      document_count: count(documents.id),
    })
    .from(projects)
    .leftJoin(documents, eq(documents.project_id, projects.id))
    .groupBy(projects.id)
    .all()

  return rows
}
