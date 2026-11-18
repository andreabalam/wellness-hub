import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  addDays,
  addDaysToKey,
  daysBetweenKeys,
  dkey,
  fromKey,
  mondayOf,
  todayKey,
} from '../lib/dateKey'

// The suite runs with TZ=America/Los_Angeles (see vite.config.ts), where UTC
// is already "tomorrow" from 4 pm PST — exactly the window the old
// toISOString()-based key got wrong.

afterEach(() => vi.useRealTimers())

describe('dateKey', () => {
  it.runIf(Intl.DateTimeFormat().resolvedOptions().timeZone === 'America/Los_Angeles')(
    'default test zone is west of UTC (guards the vite.config TZ pin)',
    () => {
      expect(new Date('2026-11-17T12:00:00Z').getTimezoneOffset()).toBeGreaterThan(0)
    },
  )

  it.each([
    [0, 0],
    [7, 30],
    [17, 30], // evening — UTC is already tomorrow in the Americas
    [23, 59],
  ])('keys local %i:%i to the local day in any timezone', (h, m) => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 10, 17, h, m))
    expect(todayKey()).toBe('2026-11-17')
    expect(dkey(new Date())).toBe('2026-11-17')
  })

  it('keys local midnight to that same day', () => {
    expect(dkey(new Date(2026, 10, 17, 0, 0, 0))).toBe('2026-11-17')
    expect(dkey(new Date(2026, 10, 17, 23, 59, 59))).toBe('2026-11-17')
  })

  it('round-trips through fromKey', () => {
    expect(dkey(fromKey('2026-03-08'))).toBe('2026-03-08') // US DST start
    expect(fromKey('2026-11-17').getHours()).toBe(12)
  })

  it('adds days across DST and month/year boundaries', () => {
    expect(addDaysToKey('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDaysToKey('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDaysToKey('2026-11-01', -1)).toBe('2026-10-31')
    expect(addDaysToKey('2026-12-31', 1)).toBe('2027-01-01')
    expect(dkey(addDays(new Date(2026, 2, 8, 0, 30), 1))).toBe('2026-03-09')
  })

  it('finds the local Monday', () => {
    expect(dkey(mondayOf(new Date(2026, 10, 22, 20, 0)))).toBe('2026-11-16') // Sun eve
    expect(dkey(mondayOf(new Date(2026, 10, 16, 0, 0)))).toBe('2026-11-16') // Mon 00:00
    expect(mondayOf(new Date(2026, 10, 18)).getHours()).toBe(0)
  })

  it('counts days between keys across DST', () => {
    expect(daysBetweenKeys('2026-03-01', '2026-03-15')).toBe(14)
    expect(daysBetweenKeys('2026-11-15', '2026-10-25')).toBe(-21)
  })
})
