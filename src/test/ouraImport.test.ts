/**
 * Pure logic of the Oura → tracker session import: mapping, merge/dedupe,
 * tombstones, and the fetch policy. Network-touching wrappers are covered by
 * the component tests.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  mapOuraWorkout,
  mapOuraMedSession,
  mergeSessions,
  sessionsChanged,
  dismissOuraSession,
  dismissedIds,
  shouldImport,
  markImported,
  importOuraWorkouts,
  importOuraMeditations,
} from '../lib/ouraImport'
import * as oura from '../lib/oura'
import type { OuraSession, OuraWorkout } from '../lib/oura'
import type { WorkoutSession } from '../data/tracker'

vi.mock('../lib/oura', async importOriginal => {
  const orig = await importOriginal<typeof import('../lib/oura')>()
  return { ...orig, fetchOuraWorkouts: vi.fn(), fetchOuraSessions: vi.fn() }
})
const mockOura = oura as unknown as Record<string, ReturnType<typeof vi.fn>>

const ls: Record<string, string> = {}
beforeEach(() => {
  Object.keys(ls).forEach(k => delete ls[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => ls[k] ?? null,
    setItem: (k: string, v: string) => {
      ls[k] = v
    },
    removeItem: (k: string) => {
      delete ls[k]
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

const WORKOUT: OuraWorkout = {
  id: 'w1',
  activity: 'weight_training',
  start_datetime: '2026-07-01T16:00:00Z',
  end_datetime: '2026-07-01T16:52:00Z',
  calories: 312.6,
  distance: null,
  average_heart_rate: 128.4,
  max_heart_rate: 161,
}

describe('mapOuraWorkout', () => {
  it('maps activity, duration, kcal and HR', () => {
    expect(mapOuraWorkout(WORKOUT)).toEqual({
      id: 'oura-w1',
      src: 'oura',
      type: 'glute-build', // OURA_ACTIVITY_MAP.weight_training
      label: 'weight training',
      min: 52,
      kcal: 313,
      avgHr: 128,
      maxHr: 161,
    })
  })

  it('keeps the raw activity as type when unmapped, omits zero kcal', () => {
    const s = mapOuraWorkout({ ...WORKOUT, activity: 'kayaking', calories: 0 })
    expect(s.type).toBe('kayaking')
    expect(s.kcal).toBeUndefined()
  })

  it('clamps sub-minute workouts to 1 min', () => {
    const s = mapOuraWorkout({ ...WORKOUT, end_datetime: '2026-07-01T16:00:20Z' })
    expect(s.min).toBe(1)
  })
})

describe('mapOuraMedSession', () => {
  const SESSION: OuraSession = {
    id: 'm1',
    day: '2026-07-01',
    type: 'breathing',
    start_datetime: '2026-07-01T08:00:00Z',
    end_datetime: '2026-07-01T08:11:00Z',
    average_heart_rate: 57.8,
    average_hrv: 64.2,
    mood: 'good',
  }

  it('maps type → style, actual minutes and vitals', () => {
    expect(mapOuraMedSession(SESSION)).toEqual({
      id: 'oura-m1',
      src: 'oura',
      min: 11, // actual, not rounded to MED_MINS
      style: 'Breath focus',
      hrv: 64,
      hr: 58,
      mood: 'good',
    })
  })

  it('returns null for naps', () => {
    expect(mapOuraMedSession({ ...SESSION, type: 'nap' })).toBeNull()
  })
})

describe('mergeSessions', () => {
  const oura = (id: string): WorkoutSession => ({ id, src: 'oura', type: 'zone2', min: 30 })
  const manual = (id: string): WorkoutSession => ({ id, src: 'manual', type: 'pilates', min: 45 })

  it('replaces the oura subset and keeps manual entries', () => {
    const existing = [oura('oura-a'), manual('manual-1')]
    const merged = mergeSessions(existing, [oura('oura-a'), oura('oura-b')], [])
    expect(merged.map(s => s.id)).toEqual(['oura-a', 'oura-b', 'manual-1'])
  })

  it('drops oura entries deleted on Oura side', () => {
    const existing = [oura('oura-gone'), manual('manual-1')]
    const merged = mergeSessions(existing, [oura('oura-new')], [])
    expect(merged.map(s => s.id)).toEqual(['oura-new', 'manual-1'])
  })

  it('does not resurrect tombstoned sessions', () => {
    const merged = mergeSessions([], [oura('oura-a'), oura('oura-b')], ['oura-a'])
    expect(merged.map(s => s.id)).toEqual(['oura-b'])
  })
})

describe('sessionsChanged', () => {
  it('detects additions, field changes and no-ops', () => {
    const a: WorkoutSession[] = [{ id: 'x', src: 'oura', type: 'zone2', min: 30 }]
    expect(sessionsChanged(a, a)).toBe(false)
    expect(sessionsChanged(a, [...a, { id: 'y', src: 'manual', type: 'pilates', min: 5 }])).toBe(
      true,
    )
    expect(sessionsChanged(a, [{ ...a[0], min: 31 }])).toBe(true)
  })
})

describe('tombstones', () => {
  it('stores dismissed ids per date without duplicates', () => {
    dismissOuraSession('2026-07-01', 'oura-a')
    dismissOuraSession('2026-07-01', 'oura-a')
    dismissOuraSession('2026-07-01', 'oura-b')
    dismissOuraSession('2026-07-02', 'oura-c')
    expect(dismissedIds('2026-07-01')).toEqual(['oura-a', 'oura-b'])
    expect(dismissedIds('2026-07-02')).toEqual(['oura-c'])
    expect(dismissedIds('2026-07-03')).toEqual([])
  })
})

describe('import fetch policy', () => {
  const NOW = new Date('2026-07-17T12:00:00').getTime()

  it('always imports a never-imported date', () => {
    expect(shouldImport('2026-01-01', 'wk', NOW)).toBe(true)
  })

  it('never re-imports a past date', () => {
    markImported('2026-01-01', 'wk', NOW - 100 * 60 * 1000)
    expect(shouldImport('2026-01-01', 'wk', NOW)).toBe(false)
  })

  it('re-imports today only after the TTL', () => {
    markImported('2026-07-17', 'wk', NOW - 5 * 60 * 1000)
    expect(shouldImport('2026-07-17', 'wk', NOW)).toBe(false)
    markImported('2026-07-17', 'wk', NOW - 31 * 60 * 1000)
    expect(shouldImport('2026-07-17', 'wk', NOW)).toBe(true)
  })

  it('tracks workout and meditation stamps independently', () => {
    markImported('2026-07-17', 'wk', NOW)
    expect(shouldImport('2026-07-17', 'med', NOW)).toBe(true)
  })
})

describe('importOuraWorkouts / importOuraMeditations', () => {
  beforeEach(() => {
    mockOura.fetchOuraWorkouts.mockResolvedValue([])
    mockOura.fetchOuraSessions.mockResolvedValue([])
  })

  it('skips the fetch when the policy says not to (already imported today)', async () => {
    markImported('2026-01-01', 'wk')
    const result = await importOuraWorkouts('2026-01-01', [])
    expect(result).toBeNull()
    expect(mockOura.fetchOuraWorkouts).not.toHaveBeenCalled()
  })

  it('force bypasses the skip policy', async () => {
    markImported('2026-01-01', 'wk')
    mockOura.fetchOuraWorkouts.mockResolvedValue([{ ...WORKOUT }])
    const result = await importOuraWorkouts('2026-01-01', [], true)
    expect(mockOura.fetchOuraWorkouts).toHaveBeenCalled()
    expect(result).toEqual([mapOuraWorkout(WORKOUT)])
  })

  it('returns null when the fetch changes nothing', async () => {
    const existing = [mapOuraWorkout(WORKOUT)]
    mockOura.fetchOuraWorkouts.mockResolvedValue([WORKOUT])
    expect(await importOuraWorkouts('2026-01-01', existing, true)).toBeNull()
  })

  it('meditation import skips per policy and bypasses with force', async () => {
    markImported('2026-01-01', 'med')
    expect(await importOuraMeditations('2026-01-01', [])).toBeNull()
    expect(mockOura.fetchOuraSessions).not.toHaveBeenCalled()

    mockOura.fetchOuraSessions.mockResolvedValue([
      {
        id: 'm1',
        day: '2026-01-01',
        type: 'meditation',
        start_datetime: '2026-01-01T08:00:00Z',
        end_datetime: '2026-01-01T08:13:00Z',
        average_heart_rate: null,
        average_hrv: null,
        mood: null,
      },
    ])
    const result = await importOuraMeditations('2026-01-01', [], true)
    expect(mockOura.fetchOuraSessions).toHaveBeenCalled()
    expect(result?.[0].min).toBe(13)
  })
})
