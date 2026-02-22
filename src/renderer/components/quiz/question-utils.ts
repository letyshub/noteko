/**
 * Shared quiz question utilities.
 * Extracted from quiz-page.tsx for reuse across quiz display and quiz-taking pages.
 */

/** Maps a question type to its display label. */
export function typeBadgeLabel(type?: string): string {
  switch (type) {
    case 'multiple-choice':
      return 'MCQ'
    case 'true-false':
      return 'T/F'
    case 'short-answer':
      return 'Short Answer'
    default:
      return 'Question'
  }
}

/** MCQ option letter labels (A-H). */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
