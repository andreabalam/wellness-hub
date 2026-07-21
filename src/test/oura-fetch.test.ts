/**
 * Tests for oura.ts fetch functions — these require a mocked Supabase client
 * with a valid session so the proxyFetch path is exercised.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock supabase before importing oura functions so the module picks up the mock
vi.mock('../lib/supabase', () => {
  const mockGetSession = vi.fn()
  const mockGetUser = vi.fn()
  const mockUpsert = vi.fn()
  const mockMaybeSingle = vi.fn()
  const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }))
  const mockFrom = vi.fn(() => ({ select: mockSelect, upsert: mockUpsert }))

  return {
    supabase: {
      auth: { getSession: mockGetSession, getUser: mockGetUser },
      from: mockFrom,
    },
  }
})

import { supabase } from '../lib/supabase'
import {
  fetchOuraWorkouts,
  fetchOuraReadiness,
  fetchOuraSleep,
  fetchOuraSessions,
  fetchOuraSpo2,
  fetchOuraStress,
  fetchOuraResilience,
  fetchOuraWorkoutRoute,
  fetchOuraPersonalInfo,
  fetchOuraSleepSession,
  fetchOuraCardiovascularAge,
  fetchOuraTdeeAvg,
  isOuraConnected,
  exchangePendingCode,
  disconnectOura,
  fetchOuraDailyActivity,
  fetchOuraTags,
  isPeriodTag,
} from '../lib/oura'

const mockGetSession = vi.mocked((supabase as NonNullable<typeof supabase>).auth.getSession)

const FAKE_SESSION = { access_token: 'fake-token' }

// ── helpers ───────────────────────────────────────────────────────

/** Make fetch() return a JSON response */
function mockFetch(data: unknown, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      json: vi.fn().mockResolvedValue(data),
      statusText: ok ? 'OK' : 'Internal Server Error',
      status: ok ? 200 : 500,
    }),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  // Default: no session (proxyFetch throws 'Not signed in')
  mockGetSession.mockResolvedValue({ data: { session: null } } as never)
})

// ── proxyFetch — no session guard ────────────────────────────────

describe('fetchOuraWorkouts', () => {
  it('throws "Not signed in" when no session exists', async () => {
    await expect(fetchOuraWorkouts('2026-01-01')).rejects.toThrow('Not signed in')
  })

  it('returns workout array on successful fetch', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const workout = {
      id: 'w1',
      activity: 'yoga',
      start_datetime: '2026-01-01T09:00:00Z',
      end_datetime: '2026-01-01T10:00:00Z',
      calories: 200,
      distance: null,
      average_heart_rate: 80,
      max_heart_rate: 120,
    }
    mockFetch({ data: [workout] })
    const result = await fetchOuraWorkouts('2026-01-01')
    expect(result).toHaveLength(1)
    expect(result[0].activity).toBe('yoga')
  })

  it('throws on non-ok HTTP response with error field', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ error: 'Oura error' }, false)
    await expect(fetchOuraWorkouts('2026-01-01')).rejects.toThrow('Oura error')
  })

  it('throws with detail field when Oura returns detail instead of error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ detail: 'Token is invalid or expired.' }, false)
    await expect(fetchOuraWorkouts('2026-01-01')).rejects.toThrow('Token is invalid or expired.')
  })

  it('throws with message field when body has message but no error or detail', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ message: 'Rate limit exceeded' }, false)
    await expect(fetchOuraWorkouts('2026-01-01')).rejects.toThrow('Rate limit exceeded')
  })

  it('throws with fallback when error body has no known field', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({}, false)
    await expect(fetchOuraWorkouts('2026-01-01')).rejects.toThrow('Oura error 500')
  })
})

describe('fetchOuraReadiness', () => {
  it('throws "Not signed in" when no session', async () => {
    await expect(fetchOuraReadiness('2026-01-01')).rejects.toThrow('Not signed in')
  })

  it('returns readiness data for the matching day', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const readiness = {
      day: '2026-01-01',
      score: 78,
      hrv_balance_score: 80,
      recovery_index_score: 75,
      temperature_deviation: null,
    }
    mockFetch({ data: [readiness] })
    const result = await fetchOuraReadiness('2026-01-01')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(78)
  })

  it('returns null when no matching day in response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const readiness = {
      day: '2026-01-02',
      score: 78,
      hrv_balance_score: 80,
      recovery_index_score: 75,
      temperature_deviation: null,
    }
    mockFetch({ data: [readiness] })
    const result = await fetchOuraReadiness('2026-01-01')
    expect(result).toBeNull()
  })

  it('returns null for empty data array', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    const result = await fetchOuraReadiness('2026-01-01')
    expect(result).toBeNull()
  })
})

