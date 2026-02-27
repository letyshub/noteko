import { describe, it, expect } from 'vitest'
import { scoreQuiz, formatElapsedTime } from '@renderer/lib/quiz-scoring'
import type { QuizQuestionDto } from '@shared/types'

const makeQuestion = (
  overrides: Partial<QuizQuestionDto> & { id: number; question: string; correct_answer: string },
): QuizQuestionDto => ({
  quiz_id: 1,
  options: null,
  explanation: null,
  type: 'short-answer',
  difficulty: 'easy',
  ...overrides,
})

describe('scoreQuiz', () => {
  const questions: QuizQuestionDto[] = [
    makeQuestion({
      id: 1,
      question: 'Capital of France?',
      type: 'multiple-choice',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correct_answer: 'Paris',
    }),
    makeQuestion({
      id: 2,
      question: 'The sky is blue.',
      type: 'true-false',
      options: ['True', 'False'],
      correct_answer: 'True',
    }),
    makeQuestion({
      id: 3,
      question: 'Chemical symbol for water?',
      type: 'short-answer',
      correct_answer: 'H2O',
    }),
  ]

  it('should return 100% for all correct answers', () => {
    const answers = { '1': 'Paris', '2': 'True', '3': 'H2O' }
    const result = scoreQuiz(questions, answers)
    expect(result.totalCorrect).toBe(3)
    expect(result.totalQuestions).toBe(3)
    expect(result.percentage).toBe(100)
  })

  it('should return 0% for all incorrect answers', () => {
    const answers = { '1': 'London', '2': 'False', '3': 'CO2' }
    const result = scoreQuiz(questions, answers)
    expect(result.totalCorrect).toBe(0)
    expect(result.percentage).toBe(0)
  })

  it('should return correct percentage for mixed results', () => {
    const answers = { '1': 'Paris', '2': 'False', '3': 'H2O' }
    const result = scoreQuiz(questions, answers)
    expect(result.totalCorrect).toBe(2)
    expect(result.percentage).toBeCloseTo(66.67, 1)
  })

  it('should use exact match for MCQ', () => {
    const answers = { '1': 'paris', '2': 'True', '3': 'H2O' } // lowercase 'paris' should not match
    const result = scoreQuiz(questions, answers)
    expect(result.totalCorrect).toBe(2) // MCQ wrong, T/F and short-answer correct
  })

  it('should use case-insensitive trimmed match for short-answer', () => {
    const answers = { '1': 'Paris', '2': 'True', '3': ' h2o ' }
    const result = scoreQuiz(questions, answers)
    expect(result.totalCorrect).toBe(3) // short-answer should match case-insensitively
  })

  it('should count unanswered questions as incorrect', () => {
    const answers = { '1': 'Paris' } // only Q1 answered
    const result = scoreQuiz(questions, answers)
    expect(result.totalCorrect).toBe(1)
    expect(result.totalQuestions).toBe(3)
    expect(result.percentage).toBeCloseTo(33.33, 1)
  })

  it('should count empty string answers as incorrect', () => {
    const answers = { '1': '', '2': '', '3': '' }
    const result = scoreQuiz(questions, answers)
    expect(result.totalCorrect).toBe(0)
  })

  it('should return per-type breakdown with correct fractions', () => {
    const answers = { '1': 'Paris', '2': 'False', '3': 'H2O' }
    const result = scoreQuiz(questions, answers)
    expect(result.breakdown).toHaveLength(3)

    const mcq = result.breakdown.find((b) => b.type === 'multiple-choice')
    expect(mcq).toEqual({ type: 'multiple-choice', correct: 1, total: 1, percentage: 100 })

    const tf = result.breakdown.find((b) => b.type === 'true-false')
    expect(tf).toEqual({ type: 'true-false', correct: 0, total: 1, percentage: 0 })

    const sa = result.breakdown.find((b) => b.type === 'short-answer')
    expect(sa).toEqual({ type: 'short-answer', correct: 1, total: 1, percentage: 100 })
  })
})

describe('formatElapsedTime', () => {
  it('should format seconds as "Xm Ys"', () => {
    expect(formatElapsedTime(298)).toBe('4m 58s')
  })

  it('should format under 60 seconds as "0m Xs"', () => {
    expect(formatElapsedTime(45)).toBe('0m 45s')
  })

  it('should format 0 seconds', () => {
    expect(formatElapsedTime(0)).toBe('0m 0s')
  })

  it('should format exact minutes', () => {
    expect(formatElapsedTime(120)).toBe('2m 0s')
  })
})
