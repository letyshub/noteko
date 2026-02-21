/**
 * Ollama LLM HTTP client service.
 *
 * Communicates with a local Ollama instance via its REST API.
 * Provides health checking, model listing, and streaming text generation.
 *
 * Uses Node.js built-in fetch (no additional packages).
 *
 * Exported functions:
 *   - checkHealth(baseUrl?)  - verify Ollama connectivity and list models
 *   - listModels(baseUrl?)   - retrieve available models
 *   - generate(options)      - stream text generation via async generator
 */

import log from 'electron-log'
import type { OllamaModel, OllamaHealthResult } from '@shared/types'

// ---------------------------------------------------------------------------
// Configuration defaults
// ---------------------------------------------------------------------------

const DEFAULT_OLLAMA_URL = 'http://localhost:11434'
const GENERATION_TIMEOUT = 120_000
const HEALTH_TIMEOUT = 30_000
const MAX_TEXT_LENGTH = 8_000
const MAX_RETRIES = 2

// ---------------------------------------------------------------------------
// Test overrides (only used in tests to speed up timeout assertions)
// ---------------------------------------------------------------------------

/** @internal Exposed for test overrides only. */
export const _testOverrides = {
  generationTimeout: GENERATION_TIMEOUT,
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GenerateOptions {
  model: string
  prompt: string
  baseUrl?: string
}

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

/**
 * Check if Ollama is running and list available model names.
 *
 * @param baseUrl - Ollama server URL (defaults to http://localhost:11434)
 * @returns Health result with connection status and model name list
 */
export async function checkHealth(baseUrl?: string): Promise<OllamaHealthResult> {
  const url = baseUrl ?? DEFAULT_OLLAMA_URL

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT)

    const response = await fetch(`${url}/api/tags`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      log.warn(`[ollama-service] Health check returned status ${response.status}`)
      return { connected: false, models: [] }
    }

    const data = (await response.json()) as { models: OllamaModel[] }
    const modelNames = data.models.map((m) => m.name)

    log.info(`[ollama-service] Health check OK, ${modelNames.length} model(s) available`)
    return { connected: true, models: modelNames }
  } catch (error) {
    log.warn('[ollama-service] Health check failed:', error instanceof Error ? error.message : error)
    return { connected: false, models: [] }
  }
}

// ---------------------------------------------------------------------------
// List models
// ---------------------------------------------------------------------------

/**
 * List all available Ollama models with full metadata.
 *
 * @param baseUrl - Ollama server URL (defaults to http://localhost:11434)
 * @returns Array of OllamaModel objects
 */
export async function listModels(baseUrl?: string): Promise<OllamaModel[]> {
  const url = baseUrl ?? DEFAULT_OLLAMA_URL

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), HEALTH_TIMEOUT)

  try {
    const response = await fetch(`${url}/api/tags`, {
      signal: controller.signal,
    })
    clearTimeout(timeoutId)

    if (!response.ok) {
      throw new Error(`Ollama API returned status ${response.status}`)
    }

    const data = (await response.json()) as { models: OllamaModel[] }

    return data.models.map((m) => ({
      name: m.name,
      size: m.size,
      modified_at: m.modified_at,
    }))
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

// ---------------------------------------------------------------------------
// Streaming generation
// ---------------------------------------------------------------------------

/**
 * Determine whether an error is a transient failure that should be retried.
 * Retries: connection refused, fetch failed (network errors).
 * No retry: 4xx errors, abort/timeout errors, other non-transient errors.
 */
function isTransientError(error: unknown): boolean {
  // Abort errors (from our own timeout) should not be retried
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false
  }
  if (error instanceof TypeError && (error as Error).message.includes('fetch failed')) {
    return true
  }
  if (error instanceof Error && error.message.includes('ECONNREFUSED')) {
    return true
  }
  return false
}

/**
 * Stream text generation from Ollama.
 *
 * Sends a POST request to /api/generate with streaming enabled and yields
 * text chunks via an async generator. Supports timeout, cancellation via
 * AbortController, retry for transient failures, and text truncation.
 *
 * @param options - Generation options (model, prompt, optional baseUrl)
 * @yields Individual text chunks as they arrive
 */
export async function* generate(options: GenerateOptions): AsyncGenerator<string> {
  const { model, baseUrl } = options
  const url = baseUrl ?? DEFAULT_OLLAMA_URL

  // Truncate prompt to MAX_TEXT_LENGTH
  const prompt = options.prompt.length > MAX_TEXT_LENGTH ? options.prompt.slice(0, MAX_TEXT_LENGTH) : options.prompt

  const body = JSON.stringify({ model, prompt, stream: true })

  let lastError: unknown
  let response: Response | null = null

  // Retry loop for transient failures
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const controller = new AbortController()
    const timeout = _testOverrides.generationTimeout
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      response = await fetch(`${url}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: controller.signal,
      })
      clearTimeout(timeoutId)

      // 4xx errors: do not retry
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`)
      }

      if (!response.ok) {
        throw new Error(`Ollama API returned ${response.status}: ${response.statusText}`)
      }

      // Success -- break out of retry loop
      break
    } catch (error) {
      clearTimeout(timeoutId)
      lastError = error

      // 4xx: do not retry
      if (error instanceof Error && error.message.includes('returned 4')) {
        throw error
      }

      if (attempt < MAX_RETRIES && isTransientError(error)) {
        log.warn(`[ollama-service] Transient error (attempt ${attempt + 1}/${MAX_RETRIES + 1}), retrying...`)
        continue
      }

      // Exhausted retries or non-transient error
      throw error
    }
  }

  if (!response || !response.body) {
    throw lastError ?? new Error('No response received from Ollama')
  }

  // Read the streaming response
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process complete lines
      const lines = buffer.split('\n')
      // Keep the last (possibly incomplete) line in the buffer
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue

        try {
          const parsed = JSON.parse(trimmed) as { response: string; done: boolean }
          yield parsed.response

          if (parsed.done) {
            return
          }
        } catch {
          log.warn('[ollama-service] Failed to parse stream line:', trimmed)
        }
      }
    }

    // Process any remaining buffer content
    if (buffer.trim()) {
      try {
        const parsed = JSON.parse(buffer.trim()) as { response: string; done: boolean }
        yield parsed.response
      } catch {
        log.warn('[ollama-service] Failed to parse final buffer:', buffer)
      }
    }
  } catch (error) {
    log.error('[ollama-service] Stream interrupted:', error instanceof Error ? error.message : error)
    throw new Error('Stream interrupted: partial results discarded')
  } finally {
    reader.releaseLock()
  }
}
