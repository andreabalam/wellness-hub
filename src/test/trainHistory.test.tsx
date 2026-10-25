/**
 * Train tab History & Progress, editing a saved workout's sets, and the daily
 * Oura history backfill.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('../lib/oura', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/oura')>()),
  isOuraConnected: vi.fn().mockResolvedValue(false),
  fetchOuraReadiness: vi.fn().mockResolvedValue(null),
  fetchOuraWorkouts: vi.fn().mockResolvedValue([]),
  fetchOuraWorkoutsRange: vi.fn().mockResolvedValue({}),
}))

vi.mock('../lib/toast', () => ({ showToast: vi.fn() }))

import * as oura from '../lib/oura'
import { showToast } from '../lib/toast'
import WorkoutsTab from '../components/WorkoutsTab'
import TrainHistory from '../components/WorkoutsTab/TrainHistory'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData, LoggedExercise, WorkoutSession } from '../data/tracker'

const mockOura = vi.mocked(oura)
const FAKE_USER = { id: 'test-user-1' } as User
const ls: Record<string, string> = {}

const session = (id: string, exercises?: LoggedExercise[], extra = {}): WorkoutSession => ({
  id,
  src: 'manual',
  type: 'full-body',
  label: 'Day 1 · Glutes & Hamstrings',
  min: 45,
  ...(exercises && { exercises }),
  ...extra,
})
const day = (...sessions: WorkoutSession[]): DayData => ({
  ...EMPTY_DAY,
  foods: [],
  wkSessions: sessions,
})
const thrust = (kg: number): LoggedExercise => ({
  name: 'Hip thrust',
  sets: [{ reps: 10, kg, done: true }],
})

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
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
  Element.prototype.scrollIntoView = vi.fn()
  vi.mocked(showToast).mockClear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T09:00:00')) // Monday
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('TrainHistory', () => {
  const days: Record<string, DayData> = {
    '2026-10-20': day(session('m1', [thrust(25)])),
    '2026-10-13': day(session('m2', [thrust(20)]), {
      id: 'oura-1',
      src: 'oura',
      type: 'zone2',
      label: 'walking',
      min: 30,
      kcal: 120,
    }),
    '2026-09-29': day(session('m3')),
    '2026-09-22': day(session('m4')),
    '2026-09-15': day(session('m5')),
  }

  it('lists weeks newest first; tapping a day opens it', () => {
    const onOpenDay = vi.fn()
    render(<TrainHistory view="history" days={days} onOpenDay={onOpenDay} />)
    const weeks = screen.getAllByText(/^Week of/)
    expect(weeks[0]).toHaveTextContent('Week of Oct 19 · 1 workout')
    expect(weeks[1]).toHaveTextContent('Week of Oct 12 · 2 workouts')
    expect(screen.getByText(/1 h 15 m · 120 kcal · 1 sets/)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/1 h 15 m/).closest('button')!)
    expect(onOpenDay).toHaveBeenCalledWith('2026-10-13')
    // 5 weeks → 4 shown, then a "more" button
    expect(weeks).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Show 1 more weeks' }))
    expect(screen.getAllByText(/^Week of/)).toHaveLength(5)
  })

  it('progress tab shows each exercise trend', () => {
    render(<TrainHistory view="progress" days={days} onOpenDay={() => {}} />)
    const row = screen.getByText('Hip thrust').closest('.progress-row') as HTMLElement
    expect(row).toHaveTextContent('20 kg → 25 kg')
    expect(row).toHaveTextContent('▲ 5 kg')
    expect(row).toHaveTextContent('2 workouts · best 10 × 25 kg · last Oct 20')
  })

  it('empty states', () => {
    const { rerender } = render(<TrainHistory view="history" days={{}} onOpenDay={() => {}} />)
    expect(screen.getByText('No workouts logged yet.')).toBeInTheDocument()
    rerender(<TrainHistory view="progress" days={{}} onOpenDay={() => {}} />)
    expect(screen.getByText(/progress shows up here/)).toBeInTheDocument()
  })

  it('caps the progress list and expands on demand; flags new and lower', () => {
    const many: Record<string, DayData> = {
      '2026-10-01': day(
        session(
          'a',
          Array.from({ length: 9 }, (_, i) => ({
            name: `Move ${i}`,
            sets: [{ reps: 10, done: true }],
          })),
        ),
      ),
      '2026-10-02': day(session('b', [{ name: 'Move 0', sets: [{ reps: 8, done: true }] }])),
    }
    render(<TrainHistory view="progress" days={many} onOpenDay={() => {}} />)
    expect(screen.getAllByText(/^Move \d$/)).toHaveLength(8)
    expect(screen.getByText('▼ 2 reps')).toBeInTheDocument()
    expect(screen.getAllByText('new').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Show all 9 exercises' }))
    expect(screen.getAllByText(/^Move \d$/)).toHaveLength(9)
  })
})

describe('Train tab: editing and history', () => {
  function seed(days: Record<string, DayData>) {
    ls.whub_tracker_v3 = JSON.stringify(days)
  }

  it('Edit sets re-opens a saved workout and saving replaces its sets', () => {
    seed({ '2026-10-26': day(session('m1', [thrust(20)])) })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit sets' }))
    const logger = screen.getByRole('dialog', { name: 'Log workout' })
    expect(within(logger).getByText(/^Edit · /)).toBeInTheDocument()
    expect(within(logger).queryByLabelText('Elapsed time')).toBeNull()
    fireEvent.change(within(logger).getByLabelText('Set 1 kg'), { target: { value: '22.5' } })
    fireEvent.click(within(logger).getByRole('button', { name: /Save changes · 1\/1/ }))
    const saved = JSON.parse(ls.whub_tracker_v3)['2026-10-26'].wkSessions
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ id: 'm1', min: 45 })
    expect(saved[0].exercises[0].sets[0].kg).toBe(22.5)
    expect(showToast).toHaveBeenCalledWith('Workout updated', 'success')
  })

  it('discarding an edit keeps the saved workout; the Start button never resumes an edit', () => {
    seed({
      '2026-10-26': day(session('m1', [thrust(20)], { planRef: { week: 1, slot: 'Day 1' } })),
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit sets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close logger' }))
    // Day 1's plan card offers a fresh log, not "Resume"
    expect(screen.queryByRole('button', { name: /Resume workout/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit sets' }))
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
    expect(JSON.parse(ls.whub_tracker_v3)['2026-10-26'].wkSessions[0].exercises).toEqual([
      thrust(20),
    ])
  })

  it('tapping a history day opens it in the day card', () => {
    seed({ '2026-10-20': day(session('m1', [thrust(20)])) })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('tab', { name: 'History' }))
    fireEvent.click(screen.getByText(/45 min · 1 sets/).closest('button')!)
    const card = document.getElementById('train-day') as HTMLElement
    expect(within(card).getByText('Logging for')).toBeInTheDocument()
    expect(within(card).getByText('Tue, Oct 20')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Edit sets' })).toBeInTheDocument()
  })

  it('backfills Oura workout history once a day when connected', async () => {
    mockOura.isOuraConnected.mockResolvedValue(true)
    mockOura.fetchOuraWorkoutsRange.mockResolvedValue({
      '2026-10-14': [
        {
          id: 'w1',
          activity: 'walking',
          start_datetime: '2026-10-14T08:00:00',
          end_datetime: '2026-10-14T08:40:00',
          calories: 150,
          distance: null,
          average_heart_rate: null,
          max_heart_rate: null,
        },
      ],
    })
    const { unmount } = render(<WorkoutsTab user={FAKE_USER} />)
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith('Imported Oura workouts for 1 past day', 'info'),
    )
    expect(mockOura.fetchOuraWorkoutsRange).toHaveBeenCalledWith('2026-08-03', '2026-10-25')
    expect(JSON.parse(ls.whub_tracker_v3)['2026-10-14'].wkSessions[0].id).toBe('oura-w1')
    unmount()
    // Within 24 h it doesn't run again
    const calls = mockOura.isOuraConnected.mock.calls.length
    render(<WorkoutsTab user={FAKE_USER} />)
    await waitFor(() => expect(mockOura.isOuraConnected.mock.calls.length).toBeGreaterThan(calls))
    await Promise.resolve()
    expect(mockOura.fetchOuraWorkoutsRange).toHaveBeenCalledTimes(1)
    mockOura.isOuraConnected.mockResolvedValue(false)
  })
})
