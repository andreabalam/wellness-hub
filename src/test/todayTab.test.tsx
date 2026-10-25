/**
 * Today (home) tab pieces: the schedule timeline, the food card, status chips
 * and the shared macro targets.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('../lib/oura', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/oura')>()),
  isOuraConnected: vi.fn().mockResolvedValue(false),
  fetchOuraReadiness: vi.fn().mockResolvedValue(null),
}))

import * as oura from '../lib/oura'
import TodayTab from '../components/TodayTab'
import DayTimeline, { currentBlockIndex, dayKeyOf } from '../components/TodayTab/DayTimeline'
import FoodCard from '../components/TodayTab/FoodCard'
import { macroTargets } from '../hooks/macroTargets'
import { EMPTY_DAY } from '../data/tracker'
import type { CustomBlock } from '../data/schedule'

const FAKE_USER = { id: 'u1' } as User
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
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const block = (id: string, time: string, title: string): CustomBlock => ({
  id,
  time,
  title,
  dur: '30 min',
  color: 'green',
  whyTxt: '',
  desc: '',
  phase: '',
})

describe('DayTimeline', () => {
  const blocks = [
    block('a', '08:00', 'Wake'),
    block('b', '09:00', 'Deep work'),
    block('c', '12:30', 'Lunch'),
    block('d', '16:00', 'Workout'),
    block('e', '18:00', 'Dinner'),
    block('f', '21:00', 'Wind-down'),
  ]

  it('currentBlockIndex is the last block that has started', () => {
    expect(currentBlockIndex(blocks, 7 * 60)).toBe(-1)
    expect(currentBlockIndex(blocks, 8 * 60)).toBe(0)
    expect(currentBlockIndex(blocks, 13 * 60)).toBe(2)
    expect(currentBlockIndex(blocks, 23 * 60)).toBe(5)
  })

  it('dayKeyOf maps dates to schedule day keys', () => {
    expect(dayKeyOf(new Date('2026-10-25T12:00:00'))).toBe('sun')
    expect(dayKeyOf(new Date('2026-10-26T12:00:00'))).toBe('mon')
  })

  it('on today starts at the block in progress; expands to the full day', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T13:00:00')) // Monday 1 PM
    const week = Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, blocks]),
    )
    ls.whub_schedule_v2 = JSON.stringify(week)
    const onOpenSchedule = vi.fn()
    render(<DayTimeline date={new Date()} isToday onOpenSchedule={onOpenSchedule} />)
    const rows = screen.getAllByRole('listitem')
    expect(rows).toHaveLength(4)
    expect(rows[0]).toHaveTextContent('12:30 PMLunch · 30 minNow')
    expect(screen.queryByText('Wake')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show full day (6)' }))
    expect(screen.getAllByRole('listitem')).toHaveLength(6)
    expect(screen.getByText('Now')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Show less' }))
    fireEvent.click(screen.getByRole('button', { name: 'Open schedule →' }))
    expect(onOpenSchedule).toHaveBeenCalled()
  })

  it('on another day starts at the top with no Now marker; empty days say so', () => {
    const week = Object.fromEntries(
      ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map(d => [d, d === 'sun' ? [] : blocks]),
    )
    ls.whub_schedule_v2 = JSON.stringify(week)
    const { rerender } = render(
      <DayTimeline
        date={new Date('2026-10-26T12:00:00')}
        isToday={false}
        onOpenSchedule={() => {}}
      />,
    )
    expect(screen.getAllByRole('listitem')[0]).toHaveTextContent('Wake')
    expect(screen.queryByText('Now')).toBeNull()
    expect(screen.getByText('Schedule')).toBeInTheDocument()
    rerender(
      <DayTimeline
        date={new Date('2026-10-25T12:00:00')}
        isToday={false}
        onOpenSchedule={() => {}}
      />,
    )
    expect(screen.getByText('No schedule for this day yet.')).toBeInTheDocument()
  })
})

describe('macroTargets', () => {
  it('uses body stats with the macro split, else the legacy settings', () => {
    expect(macroTargets().kcal).toBeGreaterThan(0)
    ls.whub_body_stats_v1 = JSON.stringify({ kcalTarget: 1600, macroSplit: 'balanced' })
    expect(macroTargets()).toMatchObject({ kcal: 1600, prot: 120 })
    ls.whub_body_stats_v1 = JSON.stringify({ weightKg: 60 }) // partial — no NaN
    expect(Number.isNaN(macroTargets().prot)).toBe(false)
  })
})

describe('FoodCard', () => {
  it('sums calories and protein and links to Food', () => {
    const onOpenFood = vi.fn()
    render(
      <FoodCard
        day={{
          ...EMPTY_DAY,
          foods: [
            { n: 'Oats', k: 410, p: 22, c: 55, f: 9, fi: 8 },
            { n: 'Salad', k: 520, p: 46, c: 20, f: 24, fi: 6 },
          ],
        }}
        onOpenFood={onOpenFood}
      />,
    )
    expect(screen.getByText('Food · 2 items')).toBeInTheDocument()
    expect(screen.getByText(/^930/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '+ Add food' }))
    expect(onOpenFood).toHaveBeenCalled()
  })
})

describe('TodayTab status chips', () => {
  it('shows readiness, the cycle phase and the weeks streak', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T09:00:00'))
    ls.whub_body_stats_v1 = JSON.stringify({ cycleType: 'regular' })
    ls.whub_oura_readiness_v1 = JSON.stringify({
      '2026-10-26': { day: '2026-10-26', score: 82, contributors: {}, temperature_deviation: 0 },
    })
    const day = { ...EMPTY_DAY, foods: [] }
    ls.whub_tracker_v3 = JSON.stringify({
      '2026-10-08': { ...day, phase: 'Menstrual' },
      '2026-10-20': {
        ...day,
        wkSessions: [{ id: 'm', src: 'manual', type: 'full-body', min: 40 }],
      },
    })
    render(
      <TodayTab
        user={FAKE_USER}
        date={new Date('2026-10-26T00:00:00')}
        onDateChange={() => {}}
        onOpenFood={() => {}}
        onOpenTrain={() => {}}
      />,
    )
    expect(screen.getByText('82').closest('.today-chip')).toHaveTextContent('82 Readiness')
    expect(screen.getByText('Luteal').closest('.today-chip')).toHaveTextContent('Luteal · day 19')
    expect(screen.getByText(/week streak/).closest('.today-chip')).toHaveTextContent(
      '1 week streak',
    )
  })

  it('saves day notes for the viewed day', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-28T09:00:00')) // Wednesday
    render(
      <TodayTab
        user={FAKE_USER}
        date={new Date('2026-10-28T00:00:00')}
        onDateChange={() => {}}
        onOpenFood={() => {}}
        onOpenTrain={() => {}}
      />,
    )
    fireEvent.change(screen.getByPlaceholderText(/Cravings, how the workout felt/), {
      target: { value: 'Good day' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save notes' }))
    const days = JSON.parse(ls.whub_tracker_v3)
    expect(days['2026-10-28'].notes).toBe('Good day')
  })

  it('fetches and caches readiness for the day when Oura is connected', async () => {
    vi.mocked(oura.isOuraConnected).mockResolvedValueOnce(true)
    vi.mocked(oura.fetchOuraReadiness).mockResolvedValueOnce({
      day: '2026-10-26',
      score: 64,
      contributors: {} as never,
      temperature_deviation: 0,
    })
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-26T09:00:00'))
    render(
      <TodayTab
        user={FAKE_USER}
        date={new Date('2026-10-26T00:00:00')}
        onDateChange={() => {}}
        onOpenFood={() => {}}
        onOpenTrain={() => {}}
      />,
    )
    expect(await screen.findByText('64')).toBeInTheDocument()
    expect(JSON.parse(ls.whub_oura_readiness_v1)['2026-10-26'].score).toBe(64)
  })
})
