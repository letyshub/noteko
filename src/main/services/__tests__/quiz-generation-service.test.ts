import { describe, expect, it, beforeEach, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks - must be declared before importing the module under test
// ---------------------------------------------------------------------------

vi.mock('electron-log', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}))

// ---------------------------------------------------------------------------
// Tests — quiz-generation-service
// ---------------------------------------------------------------------------

describe('quiz-generation-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // ─── parseQuizQuestions ─────────────────────────────────────

  describe('parseQuizQuestions', () => {
    it('should parse valid JSON array containing all 3 question types', async () => {
      const { parseQuizQuestions } = await import('@main/services/quiz-generation-service')

      const validJson = JSON.stringify([
        {
          question: 'What is the capital of France?',
          type: 'multiple-choice',
          options: ['London', 'Paris', 'Berlin', 'Madrid'],
          correct_answer: 'Paris',
          explanation: 'Paris is the capital of France.',
          difficulty: 'easy',
        },
        {
          question: 'The Earth is flat.',
          type: 'true-false',
          options: ['True', 'False'],
          correct_answer: 'False',
          explanation: 'The Earth is an oblate spheroid.',
          difficulty: 'easy',
        },
        {
          question: 'Name the process by which plants make food.',
          type: 'short-answer',
          options: null,
          correct_answer: 'Photosynthesis',
          explanation: 'Plants use sunlight to convert CO2 and water into glucose.',
          difficulty: 'medium',
        },
      ])

      const result = parseQuizQuestions(validJson)

      expect(result).not.toBeNull()
      expect(result).toHaveLength(3)
      expect(result![0].type).toBe('multiple-choice')
      expect(result![1].type).toBe('true-false')
      expect(result![2].type).toBe('short-answer')
    })

    it('should parse JSON wrapped in markdown code fences', async () => {
      const { parseQuizQuestions } = await import('@main/services/quiz-generation-service')

      const wrappedJson =
        '```json\n' +
        JSON.stringify([
          {
            question: 'What is 2+2?',
            type: 'short-answer',
            options: null,
            correct_answer: '4',
            explanation: 'Basic arithmetic.',
            difficulty: 'easy',
          },
        ]) +
        '\n```'

      const result = parseQuizQuestions(wrappedJson)

      expect(result).not.toBeNull()
      expect(result).toHaveLength(1)
      expect(result![0].question).toBe('What is 2+2?')
    })

    it('should return null for malformed/incomplete JSON', async () => {
      const { parseQuizQuestions } = await import('@main/services/quiz-generation-service')

      // Incomplete JSON — missing closing bracket
      expect(parseQuizQuestions('[{"question": "test"')).toBeNull()

      // Completely invalid text
      expect(parseQuizQuestions('This is not JSON at all')).toBeNull()

      // Empty string
      expect(parseQuizQuestions('')).toBeNull()
    })
  })

  // ─── validateQuizQuestion ──────────────────────────────────

  describe('validateQuizQuestion', () => {
    it('should reject MCQ with fewer than 4 options', async () => {
      const { validateQuizQuestion } = await import('@main/services/quiz-generation-service')

      const result = validateQuizQuestion({
        question: 'What is the capital of France?',
        type: 'multiple-choice',
        options: ['Paris', 'London'], // only 2 options
        correct_answer: 'Paris',
        difficulty: 'easy',
      })

      expect(result).toBeNull()
    })

    it('should reject MCQ where correct_answer is not in options', async () => {
      const { validateQuizQuestion } = await import('@main/services/quiz-generation-service')

      const result = validateQuizQuestion({
        question: 'What is the capital of France?',
        type: 'multiple-choice',
        options: ['London', 'Berlin', 'Madrid', 'Rome'],
        correct_answer: 'Paris', // not in the options array
        difficulty: 'easy',
      })

      expect(result).toBeNull()
    })

    it('should accept a valid true-false question and normalize the answer', async () => {
      const { validateQuizQuestion } = await import('@main/services/quiz-generation-service')

      const result = validateQuizQuestion({
        question: 'The Earth orbits the Sun.',
        type: 'true-false',
        options: ['True', 'False'],
        correct_answer: 'true', // lowercase — should be normalized to "True"
        explanation: 'The Earth revolves around the Sun.',
        difficulty: 'easy',
      })

      expect(result).not.toBeNull()
      expect(result!.type).toBe('true-false')
      expect(result!.correct_answer).toBe('True')
      expect(result!.options).toEqual(['True', 'False'])
      expect(result!.explanation).toBe('The Earth revolves around the Sun.')
    })

    it('should accept a valid short-answer question with null options', async () => {
      const { validateQuizQuestion } = await import('@main/services/quiz-generation-service')

      const result = validateQuizQuestion({
        question: 'What is the chemical symbol for water?',
        type: 'short-answer',
        options: null,
        correct_answer: 'H2O',
        explanation: 'Water is composed of hydrogen and oxygen.',
        difficulty: 'medium',
      })

      expect(result).not.toBeNull()
      expect(result!.type).toBe('short-answer')
      expect(result!.options).toBeNull()
      expect(result!.correct_answer).toBe('H2O')
      expect(result!.difficulty).toBe('medium')
    })

    it('should reject true-false question when correct_answer is not True or False', async () => {
      const { validateQuizQuestion } = await import('@main/services/quiz-generation-service')

      const result = validateQuizQuestion({
        question: 'The sky is green.',
        type: 'true-false',
        options: ['True', 'False'],
        correct_answer: 'Maybe', // invalid for T/F
        difficulty: 'easy',
      })

      expect(result).toBeNull()
    })
  })

  // ─── buildQuizPrompt ───────────────────────────────────────

  describe('buildQuizPrompt', () => {
    it('should calculate dynamic text budget correctly (MAX_TEXT_LENGTH minus prompt overhead)', async () => {
      const { buildQuizPrompt } = await import('@main/services/quiz-generation-service')
      const { RAW_TEXT_MAX_LENGTH, QUIZ_GENERATION_PROMPT } = await import('@main/services/ai-prompts')

      // Create a document text longer than what the budget allows
      const longText = 'A'.repeat(RAW_TEXT_MAX_LENGTH + 1000)

      const prompt = buildQuizPrompt(longText, {
        questionCount: 5,
        questionTypes: 'all',
        difficulty: 'medium',
      })

      // The prompt should exist and be a string
      expect(typeof prompt).toBe('string')

      // The total prompt length should not exceed RAW_TEXT_MAX_LENGTH
      // plus the template overhead (since the template is part of the budget)
      // More precisely: the document text portion should be truncated
      // so that the full prompt stays within a reasonable bound.
      //
      // Calculate expected budget: RAW_TEXT_MAX_LENGTH minus the prompt
      // template length (with placeholders replaced by actual config values)
      const templateWithoutText = QUIZ_GENERATION_PROMPT.replace('{questionCount}', '5')
        .replace('{questionTypes}', 'all')
        .replace('{difficulty}', 'medium')
        .replace('{text}', '')

      const expectedBudget = RAW_TEXT_MAX_LENGTH - templateWithoutText.length
      expect(expectedBudget).toBeGreaterThan(0)

      // The document text in the prompt should be truncated to the budget
      // We can verify that the long text was truncated by checking
      // the prompt does NOT contain the full longText
      expect(prompt).not.toContain(longText)

      // But it should contain the truncated portion
      const truncatedText = longText.slice(0, expectedBudget)
      expect(prompt).toContain(truncatedText)
    })
  })
})
