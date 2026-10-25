/**
 * Set logging in the Workouts tab: logger interactions, draft persistence,
 * finishing into the tracker, plus the Tracker's logged-sets summary and the
 * cycle banner's text variants.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import WorkoutsTab from '../components/WorkoutsTab'
import CycleToday from '../components/WorkoutsTab/CycleToday'
import { WorkoutSessionList } from '../components/TrackerTab/SessionList'
import { dkey } from '../components/TrackerTab/dateKey'
import type { WorkoutSession } from '../data/tracker'

const FAKE_USER = { id: 'test-user-1' } as User
const ls: Record<string, string> = {}
const todayKey = dkey(new Date())

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
})

/** Open the logger on Day 1 (always a weighted strength day in the plan). */
function openDay1() {
  render(<WorkoutsTab user={FAKE_USER} />)
  const day1 = screen.getByText('Day 1').closest('.day-card') as HTMLElement
  fireEvent.click(within(day1).getByRole('button', { name: /Start workout|Log this workout/ }))
  return screen.getByRole('dialog', { name: 'Log workout' })
}

/** First exercise card in the logger that has weighted sets. */
function firstWeighted(logger: HTMLElement): HTMLElement {
  return within(logger).getAllByLabelText('Set 1 kg')[0].closest('.logger-ex') as HTMLElement
}

const draft = () => JSON.parse(ls.whub_workout_draft_v1)

