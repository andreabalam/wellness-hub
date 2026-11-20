import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('../components/OuraTab', () => ({ default: () => <div>Oura dashboard</div> }))

import InsightsTab from '../components/InsightsTab'
import { cycleHistory, dayVolumeKg, weeklySummaries, weekWins } from '../lib/insights'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData, FoodEntry, LoggedExercise, WorkoutSession } from '../data/tracker'

const TODAY = new Date('2026-10-28T12:00:00') // Wednesday; week of Oct 26
const food = (k: number, p: number): FoodEntry => ({ n: 'x', k, p, c: 0, f: 0, fi: 0 })
const wk = (min = 40): WorkoutSession => ({ id: `m${min}`, src: 'manual', type: 'full-body', min })
const day = (extra: Partial<DayData> = {}): DayData => ({ ...EMPTY_DAY, foods: [], ...extra })

const DAYS: Record<string, DayData> = {
  // this week
  '2026-10-26': day({ foods: [food(1400, 100)], sleep: 4, energy: 3, wkSessions: [wk()] }),
  '2026-10-27': day({ foods: [food(1600, 120)], sleep: 5, energy: 0, wkSessions: [wk(30)] }),
  '2026-10-28': day({ medSessions: [{ id: 'm', src: 'manual', min: 10, style: 'Guided' }] }),
  // last week
  '2026-10-20': day({ foods: [food(1800, 90)], sleep: 3, energy: 4, wkSessions: [wk()] }),
}

describe('weeklySummaries', () => {
  it('averages over days with data, newest week first', () => {
    const [w0, w1, w2] = weeklySummaries(DAYS, TODAY, 3)
    expect(w0).toMatchObject({
      week: '2026-10-26',
      foodDays: 2,
      kcalAvg: 1500,
      protAvg: 110,
      workouts: 2,
      medMin: 10,
    })
    expect(w1).toMatchObject({ week: '2026-10-19', kcalAvg: 1800, workouts: 1 })
    expect(w2).toMatchObject({ week: '2026-10-12', foodDays: 0, kcalAvg: null })
  })
})

// ── Weight lifted & wins ──
const lift = (name: string, kg: number, reps: number, n = 2, done = true): LoggedExercise => ({
  name,
  sets: Array.from({ length: n }, () => ({ reps, kg, done })),
})
const lifted = (id: string, ...exercises: LoggedExercise[]): WorkoutSession => ({
  id,
  src: 'manual',
  type: 'full-body',
  min: 45,
  exercises,
})
const LIFT_DAYS: Record<string, DayData> = {
  // last week: 2×10×20 = 400 kg
  '2026-10-20': day({ wkSessions: [lifted('a', lift('Hip thrust', 20, 10))] }),
  // this week: 2×10×25 + 2×12×10 = 740 kg; the undone set doesn't count
  '2026-10-26': day({
    foods: [food(1300, 115)],
    wkSessions: [
      lifted(
        'b',
        lift('Hip thrust', 25, 10),
        lift('Single-leg hip thrust', 10, 12),
        lift('Hip thrust', 40, 10, 1, false),
      ),
    ],
  }),
  '2026-10-27': day({ foods: [food(1200, 80)] }),
}

describe('weight lifted', () => {
  it('sums reps × kg over completed sets, per day and per week', () => {
    expect(dayVolumeKg(LIFT_DAYS['2026-10-26'])).toBe(740)
    const [w0, w1, w2] = weeklySummaries(LIFT_DAYS, TODAY, 3)
    expect(w0.volumeKg).toBe(740)
    expect(w1.volumeKg).toBe(400)
    expect(w2.volumeKg).toBeNull()
  })
})

describe('weekWins', () => {
  const repTops = new Map([['single-leg hip thrust', 12]])

  it('lists new bests, workouts with weight lifted, protein days and ready-to-progress', () => {
    const wins = weekWins(LIFT_DAYS, TODAY, { protTarget: 110, repTops })
    expect(wins.map(w => w.kind)).toEqual(['pr', 'workouts', 'protein', 'progress'])
    expect(wins[0]).toMatchObject({ text: 'New best: Hip thrust 10 × 25 kg', sub: 'was 20 kg' })
    expect(wins[1]).toMatchObject({
      text: '1 workout · 740 kg lifted',
      sub: '+85% weight lifted vs last week',
    })
    expect(wins[2].text).toBe('Protein target hit 1 of 2 days')
    expect(wins[3].text).toBe('1 exercise ready to progress')
  })

  it('needs an earlier workout to call something a new best; includes meditation', () => {
    const wins = weekWins(DAYS, TODAY, { protTarget: 0, repTops: new Map() })
    expect(wins.map(w => w.kind)).toEqual(['workouts', 'meditation'])
    expect(wins[0]).toMatchObject({ text: '2 workouts' })
    expect(wins[0].sub).toBeUndefined()
    expect(wins[1].text).toBe('10 min of meditation')
  })

  it('is empty for an empty week', () => {
    expect(weekWins({}, TODAY, { protTarget: 110, repTops })).toEqual([])
  })
})

