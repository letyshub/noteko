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

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a mock ReadableStream that yields chunked JSON lines,
 * simulating the Ollama streaming API response.
 */
function createMockStream(chunks: Array<{ response: string; done: boolean }>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  let index = 0

  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        const line = JSON.stringify(chunks[index]) + '\n'
        controller.enqueue(encoder.encode(line))
        index++
      } else {
        controller.close()
      }
    },
  })
}

/**
 * Create a successful fetch Response with the given body stream.
 */
function createStreamResponse(chunks: Array<{ response: string; done: boolean }>): Response {
  return new Response(createMockStream(chunks), {
    status: 200,
    headers: { 'Content-Type': 'application/x-ndjson' },
  })
}

/**
 * Collect all chunks from an async generator.
 */
async function collectChunks(gen: AsyncGenerator<string>): Promise<string[]> {
  const chunks: string[] = []
  for await (const chunk of gen) {
    chunks.push(chunk)
  }
  return chunks
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ollama-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // ─── Health check success ───────────────────────────────────────

  describe('checkHealth', () => {
    it('should return connected: true with model names when Ollama is reachable', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            models: [
              { name: 'llama3:latest', size: 4_000_000_000, modified_at: '2024-01-01T00:00:00Z' },
              { name: 'mistral:latest', size: 3_500_000_000, modified_at: '2024-01-02T00:00:00Z' },
            ],
          }),
          { status: 200 },
        ),
      )

      const { checkHealth } = await import('@main/services/ollama-service')
      const result = await checkHealth()

      expect(result.connected).toBe(true)
      expect(result.models).toEqual(['llama3:latest', 'mistral:latest'])
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/tags',
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    })

    // ─── Health check failure ───────────────────────────────────────

    it('should return connected: false with empty models when Ollama is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'))

      const { checkHealth } = await import('@main/services/ollama-service')
      const result = await checkHealth()

      expect(result.connected).toBe(false)
      expect(result.models).toEqual([])
    })
  })

  // ─── List models ──────────────────────────────────────────────

  describe('listModels', () => {
    it('should parse and return OllamaModel[] from /api/tags', async () => {
      const modelsPayload = {
        models: [
          { name: 'llama3:latest', size: 4_000_000_000, modified_at: '2024-01-01T00:00:00Z' },
          { name: 'mistral:7b', size: 3_500_000_000, modified_at: '2024-01-02T00:00:00Z' },
        ],
      }
      mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(modelsPayload), { status: 200 }))

      const { listModels } = await import('@main/services/ollama-service')
      const models = await listModels()

      expect(models).toHaveLength(2)
      expect(models[0]).toEqual({
        name: 'llama3:latest',
        size: 4_000_000_000,
        modified_at: '2024-01-01T00:00:00Z',
      })
      expect(models[1]).toEqual({
        name: 'mistral:7b',
        size: 3_500_000_000,
        modified_at: '2024-01-02T00:00:00Z',
      })
    })
  })

  // ─── Streaming generation ─────────────────────────────────────

  describe('generate', () => {
    it('should yield text chunks from a streaming response', async () => {
      const streamChunks = [
        { response: 'Hello', done: false },
        { response: ' world', done: false },
        { response: '!', done: true },
      ]
      mockFetch.mockResolvedValueOnce(createStreamResponse(streamChunks))

      const { generate } = await import('@main/services/ollama-service')
      const chunks = await collectChunks(generate({ model: 'llama3', prompt: 'Say hello' }))

      expect(chunks).toEqual(['Hello', ' world', '!'])
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:11434/api/generate',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"stream":true'),
        }),
      )
    })
  })

  // ─── Text truncation ──────────────────────────────────────────

  describe('text truncation', () => {
    it('should truncate text longer than 8000 characters before sending', async () => {
      const longText = 'A'.repeat(10000)
      const streamChunks = [{ response: 'Summary', done: true }]
      mockFetch.mockResolvedValueOnce(createStreamResponse(streamChunks))

      const { generate } = await import('@main/services/ollama-service')
      await collectChunks(generate({ model: 'llama3', prompt: longText }))

      // Verify the body sent to fetch has truncated text
      const callArgs = mockFetch.mock.calls[0]
      const body = JSON.parse(callArgs[1].body as string)
      expect(body.prompt.length).toBeLessThanOrEqual(8000)
    })
  })

  // ─── Timeout ──────────────────────────────────────────────────

  describe('timeout', () => {
    it('should abort and throw when generation exceeds timeout', async () => {
      // Mock fetch that never resolves, simulating a hang
      mockFetch.mockImplementationOnce(
        (_url: string, options: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            // Listen for abort signal and reject with AbortError
            options.signal.addEventListener('abort', () => {
              const error = new DOMException('The operation was aborted.', 'AbortError')
              reject(error)
            })
          }),
      )

      const { generate, _testOverrides } = await import('@main/services/ollama-service')
      // Override timeout for test speed
      _testOverrides.generationTimeout = 50

      try {
        await collectChunks(generate({ model: 'llama3', prompt: 'test' }))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toMatch(/aborted|timed out/i)
      } finally {
        // Reset
        _testOverrides.generationTimeout = 120_000
      }
    })
  })

  // ─── Retry on transient failure ───────────────────────────────

  describe('retry', () => {
    it('should retry on connection refused and succeed on second attempt', async () => {
      // First call: connection refused
      mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'))
      // Second call: success
      const streamChunks = [{ response: 'Success after retry', done: true }]
      mockFetch.mockResolvedValueOnce(createStreamResponse(streamChunks))

      const { generate } = await import('@main/services/ollama-service')
      const chunks = await collectChunks(generate({ model: 'llama3', prompt: 'test' }))

      expect(chunks).toEqual(['Success after retry'])
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should not retry on 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce(new Response('Bad Request', { status: 400, statusText: 'Bad Request' }))

      const { generate } = await import('@main/services/ollama-service')

      try {
        await collectChunks(generate({ model: 'llama3', prompt: 'test' }))
        expect.unreachable('Should have thrown')
      } catch (error) {
        expect((error as Error).message).toContain('400')
      }

      // Should NOT have retried
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })
  })
})
