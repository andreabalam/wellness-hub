import { describe, it, expect } from 'vitest'
import { SWAPS, CRAVING_TYPES, swapsFor } from '../data/swaps'

describe('craving swaps', () => {
  it('every swap has a valid craving type and both ends', () => {
    for (const s of SWAPS) {
      expect(CRAVING_TYPES).toContain(s.craving)
      expect(s.from).toBeTruthy()
      expect(s.to).toBeTruthy()
    }
  })

  it('swapsFor returns only that craving', () => {
    for (const c of CRAVING_TYPES) {
      const list = swapsFor(c)
      expect(list.length).toBeGreaterThan(0)
      list.forEach(s => expect(s.craving).toBe(c))
    }
  })

  it('covers all three craving types', () => {
    expect(CRAVING_TYPES).toEqual(['sweet', 'crunchy', 'savory'])
  })
})
