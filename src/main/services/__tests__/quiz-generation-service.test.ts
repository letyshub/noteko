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

  // ─── mergeQuizChunkResults ─────────────────────────────────

  describe('mergeQuizChunkResults', () => {
    const makeChunkText = (questions: object[]) => JSON.stringify(questions)

    const mcq = {
      question: 'What is the capital of France?',
      type: 'multiple-choice',
      options: ['London', 'Paris', 'Berlin', 'Madrid'],
      correct_answer: 'Paris',
      explanation: 'Paris is the capital.',
      difficulty: 'easy',
    }

    const tf = {
      question: 'The Earth is flat.',
      type: 'true-false',
      options: ['True', 'False'],
      correct_answer: 'False',
      explanation: null,
      difficulty: 'easy',
    }

    const sa = {
      question: 'Name the process by which plants make food.',
      type: 'short-answer',
      options: null,
      correct_answer: 'Photosynthesis',
      explanation: null,
      difficulty: 'medium',
    }

    it('should combine questions from multiple chunk texts', async () => {
      const { mergeQuizChunkResults } = await import('@main/services/quiz-generation-service')

      const chunk1 = makeChunkText([mcq])
      const chunk2 = makeChunkText([tf])
      const result = mergeQuizChunkResults([chunk1, chunk2], 10)

      const parsed = JSON.parse(result)
      expect(parsed).toHaveLength(2)
      expect(parsed[0].question).toBe(mcq.question)
      expect(parsed[1].question).toBe(tf.question)
    })

    it('should deduplicate questions with identical text (case-insensitive)', async () => {
      const { mergeQuizChunkResults } = await import('@main/services/quiz-generation-service')

      const duplicate = { ...mcq }
      const chunk1 = makeChunkText([mcq])
      const chunk2 = makeChunkText([duplicate]) // same question in second chunk

      const result = mergeQuizChunkResults([chunk1, chunk2], 10)
      const parsed = JSON.parse(result)

      expect(parsed).toHaveLength(1)
    })

    it('should trim to questionCount', async () => {
      const { mergeQuizChunkResults } = await import('@main/services/quiz-generation-service')

      const chunk1 = makeChunkText([mcq, tf, sa])

      const result = mergeQuizChunkResults([chunk1], 2)
      const parsed = JSON.parse(result)

      expect(parsed).toHaveLength(2)
      expect(parsed[0].question).toBe(mcq.question)
      expect(parsed[1].question).toBe(tf.question)
    })

    it('should skip invalid chunk texts gracefully', async () => {
      const { mergeQuizChunkResults } = await import('@main/services/quiz-generation-service')

      const chunk1 = 'this is not JSON'
      const chunk2 = makeChunkText([mcq])

      const result = mergeQuizChunkResults([chunk1, chunk2], 10)
      const parsed = JSON.parse(result)

      expect(parsed).toHaveLength(1)
      expect(parsed[0].question).toBe(mcq.question)
    })

    it('should return empty JSON array when all chunks are invalid', async () => {
      const { mergeQuizChunkResults } = await import('@main/services/quiz-generation-service')

      const result = mergeQuizChunkResults(['bad', 'also bad', '{}'], 10)
      const parsed = JSON.parse(result)

      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(0)
    })

    it('should skip invalid questions within a valid chunk', async () => {
      const { mergeQuizChunkResults } = await import('@main/services/quiz-generation-service')

      const invalidQ = { question: 'Missing type', correct_answer: 'x', difficulty: 'easy' }
      const chunk = makeChunkText([invalidQ, mcq])

      const result = mergeQuizChunkResults([chunk], 10)
      const parsed = JSON.parse(result)

      expect(parsed).toHaveLength(1)
      expect(parsed[0].question).toBe(mcq.question)
    })
  })

  // ─── buildQuizPrompt ───────────────────────────────────────

  describe('buildQuizPrompt', () => {
    it('should calculate dynamic text budget correctly (MAX_TEXT_LENGTH minus prompt overhead)', async () => {
      const { buildQuizPrompt } = await import('@main/services/quiz-generation-service')
      const { RAW_TEXT_MAX_LENGTH, QUIZ_GENERATION_PROMPT, buildQuizExamples } =
        await import('@main/services/ai-prompts')

      const questionTypes = 'multiple-choice'
      const longText = 'A'.repeat(RAW_TEXT_MAX_LENGTH + 1000)

      const prompt = buildQuizPrompt(longText, {
        questionCount: 5,
        questionTypes,
        difficulty: 'medium',
      })

      expect(typeof prompt).toBe('string')

      const templateWithoutText = QUIZ_GENERATION_PROMPT.replace('{questionCount}', '5')
        .replace('{questionTypes}', questionTypes)
        .replace('{difficulty}', 'medium')
        .replace('{examples}', buildQuizExamples(questionTypes))
        .replace('{text}', '')

      const expectedBudget = RAW_TEXT_MAX_LENGTH - templateWithoutText.length
      expect(expectedBudget).toBeGreaterThan(0)

      expect(prompt).not.toContain(longText)

      const truncatedText = longText.slice(0, expectedBudget)
      expect(prompt).toContain(truncatedText)
    })
  })

  // ─── buildQuizExamples ─────────────────────────────────────

  describe('buildQuizExamples', () => {
    it('should include only the multiple-choice example when only that type is requested', async () => {
      const { buildQuizExamples } = await import('@main/services/ai-prompts')

      const result = buildQuizExamples('multiple-choice')

      expect(result).toContain('"multiple-choice"')
      expect(result).not.toContain('"true-false"')
      expect(result).not.toContain('"short-answer"')
    })

    it('should include only the true-false example when only that type is requested', async () => {
      const { buildQuizExamples } = await import('@main/services/ai-prompts')

      const result = buildQuizExamples('true-false')

      expect(result).not.toContain('"multiple-choice"')
      expect(result).toContain('"true-false"')
      expect(result).not.toContain('"short-answer"')
    })

    it('should include all three examples when all types are requested', async () => {
      const { buildQuizExamples } = await import('@main/services/ai-prompts')

      const result = buildQuizExamples('multiple-choice, true-false, short-answer')

      expect(result).toContain('"multiple-choice"')
      expect(result).toContain('"true-false"')
      expect(result).toContain('"short-answer"')
    })

    it('should fall back to multiple-choice example for unrecognised type strings', async () => {
      const { buildQuizExamples } = await import('@main/services/ai-prompts')

      const result = buildQuizExamples('unknown-type')

      expect(result).toContain('"multiple-choice"')
    })

    it('should return valid JSON array syntax', async () => {
      const { buildQuizExamples } = await import('@main/services/ai-prompts')

      const result = buildQuizExamples('multiple-choice, true-false')

      expect(() => JSON.parse(result)).not.toThrow()
      expect(Array.isArray(JSON.parse(result))).toBe(true)
    })
  })

  // ─── calcNumPredict ────────────────────────────────────────

  describe('calcNumPredict', () => {
    it('should return 750 for 1 question (1*250+500)', async () => {
      const { calcNumPredict } = await import('@main/services/quiz-generation-service')
      expect(calcNumPredict(1)).toBe(750)
    })

    it('should return 3000 for 10 questions (10*250+500)', async () => {
      const { calcNumPredict } = await import('@main/services/quiz-generation-service')
      expect(calcNumPredict(10)).toBe(3000)
    })

    it('should scale linearly with question count', async () => {
      const { calcNumPredict } = await import('@main/services/quiz-generation-service')
      expect(calcNumPredict(20)).toBe(calcNumPredict(10) + 10 * 250)
    })
  })
})
