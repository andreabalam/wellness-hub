/**
 * Safe localStorage helpers.
 * Handles corrupt/missing values gracefully instead of throwing.
 */
import { reportError } from './errorLog'

export function safeGet<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch (err) {
    reportError(`storage:get:${key}`, err, { severity: 'warn' })
    try { localStorage.removeItem(key) } catch { /* quota or stubbed env */ }
    return fallback
  }
}

export function safeSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (err) {
    reportError(`storage:set:${key}`, err, { severity: 'warn' })
  }
}
