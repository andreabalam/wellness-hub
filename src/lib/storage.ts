/**
 * Safe localStorage helpers.
 * Handles corrupt/missing values gracefully instead of throwing.
 */

export function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    console.warn(`[storage] corrupt value at "${key}", resetting to default`)
    try { localStorage.removeItem(key) } catch { /* quota or stubbed env */ }
    return fallback
  }
}

export function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    console.warn(`[storage] failed to write "${key}":`, err)
  }
}
