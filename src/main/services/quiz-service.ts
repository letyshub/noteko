import { eq } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { quizzes, quizQuestions, quizAttempts } from '@main/database/schema'
import type { Quiz, QuizQuestion } from '@main/database/schema'

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
