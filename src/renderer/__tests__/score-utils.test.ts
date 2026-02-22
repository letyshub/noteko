import { describe, it, expect } from 'vitest'
import { getScoreColor, getScoreLabel } from '@renderer/lib/score-utils'
import type { QuizHistorySortField } from '@renderer/lib/score-utils'

describe('getScoreColor', () => {
  it('should return green classes for scores >= 80', () => {
    expect(getScoreColor(80)).toBe('text-green-600 dark:text-green-400')
    expect(getScoreColor(100)).toBe('text-green-600 dark:text-green-400')
    expect(getScoreColor(95)).toBe('text-green-600 dark:text-green-400')
  })

  it('should return yellow classes for scores >= 60 and < 80', () => {
    expect(getScoreColor(60)).toBe('text-yellow-600 dark:text-yellow-400')
    expect(getScoreColor(79)).toBe('text-yellow-600 dark:text-yellow-400')
    expect(getScoreColor(70)).toBe('text-yellow-600 dark:text-yellow-400')
  })

  it('should return red classes for scores < 60', () => {
    expect(getScoreColor(0)).toBe('text-red-600 dark:text-red-400')
    expect(getScoreColor(59)).toBe('text-red-600 dark:text-red-400')
    expect(getScoreColor(30)).toBe('text-red-600 dark:text-red-400')
  })

  it('should include dark mode variant classes for all thresholds', () => {
    const results = [getScoreColor(100), getScoreColor(70), getScoreColor(30)]
    for (const result of results) {
      expect(result).toMatch(/dark:/)
    }
  })
})

describe('getScoreLabel', () => {
  it('should return "Excellent" for scores >= 80', () => {
    expect(getScoreLabel(80)).toBe('Excellent')
    expect(getScoreLabel(100)).toBe('Excellent')
  })

  it('should return "Good" for scores >= 60 and < 80', () => {
    expect(getScoreLabel(60)).toBe('Good')
    expect(getScoreLabel(79)).toBe('Good')
  })

  it('should return "Needs Improvement" for scores < 60', () => {
    expect(getScoreLabel(0)).toBe('Needs Improvement')
    expect(getScoreLabel(59)).toBe('Needs Improvement')
  })
})

describe('QuizHistorySortField', () => {
  it('should accept all 4 expected sort field values', () => {
    // Type-level test: these assignments must compile without error
    const fields: QuizHistorySortField[] = ['date', 'score', 'quizName', 'documentName']
    expect(fields).toHaveLength(4)
    expect(fields).toContain('date')
    expect(fields).toContain('score')
    expect(fields).toContain('quizName')
    expect(fields).toContain('documentName')
  })
})