describe('fetchOuraSleep', () => {
  it('throws "Not signed in" when no session', async () => {
    await expect(fetchOuraSleep('2026-01-01')).rejects.toThrow('Not signed in')
  })

  it('returns sleep data for the matching day', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const sleep = {
      day: '2026-01-01',
      score: 82,
      total_sleep_duration: 28800,
      deep_sleep_duration: 7200,
      rem_sleep_duration: 5400,
      efficiency: 91,
      average_hrv: 45,
    }
    mockFetch({ data: [sleep] })
    const result = await fetchOuraSleep('2026-01-01')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(82)
  })

  it('returns null when day not in response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    const result = await fetchOuraSleep('2026-01-01')
    expect(result).toBeNull()
  })
})

describe('fetchOuraSessions', () => {
  it('throws "Not signed in" when no session', async () => {
    await expect(fetchOuraSessions('2026-01-01')).rejects.toThrow('Not signed in')
  })

  it('returns session array on successful fetch', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const session = {
      id: 's1',
      type: 'meditation',
      start_datetime: '2026-01-01T08:00:00Z',
      end_datetime: '2026-01-01T08:13:00Z',
      average_heart_rate: null,
      average_hrv: null,
      mood: 'good',
    }
    mockFetch({ data: [session] })
    const result = await fetchOuraSessions('2026-01-01')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('meditation')
  })
})

describe('isOuraConnected (mocked supabase)', () => {
  it('returns false when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    expect(await isOuraConnected()).toBe(false)
  })

  it('returns true when exchange endpoint reports connected', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ connected: true }),
      }),
    )
    expect(await isOuraConnected()).toBe(true)
  })

  it('returns false when exchange endpoint reports not connected', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ connected: false }),
      }),
    )
    expect(await isOuraConnected()).toBe(false)
  })

  it('returns false when fetch fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await isOuraConnected()).toBe(false)
  })
})

describe('exchangePendingCode (mocked supabase)', () => {
  it('throws "No pending Oura auth code" when sessionStorage is empty', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    await expect(exchangePendingCode()).rejects.toThrow('No pending Oura auth code')
  })

  it('calls oura-exchange with code and redirect_uri from sessionStorage', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    sessionStorage.setItem('oura_oauth_pending_code', 'test-code')
    sessionStorage.setItem('oura_oauth_pending_uri', 'https://example.com/wellness-hub/')
    const mockFetchFn = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal('fetch', mockFetchFn)
    await exchangePendingCode()
    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.stringContaining('oura-exchange'),
      expect.objectContaining({ method: 'POST' }),
    )
    expect(sessionStorage.getItem('oura_oauth_pending_code')).toBeNull()
  })

  it('throws when the exchange endpoint returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    sessionStorage.setItem('oura_oauth_pending_code', 'bad-code')
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ error: 'invalid_grant' }),
      }),
    )
    await expect(exchangePendingCode()).rejects.toThrow('invalid_grant')
  })
})

describe('disconnectOura (mocked supabase)', () => {
  it('resolves without error when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } } as never)
    await expect(disconnectOura()).resolves.toBeUndefined()
  })

  it('sends DELETE to oura-exchange when session exists', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const mockFetchFn = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', mockFetchFn)
    await disconnectOura()
    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.stringContaining('oura-exchange'),
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

// ── fetchOuraSleepSession ─────────────────────────────────────────

describe('fetchOuraSleepSession', () => {
  it('prefers the main night session (period 0)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({
      data: [
        { day: '2024-01-01', period: 1, total_sleep_duration: 1800 },
        { day: '2024-01-01', period: 0, total_sleep_duration: 27000 },
      ],
    })
    const result = await fetchOuraSleepSession('2024-01-01')
    expect(result!.period).toBe(0)
  })

  it('falls back to the first session for the day when no period 0', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [{ day: '2024-01-01', period: 2, total_sleep_duration: 3600 }] })
    const result = await fetchOuraSleepSession('2024-01-01')
    expect(result!.period).toBe(2)
  })

  it('returns null when nothing matches the day', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [{ day: '2024-01-02', period: 0 }] })
    expect(await fetchOuraSleepSession('2024-01-01')).toBeNull()
  })
})

// ── fetchOuraCardiovascularAge ────────────────────────────────────

