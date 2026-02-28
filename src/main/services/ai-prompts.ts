/**
 * Prompt templates and AI-related constants for document operations.
 *
 * Each prompt contains a `{text}` placeholder that is replaced with
 * the document's raw text before being sent to the LLM.
 */

import type { SummaryStyle } from '@shared/types'

export const DEFAULT_OLLAMA_MODEL = 'llama3.2'

/** Max characters of raw text to send to the LLM. */
export const RAW_TEXT_MAX_LENGTH = 8_000

// ---------------------------------------------------------------------------
// Summary prompts (style variants)
// ---------------------------------------------------------------------------

export const SUMMARIZE_BRIEF_PROMPT = 'Summarize the following document in 2-3 concise paragraphs:\n\n{text}'

export const SUMMARIZE_DETAILED_PROMPT =
  'Provide a detailed summary of the following document in 5-7 paragraphs, covering all major topics and key arguments:\n\n{text}'

export const SUMMARIZE_ACADEMIC_PROMPT =
  'Write an academic abstract for the following document. Use formal language, state the purpose, methodology (if applicable), key findings, and conclusions:\n\n{text}'

// ---------------------------------------------------------------------------
// Extraction prompts
// ---------------------------------------------------------------------------

export const KEY_POINTS_PROMPT =
  'Extract 5-10 key points from the following document. Return each point on a new line starting with a dash (-):\n\n{text}'

export const KEY_TERMS_PROMPT =
  'Extract 5-15 key terms and their definitions from the following document. Return ONLY a JSON array where each element has a "term" and "definition" field. Example format: [{"term": "Example", "definition": "A brief definition"}]\n\n{text}'

// ---------------------------------------------------------------------------
// Combine prompts (for merging chunked results)
// ---------------------------------------------------------------------------

export const COMBINE_SUMMARIES_PROMPT =
  'The following are summaries of consecutive sections of a document. Combine them into a single cohesive summary, removing redundancy and maintaining logical flow:\n\n{text}'

export const COMBINE_KEY_POINTS_PROMPT =
  'The following are key points extracted from consecutive sections of a document. Merge them into a deduplicated, ranked list of 5-10 key points. Remove duplicates and near-duplicates, keeping the most important and specific points. Return each point on a new line starting with a dash (-):\n\n{text}'

export const COMBINE_KEY_TERMS_PROMPT =
  'The following are key terms extracted from consecutive sections of a document. Merge them into a deduplicated list of 5-15 key terms with definitions. Remove duplicate terms, merge definitions where appropriate. Return ONLY a JSON array where each element has a "term" and "definition" field:\n\n{text}'

// ---------------------------------------------------------------------------
// Chat prompts
// ---------------------------------------------------------------------------

export const CHAT_SYSTEM_PROMPT =
  'You are a helpful assistant that answers questions about the following document. Base your answers on the document content provided. If the answer is not found in the document, say so.\n\nDocument content:\n{text}'

// ---------------------------------------------------------------------------
// Quiz generation prompts
// ---------------------------------------------------------------------------

const QUIZ_EXAMPLE_MULTIPLE_CHOICE = `  {
    "question": "At what temperature does water boil at standard atmospheric pressure?",
    "type": "multiple-choice",
    "options": ["50°C", "100°C", "150°C", "200°C"],
    "correct_answer": "100°C",
    "explanation": "Water boils at 100°C (212°F) at standard atmospheric pressure (1 atm).",
    "difficulty": "easy"
  }`

const QUIZ_EXAMPLE_TRUE_FALSE = `  {
    "question": "Mitochondria produce ATP through a process called cellular respiration.",
    "type": "true-false",
    "options": ["True", "False"],
    "correct_answer": "True",
    "explanation": "Mitochondria are the site of cellular respiration, converting glucose and oxygen into ATP, CO2, and water.",
    "difficulty": "medium"
  }`

