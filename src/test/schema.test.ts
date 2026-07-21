import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  isQuickFood,
  isFoodEntry,
  isDayData,
  isDayDataMap,
  isRecipe,
  isArrayOf,
  isWorkoutSession,
  isMedSession,
} from '../lib/schema'
import { EMPTY_DAY } from '../data/tracker'
import { safeGet } from '../lib/storage'

const validQuickFood = { n: 'Oats', k: 350, p: 18, c: 42, f: 12, fi: 9 }
const validDay = { ...EMPTY_DAY, foods: [{ ...validQuickFood }] }
const validRecipe = {
  id: 1,
  cat: 'meal',
  type: 'Meal',
  color: '',
  sc: '',
  name: 'Soup',
  tag: '',
  prepL: '',
  prepC: '',
  hk: 100,
  hp: '5g',
  hc: '10g',
  hf: '3g',
  mk: 0,
  mp: '0g',
  mc: '0g',
  mf: '0g',
  ings: [['Water', '1 cup']],
  steps: ['Boil'],
  tip: '',
}

describe('schema guards', () => {
  it('isQuickFood accepts valid and rejects bad shapes', () => {
    expect(isQuickFood(validQuickFood)).toBe(true)
    expect(isQuickFood({ n: 'x', k: '350', p: 1, c: 1, f: 1, fi: 1 })).toBe(false) // k is string
    expect(isQuickFood({ k: 1, p: 1, c: 1, f: 1, fi: 1 })).toBe(false) // missing n
    expect(isQuickFood(null)).toBe(false)
    expect(isQuickFood([])).toBe(false)
  })

  it('isFoodEntry allows optional fields but type-checks them', () => {
    expect(isFoodEntry({ ...validQuickFood, s: 2, hunger: 'physical' })).toBe(true)
    expect(isFoodEntry({ ...validQuickFood, s: 'two' })).toBe(false) // s wrong type
    expect(isFoodEntry({ ...validQuickFood, hunger: 5 })).toBe(false) // hunger wrong type
  })

  it('isDayData accepts EMPTY_DAY and rejects missing/wrong fields', () => {
    expect(isDayData(validDay)).toBe(true)
    expect(isDayData({ ...validDay, workout: null })).toBe(true) // null workout allowed
    expect(isDayData({ ...validDay, energy: '5' })).toBe(false) // energy wrong type
    expect(isDayData({ ...validDay, foods: [{ bad: 1 }] })).toBe(false) // bad food entry
    expect(isDayData({})).toBe(false)
  })

  it('isDayDataMap requires every value to be a DayData', () => {
    expect(isDayDataMap({ '2026-01-01': validDay })).toBe(true)
    expect(isDayDataMap({ '2026-01-01': validDay, '2026-01-02': { bad: 1 } })).toBe(false)
    expect(isDayDataMap({})).toBe(true) // empty map is valid
  })

  it('isRecipe validates required string/number fields', () => {
    expect(isRecipe(validRecipe)).toBe(true)
    expect(isRecipe({ ...validRecipe, hk: 'lots' })).toBe(false) // hk should be number
    expect(isRecipe({ ...validRecipe, steps: 'boil' })).toBe(false) // steps should be string[]
    expect(isRecipe({ ...validRecipe, id: undefined })).toBe(true) // id optional
  })

  it('isWorkoutSession validates required + optional fields', () => {
    const wk = { id: 'oura-1', src: 'oura', type: 'zone2', min: 40 }
    expect(isWorkoutSession(wk)).toBe(true)
    expect(isWorkoutSession({ ...wk, kcal: 200, avgHr: 120, label: 'walking' })).toBe(true)
    expect(isWorkoutSession({ ...wk, src: 'garmin' })).toBe(false) // unknown source
    expect(isWorkoutSession({ ...wk, min: '40' })).toBe(false)
    expect(isWorkoutSession({ ...wk, kcal: 'lots' })).toBe(false)
  })

  it('isMedSession validates required + optional fields', () => {
    const med = { id: 'manual-1', src: 'manual', min: 13, style: 'Guided' }
    expect(isMedSession(med)).toBe(true)
    expect(isMedSession({ ...med, hrv: 60, hr: 55, mood: 'good' })).toBe(true)
    expect(isMedSession({ ...med, style: 3 })).toBe(false)
    expect(isMedSession({ ...med, hrv: 'high' })).toBe(false)
  })

  it('isDayData accepts optional session arrays and rejects malformed ones', () => {
    const wk = { id: 'oura-1', src: 'oura', type: 'zone2', min: 40 }
    const med = { id: 'manual-1', src: 'manual', min: 13, style: '' }
    expect(isDayData({ ...validDay, wkSessions: [wk], medSessions: [med] })).toBe(true)
    expect(isDayData({ ...validDay, wkSessions: [] })).toBe(true)
    expect(isDayData({ ...validDay, wkSessions: [{ bad: 1 }] })).toBe(false)
    expect(isDayData({ ...validDay, medSessions: [{ ...med, min: null }] })).toBe(false)
  })

  it('isArrayOf narrows arrays element-wise', () => {
    expect(isArrayOf([validQuickFood], isQuickFood)).toBe(true)
    expect(isArrayOf([validQuickFood, { bad: 1 }], isQuickFood)).toBe(false)
    expect(isArrayOf('nope', isQuickFood)).toBe(false)
  })
})

describe('safeGet with a validator', () => {
  const store: Record<string, string> = {}
  beforeEach(() => {
    Object.keys(store).forEach(k => delete store[k])
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
      removeItem: (k: string) => {
        delete store[k]
      },
    })
  })

  it('returns parsed value when it passes validation', () => {
    store['k'] = JSON.stringify([validQuickFood])
    const out = safeGet('k', [] as (typeof validQuickFood)[], v => isArrayOf(v, isQuickFood))
    expect(out).toHaveLength(1)
  })

  it('falls back and clears the key when validation fails', () => {
    store['k'] = JSON.stringify([{ garbage: true }])
    const fallback: (typeof validQuickFood)[] = []
    const out = safeGet('k', fallback, v => isArrayOf(v, isQuickFood))
    expect(out).toBe(fallback)
    expect(store['k']).toBeUndefined() // corrupt key removed
  })
})
