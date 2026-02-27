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
 * Create a mock ReadableStream that yields chunked NDJSON lines
 * for the /api/chat endpoint (uses `message.content`, not `response`).
 */
function createChatMockStream(
  chunks: Array<{ message: { role: string; content: string }; done: boolean }>,
): ReadableStream<Uint8Array> {
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
 * Create a successful fetch Response with the given chat body stream.
 */
function createChatStreamResponse(
  chunks: Array<{ message: { role: string; content: string }; done: boolean }>,
): Response {
  return new Response(createChatMockStream(chunks), {
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

describe('ollama-service chat()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  // ─── Streaming chat ────────────────────────────────────────────

  it('should yield tokens from /api/chat NDJSON stream parsing message.content field', async () => {
    const streamChunks = [
      { message: { role: 'assistant', content: 'Hello' }, done: false },
      { message: { role: 'assistant', content: ' there' }, done: false },
      { message: { role: 'assistant', content: '!' }, done: true },
    ]
    mockFetch.mockResolvedValueOnce(createChatStreamResponse(streamChunks))

    const { chat } = await import('@main/services/ollama-service')
    const messages = [
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'Hi' },
    ]
    const chunks = await collectChunks(chat({ url: 'http://localhost:11434', model: 'llama3', messages }))

    expect(chunks).toEqual(['Hello', ' there', '!'])
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/chat',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"stream":true'),
      }),
    )

    // Verify messages are passed through without truncation
    const callArgs = mockFetch.mock.calls[0]
    const body = JSON.parse(callArgs[1].body as string)
    expect(body.messages).toEqual(messages)
  })

  // ─── Timeout ──────────────────────────────────────────────────

  it('should abort and throw when chat exceeds 120s timeout', async () => {
    // Mock fetch that never resolves, simulating a hang
    mockFetch.mockImplementationOnce(
      (_url: string, options: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            const error = new DOMException('The operation was aborted.', 'AbortError')
            reject(error)
          })
        }),
    )

    const { chat, _testOverrides } = await import('@main/services/ollama-service')
    // Override timeout for test speed
    _testOverrides.generationTimeout = 50

    try {
      await collectChunks(
        chat({
          url: 'http://localhost:11434',
          model: 'llama3',
          messages: [{ role: 'user', content: 'test' }],
        }),
      )
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect((error as Error).message).toMatch(/aborted|timed out/i)
    } finally {
      // Reset
      _testOverrides.generationTimeout = 120_000
    }
  })

  // ─── Error handling: non-200 response ─────────────────────────

  it('should throw on non-200 response from Ollama', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' }),
    )

    const { chat } = await import('@main/services/ollama-service')

    try {
      await collectChunks(
        chat({
          url: 'http://localhost:11434',
          model: 'llama3',
          messages: [{ role: 'user', content: 'test' }],
        }),
      )
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('500')
    }
  })

  // ─── Error handling: Ollama unavailable ────────────────────────

  it('should throw when Ollama is unavailable after retries', async () => {
    // All attempts fail with connection error
    mockFetch.mockRejectedValue(new TypeError('fetch failed'))

    const { chat } = await import('@main/services/ollama-service')

    try {
      await collectChunks(
        chat({
          url: 'http://localhost:11434',
          model: 'llama3',
          messages: [{ role: 'user', content: 'test' }],
        }),
      )
      expect.unreachable('Should have thrown')
    } catch (error) {
      expect((error as Error).message).toContain('fetch failed')
    }

    // Should have attempted retries (initial + MAX_RETRIES = 3 total)
    expect(mockFetch).toHaveBeenCalledTimes(3)
  })
})