describe('WorkoutLogger', () => {
  it('opens prefilled from the plan and autosaves a draft', () => {
    const logger = openDay1()
    expect(within(logger).getByText(/^Day 1 · /)).toBeInTheDocument()
    expect(draft().exercises.length).toBeGreaterThan(1)
    expect(within(logger).getByRole('button', { name: /Finish workout · 0\// })).toBeInTheDocument()
  })

  it('steppers, typing and ticking update the draft; ticking carries values forward', () => {
    const card = firstWeighted(openDay1())
    const kg1 = within(card).getByLabelText('Set 1 kg')
    fireEvent.change(kg1, { target: { value: '20,5' } }) // comma decimal
    fireEvent.click(within(card).getByRole('button', { name: 'More Set 1 reps' }))
    fireEvent.click(within(card).getByRole('button', { name: 'Less Set 1 kg' }))
    expect(kg1).toHaveValue('20')
    fireEvent.change(kg1, { target: { value: 'abc' } }) // ignored
    fireEvent.click(within(card).getByRole('button', { name: 'Set 1 done' }))
    expect(within(card).getByLabelText('Set 2 kg')).toHaveValue('20')
    const name = (card.querySelector('.logger-ex__name') as HTMLInputElement).value
    const ex = draft().exercises.find((e: { name: string }) => e.name === name)
    expect(ex.sets[0]).toMatchObject({ kg: 20, done: true })
    // Unticking doesn't carry again
    fireEvent.click(within(card).getByRole('button', { name: 'Set 1 done' }))
    expect(within(card).getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    fireEvent.change(kg1, { target: { value: '' } })
    expect(kg1).toHaveValue('')
  })

  it('adds and removes sets and exercises, and renames', () => {
    const logger = openDay1()
    const card = firstWeighted(logger)
    const sets = () => within(card).getAllByRole('button', { name: /^Set \d+ done$/ }).length
    const before = sets()
    fireEvent.click(within(card).getByRole('button', { name: /Add set/ }))
    expect(sets()).toBe(before + 1)
    fireEvent.click(within(card).getByRole('button', { name: 'Remove last set' }))
    expect(sets()).toBe(before)

    const count = () => logger.querySelectorAll('.logger-ex').length
    const n = count()
    fireEvent.click(within(logger).getByRole('button', { name: /Add exercise/ }))
    expect(count()).toBe(n + 1)
    const blank = within(logger).getByLabelText(`Exercise ${n + 1} name`)
    fireEvent.change(blank, { target: { value: 'Calf raise' } })
    expect(draft().exercises[n].name).toBe('Calf raise')
    fireEvent.click(within(logger).getByRole('button', { name: 'Remove Calf raise' }))
    expect(count()).toBe(n)
  })

  it('timed exercises log seconds instead of reps and kg', () => {
    ls.whub_workout_draft_v1 = JSON.stringify({
      date: todayKey,
      startedAt: Date.now(),
      title: 'Day 1 · Test',
      type: 'full-body',
      planRef: { week: 1, slot: 'Day 1' },
      exercises: [{ name: 'Plank', sets: [{ sec: 30, done: false }] }],
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /Resume workout/ }))
    const logger = screen.getByRole('dialog', { name: 'Log workout' })
    fireEvent.click(within(logger).getByRole('button', { name: 'More Set 1 seconds' }))
    expect(within(logger).getByLabelText('Set 1 seconds')).toHaveValue('35')
    expect(within(logger).queryByLabelText('Set 1 kg')).toBeNull()
  })

  it('finishing without ticked sets warns; with sets it saves to the tracker', () => {
    const logger = openDay1()
    fireEvent.click(within(logger).getByRole('button', { name: /Finish workout/ }))
    expect(screen.getByRole('dialog', { name: 'Log workout' })).toBeInTheDocument()

    const card = firstWeighted(logger)
    fireEvent.change(within(card).getByLabelText('Set 1 kg'), { target: { value: '20' } })
    fireEvent.click(within(card).getByRole('button', { name: 'Set 1 done' }))
    fireEvent.click(within(logger).getByRole('button', { name: /Finish workout · 1\// }))

    expect(screen.queryByRole('dialog', { name: 'Log workout' })).toBeNull()
    expect(ls.whub_workout_draft_v1).toBeUndefined()
    const day = JSON.parse(ls.whub_tracker_v3)[todayKey]
    expect(day.wkSessions[0]).toMatchObject({
      src: 'manual',
      planRef: { week: 1, slot: 'Day 1' },
    })
    expect(day.wkSessions[0].exercises[0].sets).toHaveLength(1)
    expect(screen.getByText('✓ Logged · 1 sets')).toBeInTheDocument()
    // …and it shows in the day card's activity list
    expect(screen.getByText(/^1 exercise · 1 sets/)).toBeInTheDocument()
  })

  it('closing keeps the draft for Resume; Escape closes too', () => {
    const logger = openDay1()
    fireEvent.click(within(logger).getByRole('button', { name: 'Close logger' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Resume workout/ }))
    expect(screen.getByRole('dialog', { name: 'Log workout' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(ls.whub_workout_draft_v1).toBeDefined()
  })

  it('starting another day asks before replacing the draft', () => {
    openDay1()
    fireEvent.click(screen.getByRole('button', { name: 'Close logger' }))
    const day2 = screen.getByText('Day 2').closest('.day-card') as HTMLElement
    vi.mocked(window.confirm).mockReturnValueOnce(false)
    fireEvent.click(within(day2).getByRole('button', { name: /Log this workout|Start workout/ }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(draft().planRef.slot).toBe('Day 1')
    fireEvent.click(within(day2).getByRole('button', { name: /Log this workout|Start workout/ }))
    expect(draft().planRef.slot).toBe('Day 2')
  })

  it('discard clears the draft', () => {
    const logger = openDay1()
    fireEvent.click(within(logger).getByRole('button', { name: 'Discard workout' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(ls.whub_workout_draft_v1).toBeUndefined()
  })

  it('shows last time and ticks down the elapsed timer', () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const logger = openDay1()
    const name = (firstWeighted(logger).querySelector('.logger-ex__name') as HTMLInputElement).value
    fireEvent.click(within(logger).getByRole('button', { name: 'Discard workout' }))
    ls.whub_tracker_v3 = JSON.stringify({
      [dkey(yesterday)]: {
        foods: [],
        workout: 'full-body',
        wkNotes: '',
        energy: 0,
        mood: 0,
        sleep: 0,
        stress: 0,
        water: 0,
        phase: '',
        notes: '',
        medMin: 0,
        medStyle: '',
        wkSessions: [
          {
            id: 'manual-1',
            src: 'manual',
            type: 'full-body',
            min: 40,
            exercises: [{ name, sets: [{ reps: 8, kg: 25, done: true }] }],
          },
        ],
      },
    })
    const day1 = screen.getByText('Day 1').closest('.day-card') as HTMLElement
    fireEvent.click(within(day1).getByRole('button', { name: /Start workout|Log this workout/ }))
    const reopened = screen.getByRole('dialog', { name: 'Log workout' })
    expect(within(reopened).getByText('Last time: 1×8 @ 25 kg')).toBeInTheDocument()
    expect(within(reopened).getByLabelText('Elapsed time')).toHaveTextContent('00:00')
    vi.useRealTimers()
  })
})

describe('WorkoutSessionList logged sets', () => {
  it('summarises exercises, sets and volume', () => {
    const s: WorkoutSession = {
      id: 'manual-1',
      src: 'manual',
      type: 'full-body',
      label: 'Day 1 · Glutes & Hamstrings',
      min: 40,
      exercises: [
        { name: 'Hip thrust', sets: [{ reps: 10, kg: 20, done: true }] },
        { name: 'Plank', sets: [{ sec: 30, done: true }] },
      ],
    }
    render(<WorkoutSessionList sessions={[s]} onRemove={() => {}} />)
    expect(screen.getByText('Day 1 · Glutes & Hamstrings')).toBeInTheDocument()
    expect(screen.getByText('2 exercises · 2 sets · 200 kg')).toBeInTheDocument()
    expect(screen.getByText('1×10 @ 20 kg')).toBeInTheDocument()
  })
})

describe('CycleToday text variants', () => {
  const base = {
    week: 4,
    todayKey: '2026-10-25',
    ouraConnected: true,
    tagScopeMissing: false,
    onPeriodStarted: () => {},
    manualPhase: '',
    onPhaseChange: () => {},
  }

  it('Oura tag source with a temperature shift', () => {
    render(
      <CycleToday
        {...base}
        suggestion={{
          phase: 'Luteal',
          source: 'oura-tag',
          cycleDay: 19,
          anchorDate: '2026-10-07',
          tempShift: '2026-10-21',
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText(/logged in Oura on Oct 7/)).toHaveTextContent(
      /Temperature rise on Oct 21/,
    )
  })

  it('estimated start, reconnect prompt, and not-connected hint', () => {
    const { rerender } = render(
      <CycleToday
        {...base}
        tagScopeMissing
        suggestion={{
          phase: 'Menstrual',
          source: 'oura-tag',
          cycleDay: 1,
          anchorDate: '2026-10-25',
          anchorEstimated: true,
        }}
      />,
    )
    // The reconnect prompt needs action, so it shows without opening Details
    expect(screen.getByRole('button', { name: 'reconnect Oura' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText(/is estimated from your average cycle length/)).toBeInTheDocument()
    // Estimated start on today still offers the button
    expect(screen.getByRole('button', { name: 'My period started today' })).toBeInTheDocument()
    rerender(<CycleToday {...base} ouraConnected={false} suggestion={null} />)
    expect(screen.getByText(/connect Oura in Insights/)).toBeInTheDocument()
  })

  it('a phase set by hand overrides the estimate and can be cleared', () => {
    const onPhaseChange = vi.fn()
    const suggestion = {
      phase: 'Luteal' as const,
      source: 'oura-tag' as const,
      cycleDay: 19,
      anchorDate: '2026-10-07',
    }
    const { rerender } = render(
      <CycleToday {...base} suggestion={suggestion} onPhaseChange={onPhaseChange} />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Not right? Change phase' }))
    fireEvent.click(screen.getByRole('button', { name: 'Follicular' }))
    expect(onPhaseChange).toHaveBeenCalledWith('Follicular')

    rerender(
      <CycleToday
        {...base}
        week={2}
        suggestion={suggestion}
        manualPhase="Follicular"
        onPhaseChange={onPhaseChange}
      />,
    )
    expect(screen.getByText(/Follicular phase/)).toHaveTextContent('Follicular phase → Week 2')
    expect(screen.getByText(/You set today’s phase. The estimate says luteal./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Not right? Change phase' }))
    fireEvent.click(screen.getByRole('button', { name: 'Use the estimate' }))
    expect(onPhaseChange).toHaveBeenLastCalledWith('')
  })

  it('with no estimate, offers to set the phase by hand', () => {
    render(<CycleToday {...base} suggestion={null} />)
    expect(screen.getByRole('button', { name: 'Set phase by hand' })).toBeInTheDocument()
  })
})
