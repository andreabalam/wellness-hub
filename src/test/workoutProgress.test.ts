import { describe, it, expect } from 'vitest'
import { exerciseProgress, workoutHistory } from '../lib/workoutProgress'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData, LoggedExercise, WorkoutSession } from '../data/tracker'

const session = (exercises: LoggedExercise[] = [], extra: Partial<WorkoutSession> = {}) =>
  ({ id: 'm', src: 'manual', type: 'full-body', min: 40, exercises, ...extra }) as WorkoutSession
const day = (...sessions: WorkoutSession[]): DayData => ({
  ...EMPTY_DAY,
  foods: [],
  wkSessions: sessions,
})
const ex = (name: string, ...sets: [number | undefined, number | undefined, boolean?][]) => ({
  name,
  sets: sets.map(([reps, kg, done = true]) => ({ reps, kg, done })),
})

describe('workoutHistory', () => {
  it('groups days with sessions by Mon–Sun week, newest first', () => {
    const h = workoutHistory({
      '2026-10-20': day(session()),
      '2026-10-25': day(session()), // Sunday — same week as the 20th
      '2026-10-14': day(session()),
      '2026-10-15': day(), // no sessions — skipped
    })
    expect(h.map(w => w.week)).toEqual(['2026-10-19', '2026-10-12'])
    expect(h[0].days.map(d => d.date)).toEqual(['2026-10-25', '2026-10-20'])
  })
})

describe('exerciseProgress', () => {
  const days: Record<string, DayData> = {
    '2026-10-01': day(session([ex('Hip thrust', [10, 20], [8, 22.5]), ex('Plank')])),
    '2026-10-08': day(session([ex('hip  THRUST', [10, 25], [12, 30, false])])),
    '2026-10-15': day(session([ex('Hip thrust', [10, 22.5])])),
    '2026-10-10': day(session([ex('Push-ups', [8, undefined], [10, undefined])])),
    '2026-10-12': day(
      session([
        {
          name: 'Side plank',
          sets: [
            { sec: 30, done: true },
            { sec: 45, done: true },
          ],
        },
      ]),
    ),
  }

  it('tracks the top weighted set per workout, merging name variants', () => {
    const p = exerciseProgress(days).find(e => e.name === 'Hip thrust')!
    expect(p.unit).toBe('kg')
    expect(p.points.map(x => x.value)).toEqual([22.5, 25, 22.5]) // unticked 30 kg ignored
    expect(p.first.set).toBe('8 × 22.5 kg')
    expect(p.best).toMatchObject({ date: '2026-10-08', set: '10 × 25 kg' })
    expect(p.change).toBe(0)
  })

  it('uses reps for bodyweight and seconds for holds', () => {
    const all = exerciseProgress(days)
    expect(all.find(e => e.name === 'Push-ups')).toMatchObject({ unit: 'reps', change: 0 })
    expect(all.find(e => e.name === 'Push-ups')!.latest.value).toBe(10)
    expect(all.find(e => e.name === 'Side plank')).toMatchObject({ unit: 's' })
    expect(all.find(e => e.name === 'Side plank')!.latest.set).toBe('45 s')
  })

  it('skips exercises with no completed sets and sorts by most recent', () => {
    const all = exerciseProgress(days)
    expect(all.find(e => e.name === 'Plank')).toBeUndefined()
    expect(all.map(e => e.name)).toEqual(['Hip thrust', 'Side plank', 'Push-ups'])
  })

  it('respects the since date', () => {
    const p = exerciseProgress(days, '2026-10-08').find(e => e.name === 'Hip thrust')!
    expect(p.points).toHaveLength(2)
    expect(p.change).toBe(-2.5)
  })
})
