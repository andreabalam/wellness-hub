/**
 * Tests for the centralized error reporter. supabase is null in the unit env,
 * so persistence is a no-op — these cover the user-facing contract:
 * generic message, console breadcrumb, dedupe, and never-throws.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { reportError, GENERIC_ERROR_MESSAGE, _resetErrorLogDedupe } from '../lib/errorLog'

describe('reportError', () => {
  beforeEach(() => {
    _resetErrorLogDedupe()
    vi.restoreAllMocks()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the generic user-facing message and never leaks detail', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const msg = reportError('test:ctx', new Error('secret internal stack detail'))
    expect(msg).toBe(GENERIC_ERROR_MESSAGE)
    expect(msg).not.toContain('secret internal')
  })

  it('logs an error breadcrumb with the context', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportError('boom:here', new Error('x'))
    expect(spy).toHaveBeenCalledWith('[boom:here]', expect.any(Error))
  })

  it('stringifies a non-Error, falling back to String() on a circular object', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const circular: Record<string, unknown> = {}
    circular.self = circular // JSON.stringify throws → String() fallback
    expect(() => reportError('circ:ctx', circular)).not.toThrow()
    expect(spy).toHaveBeenCalled()
  })

  it('uses console.warn for warn severity', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportError('soft:ctx', 'just a string', { severity: 'warn' })
    expect(warn).toHaveBeenCalledWith('[soft:ctx]', 'just a string')
    expect(err).not.toHaveBeenCalled()
  })

  it('dedupes identical context+message within the window', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportError('dup:ctx', new Error('same'))
    reportError('dup:ctx', new Error('same'))
    reportError('dup:ctx', new Error('same'))
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('does not dedupe across different contexts', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    reportError('a', new Error('same'))
    reportError('b', new Error('same'))
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('handles non-Error values without throwing', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => reportError('obj:ctx', { weird: 1 })).not.toThrow()
    expect(reportError('null:ctx', null)).toBe(GENERIC_ERROR_MESSAGE)
  })

  it('prunes the dedupe cache once it grows past the cap', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    // > 200 unique contexts triggers the opportunistic cleanup pass.
    for (let i = 0; i < 205; i++) {
      expect(reportError(`bulk:${i}`, new Error('x'))).toBe(GENERIC_ERROR_MESSAGE)
    }
  })
})