const QUIZ_EXAMPLE_SHORT_ANSWER = `  {
    "question": "What is the primary function of the sodium-potassium pump in nerve cells?",
    "type": "short-answer",
    "options": null,
    "correct_answer": "Maintaining the electrochemical gradient by pumping 3 Na+ ions out and 2 K+ ions in per ATP consumed",
    "explanation": "The Na+/K+ ATPase pump actively transports sodium out of and potassium into the cell, maintaining the resting membrane potential required for nerve signal transmission.",
    "difficulty": "hard"
  }`

/**
 * Build the example block for the quiz prompt, including only the question
 * types that will actually be generated. Reduces input token count when the
 * user selects fewer than all three types.
 */
export function buildQuizExamples(questionTypes: string): string {
  const types = questionTypes.split(',').map((t) => t.trim())
  const examples: string[] = []
  if (types.includes('multiple-choice')) examples.push(QUIZ_EXAMPLE_MULTIPLE_CHOICE)
  if (types.includes('true-false')) examples.push(QUIZ_EXAMPLE_TRUE_FALSE)
  if (types.includes('short-answer')) examples.push(QUIZ_EXAMPLE_SHORT_ANSWER)
  if (examples.length === 0) examples.push(QUIZ_EXAMPLE_MULTIPLE_CHOICE)
  return `[\n${examples.join(',\n')}\n]`
}

export const QUIZ_GENERATION_PROMPT = `Generate exactly {questionCount} quiz questions from the following document text.

Question types to generate: {questionTypes}
Difficulty level: {difficulty}

Rules:
- Output ONLY a JSON array of question objects, no other text.
- Each object must have these exact fields:
  "question" (string), "type" (one of "multiple-choice", "true-false", "short-answer"),
  "options" (array of exactly 4 strings for multiple-choice, ["True", "False"] for true-false, null for short-answer),
  "correct_answer" (string, must be one of the options for multiple-choice/true-false),
  "explanation" (string), "difficulty" (one of "easy", "medium", "hard")
- Questions MUST test specific facts, concepts, definitions, numbers, dates, processes, or relationships found in the document text.
- NEVER ask generic structural questions like "What is the main topic?", "What does the author describe?", "What is discussed in this section?", or "What is the document about?".
- Each question must be answerable ONLY by someone who has read and understood the specific content — not by guessing the document structure.

Example output:
{examples}

Document text:
{text}`

export const COMBINE_QUIZ_QUESTIONS_PROMPT = `The following are quiz questions generated from consecutive sections of a document. Merge them into a single deduplicated list of exactly {questionCount} questions.

Rules:
- Remove duplicate or near-duplicate questions.
- Keep the best-worded version when duplicates exist.
- Maintain a mix of question types if present.
- Output ONLY a JSON array of question objects with the same format as the input.
- Each object must have: "question", "type", "options", "correct_answer", "explanation", "difficulty".

Questions to merge:
{text}`

export const QUIZ_RETRY_PROMPT = `Your previous response could not be parsed as valid JSON. The error was: {error}

Please try again. Generate exactly {questionCount} quiz questions from the document text below.
Question types: {questionTypes} | Difficulty: {difficulty}

Output ONLY a valid JSON array of question objects. Each object must have:
"question" (string), "type" (string), "options" (array or null), "correct_answer" (string), "explanation" (string), "difficulty" (string).

Questions must test specific facts, concepts, definitions, or relationships from the document — never ask generic questions like "What is the main topic?" or "What does this section discuss?".

Document text:
{text}`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the appropriate prompt template for the given summary style. */
export function getSummaryPrompt(style: SummaryStyle): string {
  switch (style) {
    case 'detailed':
      return SUMMARIZE_DETAILED_PROMPT
    case 'academic':
      return SUMMARIZE_ACADEMIC_PROMPT
    case 'brief':
    default:
      return SUMMARIZE_BRIEF_PROMPT
  }
}
