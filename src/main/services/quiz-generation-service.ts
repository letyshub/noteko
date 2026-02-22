/**
 * Quiz generation service — parsing, validation, and prompt construction.
 *
 * Encapsulates the core intelligence layer for quiz generation:
 *   - parseQuizQuestions(rawText)       — extract JSON array from LLM output
 *   - validateQuizQuestion(q)           — shape validation per question type
 *   - buildQuizPrompt(text, options)    — construct prompt with dynamic text budget
 */

import log from 'electron-log'
import { RAW_TEXT_MAX_LENGTH, QUIZ_GENERATION_PROMPT } from './ai-prompts'
import type { QuizGenerationOptions } from '@shared/types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A quiz question that has passed structural validation. */
export interface ValidatedQuizQuestion {
  question: string
  type: 'multiple-choice' | 'true-false' | 'short-answer'
  options: string[] | null
  correct_answer: string
  explanation: string | null
  difficulty: 'easy' | 'medium' | 'hard'
}

/** Valid question type values. */
const VALID_QUESTION_TYPES = ['multiple-choice', 'true-false', 'short-answer'] as const

/** Valid difficulty values. */
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'] as const

// ---------------------------------------------------------------------------
// parseQuizQuestions
// ---------------------------------------------------------------------------

/**
 * Extract a JSON array of quiz questions from raw LLM output.
 *
 * Handles common LLM output quirks:
 *   - Markdown code fences (```json ... ```)
 *   - Preamble text before the JSON array
 *   - Trailing text after the JSON array
 *
 * @param rawText - The raw LLM response text
 * @returns Parsed array of question objects, or null if parsing fails
 */
export function parseQuizQuestions(rawText: string): Record<string, unknown>[] | null {
  if (!rawText || rawText.trim().length === 0) {
    log.warn('[quiz-generation] Empty text received for parsing')
    return null
  }

  let text = rawText.trim()

  // Strip markdown code fences if present
  const codeFenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/
  const fenceMatch = text.match(codeFenceRegex)
  if (fenceMatch) {
    text = fenceMatch[1].trim()
  }

  // Find the first '[' and last ']' to extract the JSON array
  const firstBracket = text.indexOf('[')
  const lastBracket = text.lastIndexOf(']')

  if (firstBracket === -1 || lastBracket === -1 || lastBracket <= firstBracket) {
    log.warn('[quiz-generation] No JSON array brackets found in LLM output')
    return null
  }

  const jsonString = text.slice(firstBracket, lastBracket + 1)

  try {
    const parsed = JSON.parse(jsonString)

    if (!Array.isArray(parsed)) {
      log.warn('[quiz-generation] Parsed JSON is not an array')
      return null
    }

    log.info(`[quiz-generation] Successfully parsed ${parsed.length} questions from LLM output`)
    return parsed
  } catch (error) {
    log.warn('[quiz-generation] Failed to parse JSON from LLM output:', error instanceof Error ? error.message : error)
    return null
  }
}

// ---------------------------------------------------------------------------
// validateQuizQuestion
// ---------------------------------------------------------------------------

/**
 * Validate and normalize a single quiz question object.
 *
 * Checks:
 *   - Required fields: question (string), type (valid enum), correct_answer (string), difficulty (valid enum)
 *   - multiple-choice: options must be exactly 4 strings, correct_answer must exist in options
 *   - true-false: options must be ['True', 'False'], correct_answer must be 'True' or 'False'
 *   - short-answer: options should be null/undefined, correct_answer is free text
 *   - Optional: explanation (string or null)
 *
 * @param q - Unknown value to validate as a quiz question
 * @returns Validated question or null if invalid
 */
