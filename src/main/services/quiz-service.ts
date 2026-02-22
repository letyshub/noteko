import { eq, desc, count, avg, max, countDistinct } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { quizzes, quizQuestions, quizAttempts, documents } from '@main/database/schema'
import type { Quiz, QuizQuestion } from '@main/database/schema'
import type { QuizAttemptWithContextDto, QuizOverviewStatsDto, QuizPerQuizStatsDto, WeakAreaDto } from '@shared/types'

export const listQuizzesByDocument = (documentId: number) => {
  return getDb().select().from(quizzes).where(eq(quizzes.document_id, documentId)).all()
}

export const getQuiz = (id: number) => {
  return getDb().select().from(quizzes).where(eq(quizzes.id, id)).get()
}

export const getQuizWithQuestions = (id: number): { quiz: Quiz; questions: QuizQuestion[] } | undefined => {
  const quiz = getDb().select().from(quizzes).where(eq(quizzes.id, id)).get()
  if (!quiz) return undefined

  const questions = getDb().select().from(quizQuestions).where(eq(quizQuestions.quiz_id, id)).all()

  return { quiz, questions }
}

export const createQuiz = (data: {
  title: string
  document_id: number
  question_count?: number
  difficulty_level?: string
  question_types?: string
  questions: Array<{
    question: string
    options?: string[]
    correct_answer: string
    explanation?: string
    type?: string
    difficulty?: string
  }>
}) => {
  const db = getDb()

  return db.transaction((tx) => {
    const quiz = tx
      .insert(quizzes)
      .values({
        title: data.title,
        document_id: data.document_id,
        created_at: new Date().toISOString(),
        question_count: data.question_count,
        difficulty_level: data.difficulty_level,
        question_types: data.question_types,
      })
      .returning()
      .get()

    if (quiz && data.questions.length > 0) {
      for (const q of data.questions) {
        tx.insert(quizQuestions)
          .values({
            quiz_id: quiz.id,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            type: q.type,
            difficulty: q.difficulty,
          })
          .run()
      }
    }

    return quiz
  })
}

export const deleteQuiz = (id: number) => {
  const db = getDb()
  // Delete associated data first (FK constraints)
  db.delete(quizAttempts).where(eq(quizAttempts.quiz_id, id)).run()
  db.delete(quizQuestions).where(eq(quizQuestions.quiz_id, id)).run()
  return db.delete(quizzes).where(eq(quizzes.id, id)).returning().get()
}

export const recordAttempt = (data: {
  quiz_id: number
  score: number
  total_questions: number
  answers?: Record<string, string>
}) => {
  return getDb()
    .insert(quizAttempts)
    .values({
      ...data,
      completed_at: new Date().toISOString(),
    })
    .returning()
    .get()
}

export const listAttempts = (quizId: number) => {
  return getDb().select().from(quizAttempts).where(eq(quizAttempts.quiz_id, quizId)).all()
}

// ---------------------------------------------------------------------------
// Quiz History Aggregate Functions
// ---------------------------------------------------------------------------

export const listAllAttempts = (): QuizAttemptWithContextDto[] => {
  const rows = getDb()
    .select({
      id: quizAttempts.id,
      quiz_id: quizAttempts.quiz_id,
      score: quizAttempts.score,
      total_questions: quizAttempts.total_questions,
      answers: quizAttempts.answers,
      completed_at: quizAttempts.completed_at,
      quiz_title: quizzes.title,
      document_name: documents.name,
      document_id: quizzes.document_id,
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quiz_id, quizzes.id))
    .innerJoin(documents, eq(quizzes.document_id, documents.id))
    .orderBy(desc(quizAttempts.completed_at), desc(quizAttempts.id))
    .all()

  return rows
}

export const getOverviewStats = (): QuizOverviewStatsDto => {
  const row = getDb()
    .select({
      total_attempts: count(quizAttempts.id),
      average_score: avg(quizAttempts.score),
      best_score: max(quizAttempts.score),
      quizzes_taken: countDistinct(quizAttempts.quiz_id),
    })
    .from(quizAttempts)
    .get()

  return {
    total_attempts: row?.total_attempts ?? 0,
    average_score: row?.average_score ? Number(row.average_score) : 0,
    best_score: row?.best_score ?? 0,
    quizzes_taken: row?.quizzes_taken ?? 0,
  }
}

export const getPerQuizStats = (): QuizPerQuizStatsDto[] => {
  const rows = getDb()
    .select({
      quiz_id: quizAttempts.quiz_id,
      quiz_title: quizzes.title,
      document_name: documents.name,
      average_score: avg(quizAttempts.score),
      attempt_count: count(quizAttempts.id),
      best_score: max(quizAttempts.score),
    })
    .from(quizAttempts)
    .innerJoin(quizzes, eq(quizAttempts.quiz_id, quizzes.id))
    .innerJoin(documents, eq(quizzes.document_id, documents.id))
    .groupBy(quizAttempts.quiz_id)
    .all()

  return rows.map((r) => ({
    quiz_id: r.quiz_id,
    quiz_title: r.quiz_title,
    document_name: r.document_name,
    average_score: r.average_score ? Number(r.average_score) : 0,
    attempt_count: r.attempt_count,
    best_score: r.best_score ?? 0,
  }))
}

export const getWeakAreas = (): WeakAreaDto[] => {
  const db = getDb()

  // 1. Fetch all attempts with non-null answers
  const attempts = db
    .select({
      id: quizAttempts.id,
      quiz_id: quizAttempts.quiz_id,
      answers: quizAttempts.answers,
    })
    .from(quizAttempts)
    .all()
    .filter((a) => a.answers != null)

  if (attempts.length === 0) return []

  // 2. Fetch all quiz questions
  const questions = db.select().from(quizQuestions).all()

  // Build a lookup map: questionId -> question record
  const questionMap = new Map(questions.map((q) => [q.id, q]))

  // 3. Tally errors by type and difficulty
  const typeTally: Record<string, { errors: number; total: number }> = {}
  const difficultyTally: Record<string, { errors: number; total: number }> = {}

  for (const attempt of attempts) {
    const answers = attempt.answers as Record<string, string>
    for (const [questionIdStr, givenAnswer] of Object.entries(answers)) {
      const questionId = Number(questionIdStr)
      const question = questionMap.get(questionId)
      if (!question) continue

      const isWrong = givenAnswer !== question.correct_answer

      // Tally by type
      const type = question.type ?? 'unknown'
      if (!typeTally[type]) typeTally[type] = { errors: 0, total: 0 }
      typeTally[type].total++
      if (isWrong) typeTally[type].errors++

      // Tally by difficulty
      const difficulty = question.difficulty ?? 'unknown'
      if (!difficultyTally[difficulty]) difficultyTally[difficulty] = { errors: 0, total: 0 }
      difficultyTally[difficulty].total++
      if (isWrong) difficultyTally[difficulty].errors++
    }
  }

  // 4. Convert tallies to WeakAreaDto[]
  const results: WeakAreaDto[] = []

  for (const [label, { errors, total }] of Object.entries(typeTally)) {
    results.push({
      label,
      category: 'type',
      error_count: errors,
      total_count: total,
      error_rate: total > 0 ? errors / total : 0,
    })
  }

  for (const [label, { errors, total }] of Object.entries(difficultyTally)) {
    results.push({
      label,
      category: 'difficulty',
      error_count: errors,
      total_count: total,
      error_rate: total > 0 ? errors / total : 0,
    })
  }

  // Sort by error_rate descending so the weakest areas appear first
  results.sort((a, b) => b.error_rate - a.error_rate)

  return results
}
