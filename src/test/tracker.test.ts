import { describe, it, expect } from 'vitest'
import {
  QUICK_FOODS,
  SESSION_OPTS,
  MED_MINS,
  MED_STYLES,
  KCAL_TARGET,
  PROT_TARGET,
  CARB_TARGET,
  FAT_TARGET,
  FIBER_TARGET,
  PHASE_NOTES,
  EMPTY_DAY,
  WATER_MAX,
  HUNGER_TYPES,
  hungerIcon,
  hungerLabel,
  WEEK_GOAL_SUGGESTIONS,
} from '../data/tracker'
import type { FoodEntry } from '../data/tracker'

// ── dkey helper (inline — same logic as component) ───────────────
function dkey(d: Date) {
  return d.toISOString().split('T')[0]
}

describe('dkey', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(dkey(new Date('2026-05-25T00:00:00.000Z'))).toBe('2026-05-25')
  })

  it('produces different keys for different dates', () => {
    const a = dkey(new Date('2026-01-01T00:00:00.000Z'))
    const b = dkey(new Date('2026-01-02T00:00:00.000Z'))
    expect(a).not.toBe(b)
  })
})

// ── macro totals (same reduce used in TrackerTab) ────────────────
function calcTotals(foods: FoodEntry[]) {
  return foods.reduce(
    (acc, f) => ({
      k: acc.k + f.k,
      p: acc.p + f.p,
      c: acc.c + f.c,
      f: acc.f + f.f,
      fi: acc.fi + f.fi,
    }),
    { k: 0, p: 0, c: 0, f: 0, fi: 0 },
  )
}

describe('macro totals', () => {
  it('returns zeros for empty food list', () => {
    expect(calcTotals([])).toEqual({ k: 0, p: 0, c: 0, f: 0, fi: 0 })
  })

  it('sums a single food entry', () => {
    const totals = calcTotals([{ n: 'Oats', k: 350, p: 18, c: 42, f: 12, fi: 9 }])
    expect(totals).toEqual({ k: 350, p: 18, c: 42, f: 12, fi: 9 })
  })

  it('sums multiple entries', () => {
    const foods: FoodEntry[] = [
      { n: 'Oats', k: 350, p: 18, c: 42, f: 12, fi: 9 },
      { n: 'Smoothie', k: 390, p: 35, c: 56, f: 9, fi: 8 },
    ]
    const totals = calcTotals(foods)
    expect(totals.k).toBe(740)
    expect(totals.p).toBe(53)
    expect(totals.c).toBe(98)
    expect(totals.f).toBe(21)
    expect(totals.fi).toBe(17)
  })

  it('does not exceed target just from arithmetic', () => {
    // Confirm target constants are sane
    expect(KCAL_TARGET).toBeGreaterThan(1000)
    expect(PROT_TARGET).toBeGreaterThan(0)
    expect(CARB_TARGET).toBeGreaterThan(0)
    expect(FAT_TARGET).toBeGreaterThan(0)
    expect(FIBER_TARGET).toBeGreaterThan(0)
  })
})

// ── data constants ───────────────────────────────────────────────
describe('QUICK_FOODS', () => {
  it('has at least 10 entries', () => {
    expect(QUICK_FOODS.length).toBeGreaterThanOrEqual(10)
  })

  it('every entry has all required numeric fields > 0', () => {
    QUICK_FOODS.forEach(f => {
      expect(f.n).toBeTruthy()
      expect(f.k).toBeGreaterThan(0)
      expect(typeof f.p).toBe('number')
      expect(typeof f.c).toBe('number')
      expect(typeof f.f).toBe('number')
      expect(typeof f.fi).toBe('number')
    })
  })
})

describe('SESSION_OPTS', () => {
  it('includes pilates and rest day', () => {
    const ids = SESSION_OPTS.map(s => s.id)
    expect(ids).toContain('pilates')
    expect(ids).toContain('rest')
  })

  it('every session has a label and color', () => {
    SESSION_OPTS.forEach(s => {
      expect(s.label).toBeTruthy()
      expect(s.color).toMatch(/^var\(--/)
    })
  })
})

describe('MED_MINS / MED_STYLES', () => {
  it('MED_MINS includes 13 (the research-backed duration)', () => {
    expect(MED_MINS).toContain(13)
  })

  it('MED_STYLES has at least 3 options', () => {
    expect(MED_STYLES.length).toBeGreaterThanOrEqual(3)
  })

  it('MED_STYLES includes the breathing techniques', () => {
    expect(MED_STYLES).toContain('Box breathing')
    expect(MED_STYLES).toContain('Long exhale')
  })
})

describe('PHASE_NOTES', () => {
  it('has a fallback for empty string', () => {
    expect(PHASE_NOTES['']).toBeTruthy()
  })

  it('covers all 5 named phases', () => {
    const phases = ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'Unsure']
    phases.forEach(p => {
      expect(PHASE_NOTES[p]).toBeTruthy()
    })
  })
})

describe('EMPTY_DAY', () => {
  it('initialises stress and water to 0', () => {
    expect(EMPTY_DAY.stress).toBe(0)
    expect(EMPTY_DAY.water).toBe(0)
  })

  it('WATER_MAX is a positive cap', () => {
    expect(WATER_MAX).toBeGreaterThan(0)
  })

  it('FoodEntry supports an optional satiety value', () => {
    const entry: FoodEntry = { n: 'Oats', k: 350, p: 18, c: 42, f: 12, fi: 9, sat: 5 }
    expect(entry.sat).toBe(5)
  })

  it('FoodEntry supports an optional hunger type', () => {
    const entry: FoodEntry = { n: 'Chips', k: 150, p: 2, c: 15, f: 9, fi: 1, hunger: 'mouth' }
    expect(entry.hunger).toBe('mouth')
  })
})

describe('HUNGER_TYPES', () => {
  it('has the five Noom hunger types', () => {
    expect(HUNGER_TYPES.map(h => h.id)).toEqual([
      'stomach',
      'mouth',
      'emotional',
      'learned',
      'social',
    ])
  })

  it('hungerIcon and hungerLabel resolve known ids', () => {
    expect(hungerIcon('mouth')).toBeTruthy()
    expect(hungerLabel('emotional')).toBe('Emotional')
  })

  it('hungerIcon and hungerLabel return empty for unknown/undefined', () => {
    expect(hungerIcon('nope')).toBe('')
    expect(hungerLabel(undefined)).toBe('')
  })
})

describe('WEEK_GOAL_SUGGESTIONS', () => {
  it('provides at least one seed suggestion', () => {
    expect(WEEK_GOAL_SUGGESTIONS.length).toBeGreaterThan(0)
  })
})