export function validateQuizQuestion(q: unknown): ValidatedQuizQuestion | null {
  if (!q || typeof q !== 'object') {
    log.warn('[quiz-generation] Question is not an object')
    return null
  }

  const obj = q as Record<string, unknown>

  // Check required string fields
  if (typeof obj.question !== 'string' || obj.question.trim().length === 0) {
    log.warn('[quiz-generation] Question text is missing or not a string')
    return null
  }

  if (
    typeof obj.type !== 'string' ||
    !VALID_QUESTION_TYPES.includes(obj.type as (typeof VALID_QUESTION_TYPES)[number])
  ) {
    log.warn(`[quiz-generation] Invalid question type: ${String(obj.type)}`)
    return null
  }

  if (typeof obj.correct_answer !== 'string' || obj.correct_answer.trim().length === 0) {
    log.warn('[quiz-generation] correct_answer is missing or not a string')
    return null
  }

  if (
    typeof obj.difficulty !== 'string' ||
    !VALID_DIFFICULTIES.includes(obj.difficulty as (typeof VALID_DIFFICULTIES)[number])
  ) {
    log.warn(`[quiz-generation] Invalid difficulty: ${String(obj.difficulty)}`)
    return null
  }

  const type = obj.type as ValidatedQuizQuestion['type']
  const correctAnswer = obj.correct_answer as string
  const difficulty = obj.difficulty as ValidatedQuizQuestion['difficulty']

  // Type-specific validation
  switch (type) {
    case 'multiple-choice': {
      if (!Array.isArray(obj.options) || obj.options.length !== 4) {
        log.warn('[quiz-generation] MCQ must have exactly 4 options')
        return null
      }

      if (!obj.options.every((opt: unknown) => typeof opt === 'string')) {
        log.warn('[quiz-generation] MCQ options must all be strings')
        return null
      }

      if (!obj.options.includes(correctAnswer)) {
        log.warn('[quiz-generation] MCQ correct_answer must be one of the options')
        return null
      }

      return {
        question: obj.question as string,
        type,
        options: obj.options as string[],
        correct_answer: correctAnswer,
        explanation: typeof obj.explanation === 'string' ? obj.explanation : null,
        difficulty,
      }
    }

    case 'true-false': {
      // Normalize to ['True', 'False'] if options are provided
      const normalizedAnswer = correctAnswer.charAt(0).toUpperCase() + correctAnswer.slice(1).toLowerCase()

      if (normalizedAnswer !== 'True' && normalizedAnswer !== 'False') {
        log.warn('[quiz-generation] True/false correct_answer must be "True" or "False"')
        return null
      }

      return {
        question: obj.question as string,
        type,
        options: ['True', 'False'],
        correct_answer: normalizedAnswer,
        explanation: typeof obj.explanation === 'string' ? obj.explanation : null,
        difficulty,
      }
    }

    case 'short-answer': {
      return {
        question: obj.question as string,
        type,
        options: null,
        correct_answer: correctAnswer,
        explanation: typeof obj.explanation === 'string' ? obj.explanation : null,
        difficulty,
      }
    }

    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// buildQuizPrompt
// ---------------------------------------------------------------------------

/**
 * Construct a fully populated quiz generation prompt with dynamic text budget.
 *
 * Calculates the available text budget by subtracting the prompt template
 * overhead (with all placeholders replaced except {text}) from RAW_TEXT_MAX_LENGTH.
 * Truncates the document text to fit within the budget.
 *
 * @param documentText - The raw document text
 * @param options - Quiz generation configuration
 * @returns Fully constructed prompt string
 */
export function buildQuizPrompt(documentText: string, options: QuizGenerationOptions): string {
  // Calculate the template overhead (everything except {text})
  const templateWithoutText = QUIZ_GENERATION_PROMPT.replace('{questionCount}', String(options.questionCount))
    .replace('{questionTypes}', options.questionTypes)
    .replace('{difficulty}', options.difficulty)
    .replace('{text}', '')

  // Dynamic text budget: total max length minus the template overhead
  const textBudget = RAW_TEXT_MAX_LENGTH - templateWithoutText.length

  if (textBudget <= 0) {
    log.warn('[quiz-generation] Text budget is non-positive; prompt template is too long')
  }

  // Truncate document text to fit the budget
  const truncatedText = documentText.slice(0, Math.max(0, textBudget))

  if (truncatedText.length < documentText.length) {
    log.info(
      `[quiz-generation] Truncated document text from ${documentText.length} to ${truncatedText.length} chars (budget: ${textBudget})`,
    )
  }

  // Build the final prompt
  const prompt = QUIZ_GENERATION_PROMPT.replace('{questionCount}', String(options.questionCount))
    .replace('{questionTypes}', options.questionTypes)
    .replace('{difficulty}', options.difficulty)
    .replace('{text}', truncatedText)

  log.info(
    `[quiz-generation] Built quiz prompt (${prompt.length} chars, ${truncatedText.length} chars of document text)`,
  )

  return prompt
}
