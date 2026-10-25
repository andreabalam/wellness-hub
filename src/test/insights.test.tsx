import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('../components/OuraTab', () => ({ default: () => <div>Oura dashboard</div> }))

import InsightsTab from '../components/InsightsTab'
import { cycleHistory, weeklySummaries } from '../lib/insights'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData, FoodEntry, WorkoutSession } from '../data/tracker'

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
      sleepAvg: 4.5,
      energyAvg: 3, // the 0 (not rated) is skipped
    })
    expect(w1).toMatchObject({ week: '2026-10-19', kcalAvg: 1800, workouts: 1 })
    expect(w2).toMatchObject({ week: '2026-10-12', foodDays: 0, kcalAvg: null, sleepAvg: null })
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

  it('shows this week vs last week, the 8-week table, cycle history and Oura', () => {
    ls.whub_tracker_v3 = JSON.stringify({
      ...DAYS,
      '2026-09-01': day({ phase: 'Menstrual' }),
      '2026-09-29': day({ phase: 'Menstrual' }),
    })
    ls.whub_body_stats_v1 = JSON.stringify({ cycleType: 'regular' })
    render(<InsightsTab user={{ id: 'u1' } as User} />)

    const tile = (label: RegExp) => screen.getByText(label).closest('.kpi-tile') as HTMLElement
    expect(tile(/^Calories \/ day/)).toHaveTextContent('1,500▼ −300 vs last week')
    expect(within(tile(/^Calories \/ day/)).getByText(/vs last week/)).toHaveClass(
      'kpi-tile__delta--flat',
    )
    expect(within(tile(/^Protein \/ day/)).getByText(/vs last week/)).toHaveTextContent(
      '▲ +20 g vs last week',
    )
    expect(within(tile(/^Protein \/ day/)).getByText(/vs last week/)).toHaveClass(
      'kpi-tile__delta--good',
    )
    expect(within(tile(/^Sleep \(check-in/)).getByText(/vs last week/)).toHaveTextContent('▲ +1.5')
    expect(within(tile(/^Energy \(check-in/)).getByText(/vs last week/)).toHaveClass(
      'kpi-tile__delta--bad',
    )
    expect(tile(/^Meditation/)).toHaveTextContent('▲ +10 min vs last week')

    const rows = screen.getAllByRole('row')
    expect(rows).toHaveLength(9) // header + 8 weeks
    expect(rows[1]).toHaveTextContent('Oct 261,500 (2d)110 g24.53')
    expect(rows[8]).toHaveTextContent('Sep 7——0——')

    expect(screen.getByText(/Average cycle/)).toHaveTextContent('Average cycle: 28 days')
    expect(screen.getByText('current cycle')).toBeInTheDocument()
    expect(screen.getByText('Oura dashboard')).toBeInTheDocument()
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