describe('fetchOuraCardiovascularAge', () => {
  it('returns the matching day record', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [{ day: '2024-01-01', vascular_age: 31 }] })
    expect((await fetchOuraCardiovascularAge('2024-01-01'))!.vascular_age).toBe(31)
  })

  it('returns null when the day is missing', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    expect(await fetchOuraCardiovascularAge('2024-01-01')).toBeNull()
  })
})

// ── fetchOuraSpo2 ────────────────────────────────────────────────

describe('fetchOuraSpo2', () => {
  it('returns null when no SpO2 data for the date', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    expect(await fetchOuraSpo2('2024-01-01')).toBeNull()
  })

  it('returns SpO2 record matching the requested date', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const item = { day: '2024-01-01', spo2_percentage: { average: 96.5 } }
    mockFetch({ data: [item, { day: '2024-01-02', spo2_percentage: { average: 95 } }] })
    expect(await fetchOuraSpo2('2024-01-01')).toEqual(item)
  })

  it('throws when no session', async () => {
    await expect(fetchOuraSpo2('2024-01-01')).rejects.toThrow()
  })
})

// ── fetchOuraStress ───────────────────────────────────────────────

describe('fetchOuraStress', () => {
  it('returns null when no stress data for the date', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    expect(await fetchOuraStress('2024-01-01')).toBeNull()
  })

  it('returns stress record matching the requested date', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const item = {
      day: '2024-01-01',
      stress_high: 3600,
      recovery_high: 7200,
      day_summary: 'normal',
    }
    mockFetch({ data: [item] })
    expect(await fetchOuraStress('2024-01-01')).toEqual(item)
  })
})

// ── fetchOuraResilience ───────────────────────────────────────────

describe('fetchOuraResilience', () => {
  it('returns null when no resilience data for the date', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    expect(await fetchOuraResilience('2024-01-01')).toBeNull()
  })

  it('returns resilience record matching the requested date', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const item = {
      day: '2024-01-01',
      level: 'strong',
      contributors: { sleep_recovery: 85, daytime_recovery: 72, stress_impact: 68 },
    }
    mockFetch({ data: [item] })
    expect(await fetchOuraResilience('2024-01-01')).toEqual(item)
  })
})

// ── fetchOuraTags / isPeriodTag ───────────────────────────────────

describe('fetchOuraTags', () => {
  it('returns the enhanced_tag rows for the range', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const tag = {
      id: 't1',
      tag_type_code: 'period',
      start_time: '2026-06-01T08:00:00Z',
      end_time: null,
      start_day: '2026-06-01',
      end_day: null,
      comment: null,
    }
    mockFetch({ data: [tag] })
    expect(await fetchOuraTags('2026-06-01', '2026-06-30')).toEqual([tag])
  })

  it('propagates the "Not signed in" error with no session', async () => {
    await expect(fetchOuraTags('2026-06-01', '2026-06-30')).rejects.toThrow('Not signed in')
  })
})

describe('isPeriodTag', () => {
  const tag = (code: string | null) => ({
    id: 'x',
    tag_type_code: code,
    start_time: '',
    end_time: null,
    start_day: '2026-06-01',
    end_day: null,
    comment: null,
  })

  it('matches period/menstrual codes case-insensitively', () => {
    expect(isPeriodTag(tag('period'))).toBe(true)
    expect(isPeriodTag(tag('menstruation'))).toBe(true)
    expect(isPeriodTag(tag('PERIOD_HEAVY'))).toBe(true)
  })

  it('rejects unrelated or null codes', () => {
    expect(isPeriodTag(tag('mood'))).toBe(false)
    expect(isPeriodTag(tag(null))).toBe(false)
    expect(isPeriodTag(tag('custom'))).toBe(false)
  })
})

// ── fetchOuraWorkoutRoute ─────────────────────────────────────────

describe('fetchOuraWorkoutRoute', () => {
  it('returns null when route returns 404', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, json: vi.fn() }))
    expect(await fetchOuraWorkoutRoute('workout-id')).toBeNull()
  })

  it('returns route data when found', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const route = {
      id: 'w1',
      start_datetime: '2024-01-01T08:00:00',
      end_datetime: '2024-01-01T09:00:00',
      source: 'oura',
      polyline: 'encoded_polyline',
    }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(route),
      }),
    )
    expect(await fetchOuraWorkoutRoute('w1')).toEqual(route)
  })

  it('returns null when fetch throws (network error)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    expect(await fetchOuraWorkoutRoute('w1')).toBeNull()
  })
})

// ── fetchOuraPersonalInfo ─────────────────────────────────────────

