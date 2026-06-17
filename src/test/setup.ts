import '@testing-library/jest-dom'
import { beforeAll, afterAll } from 'vitest'

// ── Suppress known-harmless console noise in tests ───────────────
//
// [storage] corrupt value — expected when a test seeds bad localStorage;
//   the correct fallback is asserted, the warning is just noise.
//
// act() warning — fires when async state updates settle after an
//   assertion in App / RecipesTab tests. All tests pass; it's cosmetic
//   noise from fire-and-forget effects inside those components.
//
// [sync] / [syncAll] — intentionally triggered by the error-recovery test
//   (reportError logs the context); the test asserts the app doesn't crash,
//   not the log line.

const originalWarn  = console.warn
const originalError = console.error

beforeAll(() => {
  console.warn = (...args: unknown[]) => {
    if (typeof args[0] === 'string' && args[0].startsWith('[storage')) return
    originalWarn(...args)
  }

  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : ''
    if (msg.includes('not wrapped in act')) return
    if (msg.startsWith('[sync]')) return
    if (msg.startsWith('[syncAll]')) return
    originalError(...args)
  }
})

afterAll(() => {
  console.warn  = originalWarn
  console.error = originalError
})
