/**
 * Safe localStorage helpers.
 * Handles corrupt/missing values gracefully instead of throwing.
 */
import { reportError } from './errorLog'

/**
 * Read and JSON-parse a localStorage value, falling back on corruption.
 *
 * Pass `validate` to also guard against schema drift / hand-edited data: if the
 * parsed value doesn't match the expected shape it's treated like corruption —
 * logged, the key cleared, and `fallback` returned — instead of being cast with
 * `as` and crashing somewhere downstream.
 */
export function safeGet<T>(key: string, fallback: T, validate?: (v: unknown) => v is T): T {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    if (validate && !validate(parsed)) {
      reportError(`storage:invalid:${key}`, new Error('value failed validation'), {
        severity: 'warn',
      })
      try {
        localStorage.removeItem(key)
      } catch {
        /* quota or stubbed env */
      }
      return fallback
    }
    return parsed as T
  } catch (err) {
    reportError(`storage:get:${key}`, err, { severity: 'warn' })
    try {
      localStorage.removeItem(key)
    } catch {
      /* quota or stubbed env */
    }
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

export function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch (err) {
    reportError(`storage:remove:${key}`, err, { severity: 'warn' })
  }
}

/** True when the key exists at all (even if its value is empty/falsy). */
export function safeHas(key: string): boolean {
  try {
    return localStorage.getItem(key) !== null
  } catch {
    return false
  }
}

/** Wipe all localStorage (used by the "reset all data" recovery action). */
export function safeClear(): void {
  try {
    localStorage.clear()
  } catch (err) {
    reportError('storage:clear', err, { severity: 'warn' })
  }
}