describe('fetchOuraPersonalInfo', () => {
  it('returns null when no session', async () => {
    expect(await fetchOuraPersonalInfo()).toBeNull()
  })

  it('returns personal info when fetch succeeds', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const info = { age: 30, weight: 65, height: 1.68, biological_sex: 'female' }
    mockFetch(info)
    expect(await fetchOuraPersonalInfo()).toEqual(info)
  })

  it('returns null when the proxy returns an error', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ error: 'No Oura account connected' }, false)
    expect(await fetchOuraPersonalInfo()).toBeNull()
  })
})

// ── fetchOuraTdeeAvg ──────────────────────────────────────────────

describe('fetchOuraTdeeAvg', () => {
  it('returns null when no activity data', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    expect(await fetchOuraTdeeAvg(7)).toBeNull()
  })

  it('returns rounded average of total_calories across valid days', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({
      data: [
        { day: '2024-01-01', total_calories: 2200 },
        { day: '2024-01-02', total_calories: 2400 },
        { day: '2024-01-03', total_calories: 2000 },
      ],
    })
    // (2200 + 2400 + 2000) / 3 = 2200
    expect(await fetchOuraTdeeAvg(3)).toBe(2200)
  })

  it('skips ring-off days (total_calories <= 500)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({
      data: [
        { day: '2024-01-01', total_calories: 2400 },
        { day: '2024-01-02', total_calories: 300 }, // ring off
        { day: '2024-01-03', total_calories: 2200 },
      ],
    })
    // average only the valid days: (2400 + 2200) / 2 = 2300
    expect(await fetchOuraTdeeAvg(3)).toBe(2300)
  })

  it('returns null when all days are ring-off', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({
      data: [
        { day: '2024-01-01', total_calories: 100 },
        { day: '2024-01-02', total_calories: 50 },
      ],
    })
    expect(await fetchOuraTdeeAvg(2)).toBeNull()
  })

  it('throws when no session', async () => {
    await expect(fetchOuraTdeeAvg(7)).rejects.toThrow()
  })
})

// ── fetchOuraDailyActivity — 2-day-window fallback ───────────────

describe('fetchOuraDailyActivity', () => {
  const DATE = '2026-06-06'
  const YESTERDAY = '2026-06-05'

  const makeActivity = (day: string) => ({
    day,
    score: 72,
    active_calories: 450,
    steps: 8200,
    total_calories: 2100,
    high_activity_time: 1800,
    medium_activity_time: 3600,
    low_activity_time: 7200,
    sedentary_time: 28800,
    equivalent_walking_distance: 6500,
    target_calories: 500,
    target_meters: 8000,
  })

  it('throws "Not signed in" when no session', async () => {
    await expect(fetchOuraDailyActivity(DATE)).rejects.toThrow('Not signed in')
  })

  it("returns today's activity when the API includes today's record", async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [makeActivity(DATE)] })
    const result = await fetchOuraDailyActivity(DATE)
    expect(result).not.toBeNull()
    expect(result!.day).toBe(DATE)
    expect(result!.steps).toBe(8200)
  })

  it('falls back to yesterday when today has no data but yesterday does', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    // API only returns yesterday (today not finalised yet)
    mockFetch({ data: [makeActivity(YESTERDAY)] })
    const result = await fetchOuraDailyActivity(DATE)
    expect(result).not.toBeNull()
    expect(result!.day).toBe(YESTERDAY)
  })

  it('prefers today over yesterday when both are returned', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const todayActivity = { ...makeActivity(DATE), steps: 9999 }
    const yestActivity = { ...makeActivity(YESTERDAY), steps: 1111 }
    mockFetch({ data: [yestActivity, todayActivity] })
    const result = await fetchOuraDailyActivity(DATE)
    expect(result!.day).toBe(DATE)
    expect(result!.steps).toBe(9999)
  })

  it('returns null when neither today nor yesterday is in the response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ data: [] })
    const result = await fetchOuraDailyActivity(DATE)
    expect(result).toBeNull()
  })

  it('requests a 2-day window (yesterday to today)', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [] }),
    })
    vi.stubGlobal('fetch', fetchSpy)
    await fetchOuraDailyActivity(DATE)
    const calledUrl = fetchSpy.mock.calls[0][0] as string
    expect(calledUrl).toContain('start_date=' + YESTERDAY)
    expect(calledUrl).toContain('end_date=' + DATE)
  })

  it('returns null when response has no data field', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({}) // no data field → json.data ?? [] → []
    const result = await fetchOuraDailyActivity(DATE)
    expect(result).toBeNull()
  })

  it('throws Oura error on non-ok HTTP response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ error: 'Oura error 403' }, false)
    await expect(fetchOuraDailyActivity(DATE)).rejects.toThrow('Oura error 403')
  })
})
