import { describe, it, expect } from 'vitest'
import { WORKOUT_PLAN, WORKOUT_PLAN_VERSION, PLAN_NOTES } from '../data/workouts'

describe('WORKOUT_PLAN', () => {
  it('has exactly 4 weeks', () => {
    expect(WORKOUT_PLAN).toHaveLength(4)
  })

  it('weeks are numbered 1, 2, 3', () => {
    expect(WORKOUT_PLAN.map(w => w.week)).toEqual([1, 2, 3, 4])
  })

  it('every week has 7 days', () => {
    WORKOUT_PLAN.forEach(w => {
      expect(w.days).toHaveLength(7)
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

  it('Pilates days optionally have alts', () => {
    const pilatesDays = WORKOUT_PLAN.flatMap(w => w.days.filter(d => d.type === 'Pilates'))
    const withAlts = pilatesDays.filter(d => d.alts && d.alts.length > 0)
    expect(withAlts.length).toBeGreaterThan(0)
  })

  it('every week carries the current plan version', () => {
    WORKOUT_PLAN.forEach(w => expect(w.v).toBe(WORKOUT_PLAN_VERSION))
  })

  it('swap options exist on Day 6 every week', () => {
    WORKOUT_PLAN.forEach(w => expect(w.days[5].alts?.length).toBeGreaterThan(0))
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
