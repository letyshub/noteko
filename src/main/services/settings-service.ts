/**
 * Application settings persistence service.
 *
 * Provides CRUD operations for the app_settings table.
 * Settings are stored as key-value text pairs with automatic timestamps.
 *
 * Known settings keys:
 *   - ollama.url   - Ollama server URL
 *   - ollama.model - Default Ollama model for AI operations
 *
 * Exported functions:
 *   - getSetting(key)         - get a single setting value
 *   - setSetting(key, value)  - create or update a setting
 *   - getAllSettings()        - get all settings as a Record
 */

import { eq } from 'drizzle-orm'
import { getDb } from '@main/database/connection'
import { appSettings } from '@main/database/schema'

// Allowlist of valid setting keys (C-2: prevent arbitrary key injection)
const ALLOWED_SETTINGS = ['ollama.url', 'ollama.model'] as const
type SettingKey = (typeof ALLOWED_SETTINGS)[number]

function isAllowedKey(key: string): key is SettingKey {
  return (ALLOWED_SETTINGS as readonly string[]).includes(key)
}

// C-1: Validate Ollama URL to prevent SSRF
function isValidOllamaUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return ['http:', 'https:'].includes(parsed.protocol) && ['localhost', '127.0.0.1'].includes(parsed.hostname)
  } catch {
    return false
  }
}

/**
 * Retrieve a single setting value by key.
 *
 * @param key - Setting key (e.g. 'ollama.url')
 * @returns The setting value, or null if not found
 */
export function getSetting(key: string): string | null {
  const row = getDb().select().from(appSettings).where(eq(appSettings.key, key)).get()
  return row?.value ?? null
}

/**
 * Create or update a setting.
 *
 * Uses INSERT ... ON CONFLICT UPDATE to handle both creation and update
 * in a single operation. Only allows known setting keys.
 *
 * @param key - Setting key (must be in the allowlist)
 * @param value - Setting value
 * @throws Error if key is not in the allowlist or value is invalid
 */
export function setSetting(key: string, value: string): void {
  if (!isAllowedKey(key)) {
    throw new Error(`Unknown setting key: "${key}". Allowed keys: ${ALLOWED_SETTINGS.join(', ')}`)
  }

  if (key === 'ollama.url' && !isValidOllamaUrl(value)) {
    throw new Error('Invalid Ollama URL. Must be http(s)://localhost or http(s)://127.0.0.1')
  }

  getDb()
    .insert(appSettings)
    .values({
      key,
      value,
      updated_at: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: {
        value,
        updated_at: new Date().toISOString(),
      },
    })
    .run()
}

/**
 * Retrieve all settings as a key-value record.
 *
 * @returns Record mapping setting keys to their values
 */
export function getAllSettings(): Record<string, string> {
  const rows = getDb().select().from(appSettings).all()
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
}
