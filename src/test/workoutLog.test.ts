import { describe, it, expect } from 'vitest'
import {
  applyEdit,
  attachLoggedWorkout,
  completedExercises,
  draftFromSession,
  draftMinutes,
  fmtSet,
  fmtSets,
  keepLoggedSets,
  lastPerformance,
  loggedSummary,
  newDraft,
  parsePlanDose,
  prefillSets,
} from '../lib/workoutLog'
import type { WorkoutDraft } from '../lib/workoutLog'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData, LoggedExercise, WorkoutSession } from '../data/tracker'
import type { WorkoutDay } from '../data/workouts'
import { isWorkoutDraft, isWorkoutSession } from '../lib/schema'

const dayWith = (sessions: WorkoutSession[]): DayData => ({
  ...EMPTY_DAY,
  foods: [],
  wkSessions: sessions,
})

const logged = (exercises: LoggedExercise[], id = 'manual-1'): WorkoutSession => ({
  id,
  src: 'manual',
  type: 'full-body',
  label: 'Day 1 · Glutes & Hamstrings',
  min: 40,
  exercises,
  planRef: { week: 1, slot: 'Day 1' },
})

const oura = (id: string, label: string): WorkoutSession => ({
  id,
  src: 'oura',
  type: 'glute-build',
  label,
  min: 45,
  kcal: 250,
})

const thrust: LoggedExercise = {
  name: 'Hip thrust',
  sets: [
    { reps: 10, kg: 20, done: true },
    { reps: 10, kg: 20, done: true },
  ],
}

describe('parsePlanDose', () => {
  it.each([
    ['4×8', { sets: 4, reps: 8 }],
    ['4×8-10', { sets: 4, reps: 8 }],
    ['3×10–12', { sets: 3, reps: 10 }],
    ['3x12 per side', { sets: 3, reps: 12 }],
    ['2×8 per side, 2s hold', { sets: 2, reps: 8 }],
    ['3×30-45 sec', { sets: 3, sec: 30 }],
    ['2×max', { sets: 2 }],
    ['4×AMRAP', { sets: 4 }],
    ['45s per side', { sets: 1, sec: 45 }],
    ['1 min per side', { sets: 1, sec: 60 }],
    ['3 rounds, 30s on / 30s off', { sets: 3, sec: 30 }],
    ['8 reps', { sets: 1, reps: 8 }],
    ['5 reps, 3s hold', { sets: 1, reps: 5 }],
    ['10 per side, slow', { sets: 1, reps: 10 }],
    ['100 pumps', { sets: 1, reps: 100 }],
    ['optional', { sets: 1 }],
  ])('%s', (d, expected) => {
    expect(parsePlanDose(d)).toEqual(expected)
  })
})

describe('lastPerformance', () => {
  const days: Record<string, DayData> = {
    '2026-10-01': dayWith([logged([thrust])]),
    '2026-10-08': dayWith([
      logged([{ name: '  hip   THRUST ', sets: [{ reps: 12, kg: 22.5, done: true }] }]),
    ]),
    '2026-10-10': dayWith([logged([{ name: 'Hip thrust', sets: [{ reps: 8, done: false }] }])]),
  }

  it('finds the most recent completed sets by normalised name', () => {
    expect(lastPerformance('Hip thrust', days, '2026-10-20')).toEqual({
      date: '2026-10-08',
      sets: [{ reps: 12, kg: 22.5, done: true }],
    })
  })

  it('only looks before the given date', () => {
    expect(lastPerformance('Hip thrust', days, '2026-10-08')?.date).toBe('2026-10-01')
    expect(lastPerformance('Hip thrust', days, '2026-10-01')).toBeNull()
  })

  it('returns null for blank or unknown names', () => {
    expect(lastPerformance('', days, '2026-10-20')).toBeNull()
    expect(lastPerformance('Deadlift', days, '2026-10-20')).toBeNull()
  })
})

describe('prefillSets', () => {
  it('uses the plan dose when there is no history', () => {
    expect(prefillSets({ t: 'Squat', d: '3×10-12', i: '' }, null)).toEqual([
      { reps: 10, done: false },
      { reps: 10, done: false },
      { reps: 10, done: false },
    ])
    expect(prefillSets({ t: 'Plank', d: '2×30-45 sec', i: '' }, null)).toEqual([
      { sec: 30, done: false },
      { sec: 30, done: false },
    ])
  })

  it('copies last time, padding with the last set up to the plan count', () => {
    const sets = prefillSets({ t: 'Hip thrust', d: '3×10', i: '' }, [
      { reps: 10, kg: 20, done: true },
      { reps: 8, kg: 22.5, done: true },
    ])
    expect(sets).toEqual([
      { reps: 10, kg: 20, sec: undefined, done: false },
      { reps: 8, kg: 22.5, sec: undefined, done: false },
      { reps: 8, kg: 22.5, sec: undefined, done: false },
    ])
  })
})