describe('cycleHistory', () => {
  it('merges Oura tags and marked days, with lengths and an average', () => {
    const tracker: Record<string, DayData> = {
      '2026-08-02': day({ phase: 'Menstrual' }),
      '2026-09-30': day({ phase: 'Menstrual' }), // same period as the Oura tag on Oct 1
    }
    const { periods, avgLength } = cycleHistory(['2026-08-30', '2026-08-31', '2026-10-01'], tracker)
    expect(periods.map(p => [p.start, p.length, p.source])).toEqual([
      ['2026-09-30', null, 'oura-tag'],
      ['2026-08-30', 31, 'oura-tag'],
      ['2026-08-02', 28, 'manual'],
    ])
    expect(avgLength).toBe(30)
  })

  it('keeps the earlier date when a marked day follows an Oura tag, and ranks ties to Oura', () => {
    const tracker: Record<string, DayData> = {
      '2026-09-02': day({ phase: 'Menstrual' }), // 1 day after the Oura tag
      '2026-10-01': day({ phase: 'Menstrual' }), // same day as the Oura tag
    }
    const { periods } = cycleHistory(['2026-09-01', '2026-10-01'], tracker)
    expect(periods.map(p => [p.start, p.source])).toEqual([
      ['2026-10-01', 'oura-tag'],
      ['2026-09-01', 'oura-tag'],
    ])
  })

  it('is empty without any period', () => {
    expect(cycleHistory([], {}).periods).toEqual([])
  })
})

describe('InsightsTab', () => {
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
      clear: () => Object.keys(ls).forEach(k => delete ls[k]),
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(TODAY)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('shows a sign-in gate for guests', () => {
    render(<InsightsTab user={null} />)
    expect(screen.getByText(/Sign in to see/)).toBeInTheDocument()
    expect(screen.queryByText('Oura dashboard')).toBeNull()
  })

  it('shows this week vs last week, 8-week trend lines, cycle history and Oura', () => {
    ls.whub_tracker_v3 = JSON.stringify({
      ...DAYS,
      '2026-09-01': day({ phase: 'Menstrual' }),
      '2026-09-29': day({ phase: 'Menstrual' }),
    })
    ls.whub_body_stats_v1 = JSON.stringify({ cycleType: 'regular' })
    render(<InsightsTab user={{ id: 'u1' } as User} />)

    const row = (label: RegExp) => screen.getByText(label).closest('.trend-row') as HTMLElement
    const delta = (label: RegExp) => row(label).querySelector('.trend-row__delta')!
    expect(row(/^Calories \/ day/)).toHaveTextContent('target 1,')
    expect(row(/^Calories \/ day/)).toHaveTextContent('1,500▼ −300')
    expect(delta(/^Calories \/ day/)).toHaveClass('trend-row__delta--flat')
    expect(delta(/^Protein \/ day/)).toHaveTextContent('▲ +20 g')
    expect(delta(/^Protein \/ day/)).toHaveClass('trend-row__delta--good')
    // Sleep / energy came from the daily check-in, which is gone
    expect(screen.queryByText(/^Sleep/)).toBeNull()
    expect(screen.queryByText(/^Energy/)).toBeNull()
    expect(delta(/^Meditation/)).toHaveTextContent('▲ +10 min')
    // Calories had data in two weeks → a line; the old 8-week table is gone
    expect(row(/^Calories \/ day/).querySelector('svg path')).not.toBeNull()
    expect(screen.queryAllByRole('row')).toHaveLength(0)
    expect(screen.getByText(/food was logged on 2 days this week/)).toBeInTheDocument()

    expect(screen.getByText(/Average cycle/)).toHaveTextContent('Average cycle: 28 days')
    expect(screen.getByText('current cycle')).toBeInTheDocument()
    expect(screen.getByText('Oura dashboard').closest('details')).toHaveClass('insights-oura')
  })

  it("shows this week's wins and the weight-lifted trend", () => {
    ls.whub_tracker_v3 = JSON.stringify(LIFT_DAYS)
    render(<InsightsTab user={{ id: 'u1' } as User} />)
    const items = screen
      .getAllByRole('listitem')
      .filter(li => li.classList.contains('week-wins__item'))
    expect(items[0]).toHaveTextContent('New best: Hip thrust 10 × 25 kgwas 20 kg')
    expect(items[0]).toHaveClass('week-wins__item--pr')
    expect(screen.getByText('1 workout · 740 kg lifted')).toBeInTheDocument()
    const row = screen.getByText(/^Weight lifted/).closest('.trend-row') as HTMLElement
    expect(row).toHaveTextContent('740 kg▲ +340 kg')
  })

  it('says how wins appear when the week is empty', () => {
    render(<InsightsTab user={{ id: 'u1' } as User} />)
    expect(screen.getByText(/Nothing yet this week/)).toBeInTheDocument()
  })

  it('explains how to start the cycle history when no period is logged', () => {
    ls.whub_body_stats_v1 = JSON.stringify({ cycleType: 'irregular' })
    render(<InsightsTab user={{ id: 'u1' } as User} />)
    expect(screen.getByText(/No periods logged yet/)).toBeInTheDocument()
  })

  it('hides cycle history when cycle tracking is off', () => {
    render(<InsightsTab user={{ id: 'u1' } as User} />)
    expect(screen.queryByText('Cycle history')).toBeNull()
    expect(screen.getAllByText('No data yet').length).toBeGreaterThan(0)
  })
})
