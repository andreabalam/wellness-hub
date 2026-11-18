import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useState } from 'react'
import { useFollowToday, useToday } from '../hooks/useToday'
import { dkey } from '../lib/dateKey'

const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m)

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('useToday', () => {
  it('starts at local midnight of today', () => {
    vi.setSystemTime(at(17, 15, 30))
    const { result } = renderHook(() => useToday())
    expect(dkey(result.current)).toBe('2026-11-17')
    expect(result.current.getHours()).toBe(0)
  })

  it('rolls over at midnight while the app stays open', () => {
    vi.setSystemTime(at(17, 23, 59))
    const { result } = renderHook(() => useToday())
    act(() => vi.advanceTimersByTime(2 * 60_000))
    expect(dkey(result.current)).toBe('2026-11-18')
    act(() => vi.advanceTimersByTime(24 * 3_600_000)) // and keeps going
    expect(dkey(result.current)).toBe('2026-11-19')
  })

  it('catches up when the app comes back to the foreground', () => {
    vi.setSystemTime(at(17, 22))
    const { result } = renderHook(() => useToday())
    vi.setSystemTime(at(20, 7)) // suspended for days; timers didn't fire
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(dkey(result.current)).toBe('2026-11-20')
  })

  it('keeps the same Date object within a day (stable for effect deps)', () => {
    vi.setSystemTime(at(17, 9))
    const { result } = renderHook(() => useToday())
    const first = result.current
    vi.setSystemTime(at(17, 18))
    act(() => window.dispatchEvent(new Event('focus')))
    expect(result.current).toBe(first)
  })
})

describe('useFollowToday', () => {
  function useViewed(initial: (today: Date) => Date) {
    const today = useToday()
    const [viewed, setViewed] = useState(() => initial(today))
    useFollowToday(today, viewed, setViewed)
    return viewed
  }

  it('moves a view that was on today to the new today', () => {
    vi.setSystemTime(at(17, 23, 59))
    const { result } = renderHook(() => useViewed(t => t))
    act(() => vi.advanceTimersByTime(2 * 60_000))
    expect(dkey(result.current)).toBe('2026-11-18')
  })

  it('leaves a deliberately chosen past day alone', () => {
    vi.setSystemTime(at(17, 23, 59))
    const { result } = renderHook(() => useViewed(() => at(12, 0)))
    act(() => vi.advanceTimersByTime(2 * 60_000))
    expect(dkey(result.current)).toBe('2026-11-12')
  })
})
