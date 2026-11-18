import { describe, it, expect } from 'vitest'
import { WORKOUT_PLAN, WORKOUT_PLAN_VERSION, PLAN_NOTES } from '../data/workouts'

describe('WORKOUT_PLAN', () => {
  it('has exactly 4 weeks', () => {
    expect(WORKOUT_PLAN).toHaveLength(4)
  })

  it('weeks are numbered 1, 2, 3', () => {
    expect(WORKOUT_PLAN.map(w => w.week)).toEqual([1, 2, 3, 4])
  })

  it('every week is the same 6-workout rotation (no rest or walk days)', () => {
    WORKOUT_PLAN.forEach(w => {
      expect(w.days.map(d => d.slot)).toEqual([
        'Day 1',
        'Day 2',
        'Day 3',
        'Day 4',
        'Day 5',
        'Day 6',
      ])
      expect(w.days.some(d => d.type === 'Rest' || d.type === 'Recovery')).toBe(false)
    })
  })

  it('trains upper body at least twice per rotation', () => {
    WORKOUT_PLAN.forEach(w => {
      expect(w.days.filter(d => /^Upper/.test(d.label))).toHaveLength(2)
    })
  })

  it('every week has a note and nutr string', () => {
    WORKOUT_PLAN.forEach(w => {
      expect(w.note.length).toBeGreaterThan(10)
      expect(w.nutr.length).toBeGreaterThan(10)
    })
  })

  it('every day has at least 2 exercises', () => {
    WORKOUT_PLAN.forEach(w => {
      w.days.forEach(d => {
        expect(d.exs.length, `${w.label} ${d.slot} has no exercises`).toBeGreaterThanOrEqual(2)
      })
    })
  })

  it('every exercise has t, d, and i fields', () => {
    WORKOUT_PLAN.forEach(w => {
      w.days.forEach(day => {
        day.exs.forEach(ex => {
          expect(ex.t).toBeTruthy()
          expect(ex.d).toBeTruthy()
          expect(ex.i).toBeTruthy()
        })
      })
    })
  })

  it('weights are the default every day; Pilates is only ever Option B', () => {
    WORKOUT_PLAN.forEach(w => {
      expect(w.days.every(d => d.type !== 'Pilates')).toBe(true)
      const withB = w.days.filter(d => d.alts?.length)
      expect(withB.map(d => d.slot)).toEqual(['Day 5', 'Day 6'])
      withB.forEach(d => {
        expect(d.altType).toBe('Pilates')
        expect(d.altLabel).toMatch(/^Option B: Pilates/)
      })
    })
  })

  it('every week carries the current plan version', () => {
    WORKOUT_PLAN.forEach(w => expect(w.v).toBe(WORKOUT_PLAN_VERSION))
  })

  it('the cycle week changes the dose, not the exercises', () => {
    const names = (w: (typeof WORKOUT_PLAN)[number]) => w.days.map(d => d.exs.map(e => e.t))
    WORKOUT_PLAN.forEach(w => expect(names(w)).toEqual(names(WORKOUT_PLAN[0])))
    const mainSets = WORKOUT_PLAN.map(w => w.days[0].exs[1].d)
    expect(mainSets).toEqual([
      '4×10-12 per side',
      '5×10-12 per side',
      '5×10-12 per side',
      '3×10-12 per side',
    ])
  })

  it('week colors are CSS variables', () => {
    WORKOUT_PLAN.forEach(w => {
      expect(w.color).toMatch(/^var\(--/)
    })
  })
})

describe('PLAN_NOTES', () => {
  it('has 6 guidance notes', () => {
    expect(PLAN_NOTES).toHaveLength(6)
  })

  it('every note has icon, title, color, text', () => {
    PLAN_NOTES.forEach(n => {
      expect(n.icon).toBeTruthy()
      expect(n.title).toBeTruthy()
      expect(n.color).toMatch(/^var\(--/)
      expect(n.text.length).toBeGreaterThan(20)
    })
  })
})
