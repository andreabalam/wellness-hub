/**
 * WorkoutsTab cycle sync: the plan opens on the week for today's cycle phase,
 * shows the "Today" banner, and "My period started today" re-anchors it.
 * Oura is not connected here (no Supabase), so anchors come from tracker days.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, render, screen, fireEvent, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import WorkoutsTab from '../components/WorkoutsTab'
import { EMPTY_DAY } from '../data/tracker'
import { dkey } from '../lib/dateKey'

const FAKE_USER = { id: 'test-user-1' } as User
const ls: Record<string, string> = {}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dkey(d)
}

function seed({
  cycleType = 'regular',
  periodDaysAgo,
}: {
  cycleType?: string
  periodDaysAgo?: number
}) {
  ls.whub_body_stats_v1 = JSON.stringify({ weightKg: 60, cycleType })
  if (periodDaysAgo != null)
    ls.whub_tracker_v3 = JSON.stringify({
      [daysAgo(periodDaysAgo)]: { ...EMPTY_DAY, foods: [], phase: 'Menstrual' },
    })
}

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
})

describe('WorkoutsTab cycle sync', () => {
  it('early luteal (cycle day 19) opens on Week 3, matching its "days 14-21" label', () => {
    seed({ periodDaysAgo: 18 }) // cycle day 19
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText('cycle day 19')).toBeInTheDocument()
    expect(screen.getByText(/Luteal phase/)).toHaveTextContent('Luteal phase → Week 3')
    expect(screen.getByRole('button', { name: 'Week 3' })).toHaveClass('week-nav__btn--current')
    // Where the estimate comes from sits behind Details
    expect(screen.queryByText(/Counting from the period start you marked/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText(/Counting from the period start you marked/)).toBeInTheDocument()
    expect(document.querySelector('.day-card__today')).toHaveTextContent('Today')
    // The day card leads with the next plan workout from the phase week
    expect(screen.getByText('Week 3 plan · next up')).toBeInTheDocument()
  })

  it('late luteal (cycle day 23) opens on Week 4, the light week', () => {
    seed({ periodDaysAgo: 22 })
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText(/Luteal phase/)).toHaveTextContent('Luteal phase → Week 4')
    expect(screen.getByText('Week 4 plan · next up')).toBeInTheDocument()
  })

  it('a manual week pick overrides the phase week but keeps the current-week dot', () => {
    seed({ periodDaysAgo: 18 })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week 2' }))
    expect(document.querySelector('.day-card__today')).toBeNull()
    expect(screen.getByText('Week 3 plan · next up')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 3' })).toHaveClass('week-nav__btn--current')
  })

  it('setting the phase by hand moves the plan to that week', () => {
    seed({ periodDaysAgo: 18 })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Not right? Change phase' }))
    fireEvent.click(screen.getByRole('button', { name: 'Follicular' }))
    expect(screen.getByRole('button', { name: 'Week 2' })).toHaveClass('week-nav__btn--current')
    expect(JSON.parse(ls.whub_tracker_v3)[daysAgo(0)].phase).toBe('Follicular')
  })

  it('with no period logged, "My period started today" moves the plan to Week 1', () => {
    seed({})
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText(/No period logged yet/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'My period started today' }))
    expect(screen.getByText(/Menstrual phase/)).toHaveTextContent('Menstrual phase → Week 1')
    expect(JSON.parse(ls.whub_tracker_v3)[daysAgo(0)].phase).toBe('Menstrual')
    // Today is now the anchor — the button goes away
    expect(screen.queryByRole('button', { name: 'My period started today' })).toBeNull()
  })

  describe('follows the calendar without manual updates', () => {
    const at = (d: number, h = 8) => new Date(2026, 10, d, h, 0) // Nov 2026, local time
    const periodOn = (date: string) =>
      (ls.whub_tracker_v3 = JSON.stringify({
        [date]: { ...EMPTY_DAY, foods: [], phase: 'Menstrual' },
      }))
    const resume = () => act(() => window.dispatchEvent(new Event('focus')))

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      ls.whub_body_stats_v1 = JSON.stringify({ weightKg: 60, cycleType: 'regular' })
    })
    afterEach(() => vi.useRealTimers())

    it('moves to the next cycle day when the app resumes the next morning', () => {
      vi.setSystemTime(at(17, 21)) // Nov 17, 9 pm
      periodOn('2026-11-01')
      render(<WorkoutsTab user={FAKE_USER} />)
      expect(screen.getByText('cycle day 17')).toBeInTheDocument()

      vi.setSystemTime(at(18)) // app left open overnight
      resume()
      expect(screen.getByText('cycle day 18')).toBeInTheDocument()
      vi.setSystemTime(at(22))
      resume()
      expect(screen.getByText('cycle day 22')).toBeInTheDocument()
    })

    it('hides "My period started today" while a logged period is in progress', () => {
      vi.setSystemTime(at(3))
      periodOn('2026-11-01')
      render(<WorkoutsTab user={FAKE_USER} />)
      fireEvent.click(screen.getByRole('button', { name: 'Details' }))
      expect(screen.queryByRole('button', { name: 'My period started today' })).toBeNull()

      vi.setSystemTime(at(20)) // late in the cycle the period may start: offer it again
      resume()
      fireEvent.click(screen.getByRole('button', { name: 'Details' }))
      expect(screen.getByRole('button', { name: 'My period started today' })).toBeInTheDocument()
    })

    it('a phase corrected by hand carries into the next day', () => {
      vi.setSystemTime(at(10)) // cycle day 10 = Follicular by the count
      periodOn('2026-11-01')
      render(<WorkoutsTab user={FAKE_USER} />)
      fireEvent.click(screen.getByRole('button', { name: 'Details' }))
      fireEvent.click(screen.getByRole('button', { name: 'Not right? Change phase' }))
      fireEvent.click(screen.getByRole('button', { name: 'Luteal' }))

      vi.setSystemTime(at(11))
      resume()
      expect(screen.getByText(/Luteal phase/)).toHaveTextContent('Luteal phase → Week 3')
      expect(screen.getByText('cycle day 18')).toBeInTheDocument()
    })
  })

  it('stays hidden when cycle tracking is off; the rotation still works', () => {
    seed({ cycleType: 'none', periodDaysAgo: 18 })
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.queryByText(/Today · cycle day/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No period logged yet/)).not.toBeInTheDocument()
    expect(screen.getByText('Week 1 plan · next up')).toBeInTheDocument()
  })

  describe('day card on a fixed date', () => {
    afterEach(() => vi.useRealTimers())

    const logged = (date: string, slot: string, week = 4) => ({
      [date]: {
        ...EMPTY_DAY,
        foods: [],
        wkSessions: [
          {
            id: `manual-${date}`,
            src: 'manual',
            type: 'full-body',
            min: 40,
            planRef: { week, slot },
          },
        ],
      },
    })
    const topRow = () => document.querySelector('.train-plan-row') as HTMLElement
    const sunday = () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-25T09:00:00')) // a Sunday
    }

    it('with nothing logged, Day 1 is next whatever the weekday', () => {
      sunday()
      seed({ periodDaysAgo: 22 })
      ls.whub_tracker_v3 = JSON.stringify({}) // no anchor: plain rotation
      render(<WorkoutsTab user={FAKE_USER} />)
      expect(topRow()).toHaveTextContent('Day 1 · Lower A - Glutes & Hamstrings')
      fireEvent.click(within(topRow()).getByRole('button', { name: '▶ Start workout' }))
      expect(screen.getByRole('dialog', { name: 'Log workout' })).toBeInTheDocument()
    })

    it('continues from where you left off, even days later', () => {
      sunday()
      seed({})
      ls.whub_tracker_v3 = JSON.stringify(logged('2026-10-20', 'Day 2'))
      render(<WorkoutsTab user={FAKE_USER} />)
      expect(topRow()).toHaveTextContent('next up')
      expect(topRow()).toHaveTextContent('Day 3 · Lower B - Glutes & Quads')
    })

    it("shows today's logged workout as done, with what comes next", () => {
      sunday()
      seed({})
      ls.whub_tracker_v3 = JSON.stringify({
        ...logged('2026-10-20', 'Day 2'),
        ...logged('2026-10-25', 'Day 3'),
      })
      render(<WorkoutsTab user={FAKE_USER} />)
      expect(topRow()).toHaveTextContent('done today')
      expect(topRow()).toHaveTextContent('Day 3 · Lower B')
      expect(topRow()).toHaveTextContent('Next time: Day 4 · Upper B')
    })

    it('wraps from Day 6 back to Day 1', () => {
      sunday()
      seed({})
      ls.whub_tracker_v3 = JSON.stringify(logged('2026-10-23', 'Day 6'))
      render(<WorkoutsTab user={FAKE_USER} />)
      expect(topRow()).toHaveTextContent('Day 1 · Lower A')
    })

    it('Option B logs Pilates and counts as that plan day', () => {
      sunday()
      seed({})
      ls.whub_tracker_v3 = JSON.stringify(logged('2026-10-22', 'Day 4', 1))
      render(<WorkoutsTab user={FAKE_USER} />)
      expect(topRow()).toHaveTextContent('Day 5 · Full Body - Strength Supersets')
      fireEvent.click(within(topRow()).getByRole('button', { name: 'Start option B' }))
      const logger = screen.getByRole('dialog', { name: 'Log workout' })
      expect(within(logger).getByText(/Day 5 · Pilates A/)).toBeInTheDocument()
      const d = JSON.parse(ls.whub_workout_draft_v1)
      expect(d).toMatchObject({ type: 'pilates', planRef: { slot: 'Day 5' } })
    })

    it('back-fills a past day: logs other activity to that date', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-26T09:00:00'))
      seed({})
      render(<WorkoutsTab user={FAKE_USER} />)
      fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
      expect(screen.getByText('Logging for')).toBeInTheDocument()
      expect(screen.getByText(/Log this workout” on a plan day below/)).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: '＋ Other activity' }))
      fireEvent.click(screen.getByRole('button', { name: 'Pilates' }))
      fireEvent.click(screen.getByRole('button', { name: '+ Log activity' }))
      const days = JSON.parse(ls.whub_tracker_v3)
      expect(days['2026-10-25'].wkSessions[0].type).toBe('pilates')
      // Next day returns to today; it can't go past today
      fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
      expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    })
  })
})
