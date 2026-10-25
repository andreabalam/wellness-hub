import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import type { OuraEnhancedTag, OuraReadiness } from '../lib/oura'
import { dkey } from '../components/TrackerTab/dateKey'

const fetchOuraTags = vi.fn<(s: string, e: string) => Promise<OuraEnhancedTag[]>>()
const fetchOuraReadinessRange = vi.fn<(s: string, e: string) => Promise<OuraReadiness[]>>()

vi.mock('../lib/oura', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/oura')>()),
  fetchOuraTags: (s: string, e: string) => fetchOuraTags(s, e),
  fetchOuraReadinessRange: (s: string, e: string) => fetchOuraReadinessRange(s, e),
}))

const { useCyclePhase, CYCLE_CACHE_KEY } = await import('../hooks/useCyclePhase')

const ls: Record<string, string> = {}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dkey(d)
}

const periodTag = (day: string): OuraEnhancedTag => ({
  id: day,
  tag_type_code: 'tag_generic_period',
  start_time: day + 'T08:00:00',
  end_time: null,
  start_day: day,
  end_day: null,
  comment: null,
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
  fetchOuraTags.mockReset()
  fetchOuraReadinessRange.mockReset()
})

describe('useCyclePhase', () => {
  it('does not fetch when Oura is not connected', () => {
    const { result } = renderHook(() => useCyclePhase(new Date(), false))
    expect(fetchOuraTags).not.toHaveBeenCalled()
    expect(result.current.suggestion).toBeNull()
  })

  it('estimates from Oura period tags and caches them', async () => {
    fetchOuraTags.mockResolvedValue([periodTag(daysAgo(3)), periodTag(daysAgo(2))])
    fetchOuraReadinessRange.mockResolvedValue([])
    const { result } = renderHook(() => useCyclePhase(new Date(), true))
    await waitFor(() => expect(result.current.suggestion?.source).toBe('oura-tag'))
    expect(result.current.suggestion).toMatchObject({
      phase: 'Menstrual',
      cycleDay: 4,
      anchorDate: daysAgo(3),
    })
    expect(JSON.parse(ls[CYCLE_CACHE_KEY]).tagDays).toEqual([daysAgo(3), daysAgo(2)])
  })

  it('uses a fresh cache without refetching', () => {
    ls[CYCLE_CACHE_KEY] = JSON.stringify({
      fetchedAt: Date.now(),
      tagDays: [daysAgo(8)],
      temps: [],
      tagScopeMissing: false,
    })
    const { result } = renderHook(() => useCyclePhase(new Date(), true))
    expect(fetchOuraTags).not.toHaveBeenCalled()
    expect(result.current.suggestion?.cycleDay).toBe(9)
  })

  it('flags a missing tag scope but still uses readiness temperatures', async () => {
    fetchOuraTags.mockRejectedValue(new Error('Oura error 403'))
    fetchOuraReadinessRange.mockResolvedValue([
      { day: daysAgo(1), temperature_deviation: 0.2 } as OuraReadiness,
    ])
    const { result } = renderHook(() => useCyclePhase(new Date(), true))
    await waitFor(() => expect(result.current.tagScopeMissing).toBe(true))
    expect(JSON.parse(ls[CYCLE_CACHE_KEY]).temps).toEqual([{ date: daysAgo(1), dev: 0.2 }])
  })

  it('keeps the old cache when both fetches fail', async () => {
    fetchOuraTags.mockRejectedValue(new Error('offline'))
    fetchOuraReadinessRange.mockRejectedValue(new Error('offline'))
    renderHook(() => useCyclePhase(new Date(), true))
    await waitFor(() => expect(fetchOuraReadinessRange).toHaveBeenCalled())
    await Promise.resolve()
    expect(ls[CYCLE_CACHE_KEY]).toBeUndefined()
  })
})
