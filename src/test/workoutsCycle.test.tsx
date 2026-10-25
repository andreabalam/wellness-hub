/**
 * WorkoutsTab cycle sync: the plan opens on the week for today's cycle phase,
 * shows the "Today" banner, and "My period started today" re-anchors it.
 * Oura is not connected here (no Supabase), so anchors come from tracker days.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    expect(screen.getByText('Today · cycle day 19')).toBeInTheDocument()
    expect(screen.getByText(/Luteal phase/)).toHaveTextContent('Luteal phase → Week 4')
    expect(screen.getByRole('button', { name: 'Week 4' })).toHaveClass('week-nav__btn--current')
    expect(screen.getByText(/Counting from the period start you marked/)).toBeInTheDocument()
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Today's workout/ })).toBeInTheDocument()
  })

  it('a manual week pick overrides the phase week but keeps the current-week dot', () => {
    seed({ periodDaysAgo: 18 })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week 2' }))
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Today's workout/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 4' })).toHaveClass('week-nav__btn--current')
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
    expect(screen.queryByText('Today')).not.toBeInTheDocument()
  })
})
