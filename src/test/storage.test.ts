import { describe, it, expect, beforeEach, vi } from 'vitest'
import { safeGet, safeSet, safeRemove, safeHas, safeClear } from '../lib/storage'

// Minimal in-memory localStorage with a togglable failure mode.
let failWrites = false
const store: Record<string, string> = {}

beforeEach(() => {
  failWrites = false
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      if (failWrites) throw new DOMException('quota', 'QuotaExceededError')
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => Object.keys(store).forEach(k => delete store[k]),
  })
  // Silence the reportError console breadcrumbs from the warn paths.
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('safeGet / safeSet', () => {
  it('round-trips a value', () => {
    safeSet('k', { a: 1 })
    expect(safeGet('k', null)).toEqual({ a: 1 })
  })

  it('returns the fallback for a missing key', () => {
    expect(safeGet('missing', 'fallback')).toBe('fallback')
  })

  it('returns the fallback and clears the key on corrupt JSON', () => {
    store['k'] = '{not valid json'
    expect(safeGet('k', 'fb')).toBe('fb')
    expect(store['k']).toBeUndefined()
  })

  it('swallows write failures (quota) without throwing', () => {
    failWrites = true
    expect(() => safeSet('k', { a: 1 })).not.toThrow()
    expect(store['k']).toBeUndefined()
  })

  it('honors a validator: keeps valid, rejects invalid', () => {
    const isNumArr = (v: unknown): v is number[] =>
      Array.isArray(v) && v.every(n => typeof n === 'number')
    safeSet('k', [1, 2, 3])
    expect(safeGet('k', [], isNumArr)).toEqual([1, 2, 3])

    store['bad'] = JSON.stringify(['a', 'b'])
    expect(safeGet('bad', [], isNumArr)).toEqual([])
    expect(store['bad']).toBeUndefined() // invalid value cleared
  })
})

describe('safeRemove / safeHas / safeClear', () => {
  it('safeHas reflects key presence (even for falsy values)', () => {
    expect(safeHas('k')).toBe(false)
    safeSet('k', false)
    expect(safeHas('k')).toBe(true)
  })

  it('safeRemove deletes a key', () => {
    safeSet('k', 1)
    safeRemove('k')
    expect(safeHas('k')).toBe(false)
  })

  it('safeClear wipes everything', () => {
    safeSet('a', 1)
    safeSet('b', 2)
    safeClear()
    expect(safeHas('a')).toBe(false)
    expect(safeHas('b')).toBe(false)
  })
})
