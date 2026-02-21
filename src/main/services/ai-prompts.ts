/**
 * Prompt templates and AI-related constants for document operations.
 *
 * Each prompt contains a `{text}` placeholder that is replaced with
 * the document's raw text before being sent to the LLM.
 */

export const DEFAULT_OLLAMA_MODEL = 'llama3'

/** Max characters of raw text to send to the LLM. */
export const RAW_TEXT_MAX_LENGTH = 8_000

export const SUMMARIZE_PROMPT = 'Summarize the following document in 2-3 concise paragraphs:\n\n{text}'

export const KEY_POINTS_PROMPT =
  'Extract 5-10 key points from the following document. Return each point on a new line starting with a dash (-):\n\n{text}'