describe('newDraft / completedExercises / draftMinutes', () => {
  const planDay = {
    slot: 'Day 4',
    type: 'Home',
    label: 'Glutes & Quads',
    time: '45 min',
    color: 'var(--green)',
    solin: '',
    exs: [{ t: 'Goblet squat', d: '3×12', i: '' }],
  } as WorkoutDay

  it('builds a draft from a plan day', () => {
    const d = newDraft(planDay, 2, '2026-10-25', {}, 1000)
    expect(d).toMatchObject({
      date: '2026-10-25',
      startedAt: 1000,
      title: 'Day 4 · Glutes & Quads',
      type: 'full-body',
      planRef: { week: 2, slot: 'Day 4' },
    })
    expect(d.exercises[0].sets).toHaveLength(3)
    expect(isWorkoutDraft(d)).toBe(true)
    expect(isWorkoutDraft({ ...d, exercises: [{ name: 1 }] })).toBe(false)
  })

  it('keeps only ticked sets and named exercises', () => {
    const draft: WorkoutDraft = {
      date: '2026-10-25',
      startedAt: 0,
      title: 't',
      type: 'full-body',
      exercises: [
        {
          name: ' Squat ',
          sets: [
            { reps: 10, done: true },
            { reps: 10, done: false },
          ],
        },
        { name: 'Row', sets: [{ reps: 10, done: false }] },
        { name: '', sets: [{ reps: 10, done: true }] },
      ],
    }
    expect(completedExercises(draft)).toEqual([{ name: 'Squat', sets: [{ reps: 10, done: true }] }])
  })

  it('rounds elapsed minutes, at least 1 and at most 180', () => {
    const d = { startedAt: 0 } as WorkoutDraft
    expect(draftMinutes(d, 10_000)).toBe(1)
    expect(draftMinutes(d, 42 * 60_000)).toBe(42)
    expect(draftMinutes(d, 10 * 3_600_000)).toBe(180)
  })
})

describe('formatting', () => {
  it('fmtSet', () => {
    expect(fmtSet({ reps: 10, kg: 20, done: true })).toBe('10 × 20 kg')
    expect(fmtSet({ reps: 10, done: true })).toBe('10 reps')
    expect(fmtSet({ sec: 45, done: true })).toBe('45 s')
    expect(fmtSet({ reps: 8, kg: 22.5, done: true })).toBe('8 × 22.5 kg')
  })

  it('fmtSets collapses identical sets and lists mixed ones', () => {
    expect(fmtSets(thrust.sets)).toBe('2×10 @ 20 kg')
    expect(fmtSets([{ sec: 30, done: true }])).toBe('1×30 s')
    expect(
      fmtSets([
        { reps: 10, kg: 20, done: true },
        { reps: 8, kg: 22.5, done: true },
      ]),
    ).toBe('10×20, 8×22.5 kg')
    expect(fmtSets([])).toBe('')
  })

  it('loggedSummary counts sets and weighted volume', () => {
    expect(loggedSummary([thrust, { name: 'Plank', sets: [{ sec: 30, done: true }] }])).toEqual({
      exercises: 2,
      sets: 3,
      volumeKg: 400,
    })
  })
})

describe('attachLoggedWorkout', () => {
  it('attaches sets to a matching Oura strength workout', () => {
    const out = attachLoggedWorkout([oura('oura-1', 'weight training')], logged([thrust]))
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'oura-1', kcal: 250, exercises: [thrust] })
    expect(out[0].planRef).toEqual({ week: 1, slot: 'Day 1' })
  })

  it('adds a manual session when Oura has no strength workout', () => {
    const out = attachLoggedWorkout([oura('oura-1', 'walking')], logged([thrust]))
    expect(out.map(s => s.id)).toEqual(['oura-1', 'manual-1'])
  })

  it('does not reuse an Oura workout that already has sets', () => {
    const taken = { ...oura('oura-1', 'weight training'), exercises: [thrust] }
    expect(attachLoggedWorkout([taken], logged([thrust]))).toHaveLength(2)
  })
})

describe('keepLoggedSets', () => {
  it('carries sets across an Oura re-import of the same workout', () => {
    const before = [{ ...oura('oura-1', 'weight training'), exercises: [thrust] }]
    const reimported = [{ ...oura('oura-1', 'weight training'), kcal: 260 }]
    const out = keepLoggedSets(before, reimported)
    expect(out[0]).toMatchObject({ kcal: 260, exercises: [thrust] })
  })

  it('moves a logged manual workout onto a newly imported Oura strength workout', () => {
    const before = [logged([thrust])]
    const merged = [oura('oura-2', 'strength training'), logged([thrust])]
    const out = keepLoggedSets(before, merged)
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'oura-2', exercises: [thrust] })
  })

  it('leaves the manual workout when the Oura one is not strength', () => {
    const merged = [oura('oura-3', 'walking'), logged([thrust])]
    expect(keepLoggedSets([], merged)).toHaveLength(2)
  })
})

describe('schema', () => {
  it('accepts sessions with logged sets and rejects malformed ones', () => {
    expect(isWorkoutSession(logged([thrust]))).toBe(true)
    expect(isWorkoutSession({ ...logged([thrust]), exercises: [{ name: 'x', sets: [{}] }] })).toBe(
      false,
    )
    expect(isWorkoutSession({ ...logged([thrust]), planRef: { week: '1' } })).toBe(false)
  })
})

describe('editing a saved workout', () => {
  it('draftFromSession copies the sets and marks the draft as an edit', () => {
    const s = logged([thrust])
    const d = draftFromSession(s, 'Day 1 · Glutes', '2026-10-20', 5)
    expect(d).toMatchObject({
      date: '2026-10-20',
      startedAt: 5,
      title: 'Day 1 · Glutes',
      planRef: { week: 1, slot: 'Day 1' },
      editing: { sessionId: 'manual-1' },
    })
    d.exercises[0].sets[0].kg = 99
    expect(thrust.sets[0].kg).toBe(20) // deep copy
    expect(isWorkoutDraft(d)).toBe(true)
  })

  it('applyEdit replaces only that session’s sets', () => {
    const other = oura('oura-1', 'walking')
    const out = applyEdit([other, logged([thrust])], 'manual-1', [])
    expect(out[0]).toBe(other)
    expect(out[1]).toMatchObject({ id: 'manual-1', min: 40, exercises: [] })
  })
})
