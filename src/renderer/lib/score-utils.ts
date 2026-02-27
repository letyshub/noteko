/**
 * Score display utilities for quiz results.
 * Pure functions for mapping quiz scores to visual feedback.
 */

/** Sort fields available for quiz history list views. */
export type QuizHistorySortField = 'date' | 'score' | 'quizName' | 'documentName'

/**
 * Return Tailwind colour classes (with dark-mode variants) for a quiz score.
 *
 * - >= 80 %  -> green (excellent)
 * - >= 60 %  -> yellow (good)
 * - < 60 %   -> red (needs improvement)
 */
export function getScoreColor(percentage: number): string {
  if (percentage >= 80) return 'text-green-600 dark:text-green-400'
  if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400'
  return 'text-red-600 dark:text-red-400'
}

/**
 * Return a human-readable label for a quiz score.
 *
 * Uses the same threshold boundaries as `getScoreColor`.
 */
export function getScoreLabel(percentage: number): string {
  if (percentage >= 80) return 'Excellent'
  if (percentage >= 60) return 'Good'
  return 'Needs Improvement'
}
