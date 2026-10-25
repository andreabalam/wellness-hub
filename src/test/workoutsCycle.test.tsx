/**
 * WorkoutsTab cycle sync: the plan opens on the week for today's cycle phase,
 * shows the "Today" banner, and "My period started today" re-anchors it.
 * Oura is not connected here (no Supabase), so anchors come from tracker days.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import WorkoutsTab from '../components/WorkoutsTab'
import { EMPTY_DAY } from '../data/tracker'
import { dkey } from '../components/TrackerTab/dateKey'

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
  it('opens on Week 4 in the luteal phase and marks today', () => {
    seed({ periodDaysAgo: 18 }) // cycle day 19
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText('cycle day 19')).toBeInTheDocument()
    expect(screen.getByText(/Luteal phase/)).toHaveTextContent('Luteal phase → Week 4')
    expect(screen.getByRole('button', { name: 'Week 4' })).toHaveClass('week-nav__btn--current')
    // Where the estimate comes from sits behind Details
    expect(screen.queryByText(/Counting from the period start you marked/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Details' }))
    expect(screen.getByText(/Counting from the period start you marked/)).toBeInTheDocument()
    expect(document.querySelector('.day-card__today')).toHaveTextContent('Today')
    // The day card leads with today's plan workout from the phase week
    expect(screen.getByText(/^Week 4 plan$|Today.s plan: rest/)).toBeInTheDocument()
  })

  it('a manual week pick overrides the phase week but keeps the current-week dot', () => {
    seed({ periodDaysAgo: 18 })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week 2' }))
    expect(document.querySelector('.day-card__today')).toBeNull()
    expect(screen.getByText(/^Week 4 plan$|Today.s plan: rest/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 4' })).toHaveClass('week-nav__btn--current')
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

  it('stays hidden when cycle tracking is off', () => {
    seed({ cycleType: 'none', periodDaysAgo: 18 })
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.queryByText(/Today · cycle day/)).not.toBeInTheDocument()
    expect(screen.queryByText(/No period logged yet/)).not.toBeInTheDocument()
    expect(document.querySelector('.day-card__today')).toBeNull()
  })

  describe('day card on a fixed date', () => {
    afterEach(() => vi.useRealTimers())

    it('on a Monday, leads with Day 1 and starts it', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-26T09:00:00')) // Monday
      seed({ periodDaysAgo: 18 })
      render(<WorkoutsTab user={FAKE_USER} />)
      const row = screen.getByText('Week 4 plan').closest('.train-plan-row') as HTMLElement
      expect(row).toHaveTextContent(/Day 1 ·/)
      fireEvent.click(within(row).getByRole('button', { name: '▶ Start workout' }))
      expect(screen.getByRole('dialog', { name: 'Log workout' })).toBeInTheDocument()
    })

    it('on a Sunday, shows the rest day without a Start button', () => {
      vi.useFakeTimers({ toFake: ['Date'] })
      vi.setSystemTime(new Date('2026-10-25T09:00:00')) // Sunday
      seed({ periodDaysAgo: 18 })
      render(<WorkoutsTab user={FAKE_USER} />)
      expect(screen.getByText(/Today's plan: rest/)).toBeInTheDocument()
      const day7 = document.getElementById('day-card-today') as HTMLElement
      expect(
        within(day7).queryByRole('button', { name: /Start workout|Log this workout/ }),
      ).toBeNull()
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
