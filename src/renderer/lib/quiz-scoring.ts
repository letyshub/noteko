/**
 * Client-side quiz scoring utility.
 * Pure functions for calculating quiz results.
 */

import type { QuizQuestionDto } from '@shared/types'

export interface QuizScoreBreakdown {
  type: string
  correct: number
  total: number
  percentage: number
}

export interface QuizScoreResult {
  totalCorrect: number
  totalQuestions: number
  percentage: number
  breakdown: QuizScoreBreakdown[]
}

/**
 * Calculate quiz score by comparing user answers to correct answers.
 *
 * - MCQ and T/F: exact string match
 * - Short-answer: case-insensitive, trimmed comparison
 * - Unanswered questions count as incorrect
 */
export function scoreQuiz(questions: QuizQuestionDto[], answers: Record<string, string>): QuizScoreResult {
  let totalCorrect = 0
  const typeStats = new Map<string, { correct: number; total: number }>()

  for (const q of questions) {
    const type = q.type ?? 'unknown'
    const stats = typeStats.get(type) ?? { correct: 0, total: 0 }
    stats.total++

    const userAnswer = answers[String(q.id)]
    let isCorrect = false

    if (userAnswer != null && userAnswer !== '') {
      if (type === 'short-answer') {
        isCorrect = userAnswer.trim().toLowerCase() === q.correct_answer.trim().toLowerCase()
      } else {
        isCorrect = userAnswer === q.correct_answer
      }
    }

    if (isCorrect) {
      totalCorrect++
      stats.correct++
    }

    typeStats.set(type, stats)
  }

  const totalQuestions = questions.length
  const percentage = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 10000) / 100 : 0

  const breakdown: QuizScoreBreakdown[] = []
  for (const [type, stats] of typeStats) {
    breakdown.push({
      type,
      correct: stats.correct,
      total: stats.total,
      percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 10000) / 100 : 0,
    })
  }

  return { totalCorrect, totalQuestions, percentage, breakdown }
}

/** Format elapsed seconds as "Xm Ys". */
export function formatElapsedTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}m ${s}s`
}
