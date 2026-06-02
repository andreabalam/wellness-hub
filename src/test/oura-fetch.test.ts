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
  fetchOuraWorkouts, fetchOuraReadiness, fetchOuraSleep, fetchOuraSessions,
  testOuraConnection, getOuraPat, saveOuraPat, clearOuraPat,
} from '../lib/oura'

const mockGetSession = vi.mocked((supabase as NonNullable<typeof supabase>).auth.getSession)
const mockGetUser    = vi.mocked((supabase as NonNullable<typeof supabase>).auth.getUser)
const mockFrom       = vi.mocked((supabase as NonNullable<typeof supabase>).from)

const FAKE_SESSION = { access_token: 'fake-token' }
const FAKE_USER    = { id: 'user-123' }

// ── helpers ───────────────────────────────────────────────────────

/** Make fetch() return a JSON response */
function mockFetch(data: unknown, ok = true) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: vi.fn().mockResolvedValue(data),
    statusText: ok ? 'OK' : 'Internal Server Error',
    status: ok ? 200 : 500,
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
  // Default: no session (proxyFetch throws 'Not signed in')
  mockGetSession.mockResolvedValue({ data: { session: null } } as never)
  mockGetUser.mockResolvedValue({ data: { user: null } } as never)
})

// ── proxyFetch — no session guard ────────────────────────────────

describe('fetchOuraWorkouts', () => {
  it('throws "Not signed in" when no session exists', async () => {
    await expect(fetchOuraWorkouts('2026-01-01')).rejects.toThrow('Not signed in')
  })

  it('returns workout array on successful fetch', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const workout = {
      id: 'w1', activity: 'yoga',
      start_datetime: '2026-01-01T09:00:00Z',
      end_datetime: '2026-01-01T10:00:00Z',
      calories: 200, distance: null,
      average_heart_rate: 80, max_heart_rate: 120,
    }
    mockFetch({ data: [workout] })
    const result = await fetchOuraWorkouts('2026-01-01')
    expect(result).toHaveLength(1)
    expect(result[0].activity).toBe('yoga')
  })

  it('throws on non-ok HTTP response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    mockFetch({ error: 'Oura error' }, false)
    await expect(fetchOuraWorkouts('2026-01-01')).rejects.toThrow()
  })
})

describe('fetchOuraReadiness', () => {
  it('throws "Not signed in" when no session', async () => {
    await expect(fetchOuraReadiness('2026-01-01')).rejects.toThrow('Not signed in')
  })

  it('returns readiness data for the matching day', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const readiness = { day: '2026-01-01', score: 78, hrv_balance_score: 80, recovery_index_score: 75, temperature_deviation: null }
    mockFetch({ data: [readiness] })
    const result = await fetchOuraReadiness('2026-01-01')
    expect(result).not.toBeNull()
    expect(result!.score).toBe(78)
  })

  it('returns null when no matching day in response', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    const readiness = { day: '2026-01-02', score: 78, hrv_balance_score: 80, recovery_index_score: 75, temperature_deviation: null }
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
      day: '2026-01-01', score: 82,
      total_sleep_duration: 28800, deep_sleep_duration: 7200,
      rem_sleep_duration: 5400, efficiency: 91, average_hrv: 45,
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
      id: 's1', type: 'meditation',
      start_datetime: '2026-01-01T08:00:00Z',
      end_datetime: '2026-01-01T08:13:00Z',
      average_heart_rate: null, average_hrv: null, mood: 'good',
    }
    mockFetch({ data: [session] })
    const result = await fetchOuraSessions('2026-01-01')
    expect(result).toHaveLength(1)
    expect(result[0].type).toBe('meditation')
  })
})

describe('testOuraConnection', () => {
  it('returns false when no session', async () => {
    expect(await testOuraConnection()).toBe(false)
  })

  it('returns true when fetch succeeds with session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    expect(await testOuraConnection()).toBe(true)
  })

  it('throws with error message when fetch fails', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ error: 'No Oura Personal Access Token configured.' }),
    }))
    await expect(testOuraConnection()).rejects.toThrow('No Oura Personal Access Token configured.')
  })

  it('throws with fallback message when error body is unparseable', async () => {
    mockGetSession.mockResolvedValue({ data: { session: FAKE_SESSION } } as never)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => { throw new Error('not json') },
    }))
    await expect(testOuraConnection()).rejects.toThrow('HTTP 502')
  })
})

describe('getOuraPat (mocked supabase)', () => {
  it('returns null when query returns no data', async () => {
    const mockMaybySingle = vi.fn().mockResolvedValue({ data: null, error: null })
    const mockSelectFn = vi.fn(() => ({ maybeSingle: mockMaybySingle }))
    mockFrom.mockReturnValue({ select: mockSelectFn } as never)
    expect(await getOuraPat()).toBeNull()
  })

  it('returns pat string when user_settings has one', async () => {
    const mockMaybySingle = vi.fn().mockResolvedValue({ data: { oura_pat: 'my-pat' }, error: null })
    const mockSelectFn = vi.fn(() => ({ maybeSingle: mockMaybySingle }))
    mockFrom.mockReturnValue({ select: mockSelectFn } as never)
    expect(await getOuraPat()).toBe('my-pat')
  })

  it('returns null on query error', async () => {
    const mockMaybySingle = vi.fn().mockResolvedValue({ data: null, error: new Error('db error') })
    const mockSelectFn = vi.fn(() => ({ maybeSingle: mockMaybySingle }))
    mockFrom.mockReturnValue({ select: mockSelectFn } as never)
    expect(await getOuraPat()).toBeNull()
  })
})

describe('saveOuraPat (mocked supabase)', () => {
  it('throws "Not signed in" when user is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as never)
    await expect(saveOuraPat('tok')).rejects.toThrow('Not signed in')
  })

  it('saves PAT successfully when user exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: FAKE_USER } } as never)
    const mockUpsertFn = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsertFn } as never)
    await expect(saveOuraPat('tok')).resolves.toBeUndefined()
    expect(mockUpsertFn).toHaveBeenCalledWith(expect.objectContaining({ oura_pat: 'tok' }))
  })

  it('throws when upsert returns an error', async () => {
    mockGetUser.mockResolvedValue({ data: { user: FAKE_USER } } as never)
    const dbError = { message: 'constraint violation' }
    const mockUpsertFn = vi.fn().mockResolvedValue({ error: dbError })
    mockFrom.mockReturnValue({ upsert: mockUpsertFn } as never)
    await expect(saveOuraPat('tok')).rejects.toEqual(dbError)
  })
})

describe('clearOuraPat (mocked supabase)', () => {
  it('does nothing when user is null', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } } as never)
    await expect(clearOuraPat()).resolves.toBeUndefined()
  })

  it('upserts oura_pat: null when user exists', async () => {
    mockGetUser.mockResolvedValue({ data: { user: FAKE_USER } } as never)
    const mockUpsertFn = vi.fn().mockResolvedValue({ error: null })
    mockFrom.mockReturnValue({ upsert: mockUpsertFn } as never)
    await clearOuraPat()
    expect(mockUpsertFn).toHaveBeenCalledWith(expect.objectContaining({ oura_pat: null }))
  })
})
