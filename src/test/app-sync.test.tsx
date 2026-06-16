/**
 * App sync tests — covers the Supabase auth + bidirectional sync flow in App.tsx.
 * Supabase and sync modules are mocked so no real network calls are made.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

// ── Module mocks (hoisted by Vitest before any imports) ───────────

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(),
      // Used by errorLog.reportError when persisting a log row
      getUser: vi.fn(async () => ({ data: { user: null } })),
    },
  },
  // isConfigured: false → AuthButton returns null immediately (avoids its own supabase calls)
  isConfigured: false,
}))

vi.mock('../lib/sync', () => ({
  fetchBuiltinRecipes:      vi.fn(),
  fetchUserRecipes:         vi.fn(),
  upsertUserRecipe:         vi.fn(),
  deleteUserRecipe:         vi.fn(),
  pullAllDays:              vi.fn(),
  pullTags:                 vi.fn(),
  pullGrocery:              vi.fn(),
  pullFoodLibrary:          vi.fn(),
  pullSchedule:             vi.fn(),
  pullWeekSchedule:         vi.fn(),
  pullMedGuides:            vi.fn(),
  pullGroceryCatalog:       vi.fn(),
  pullUserGroceryCatalog:   vi.fn(),
  pushDay:                  vi.fn(),
  pushTags:                 vi.fn(),
  pushGrocery:              vi.fn(),
  pushFoodLibrary:          vi.fn(),
  pushSchedule:             vi.fn(),
  pushWeekSchedule:         vi.fn(),
  pushMedGuides:            vi.fn(),
  pushUserGroceryCatalog:   vi.fn(),
  fetchReminders:           vi.fn(),
  upsertReminder:           vi.fn(),
  deleteReminder:           vi.fn(),
  fetchUserSettings:        vi.fn(),
  upsertUserSettings:       vi.fn(),
  fetchUserBodyStats:       vi.fn(),
  fetchUserWorkoutPlan:     vi.fn(),
  pushErrorLog:             vi.fn(),
}))

// ── Imports (after mocks) ─────────────────────────────────────────
import App from '../App'
import { supabase } from '../lib/supabase'
import * as sync from '../lib/sync'

const mockAuth = supabase!.auth as unknown as {
  getSession: ReturnType<typeof vi.fn>
  onAuthStateChange: ReturnType<typeof vi.fn>
}
const mockSync = sync as unknown as Record<string, ReturnType<typeof vi.fn>>

const MOCK_USER = { id: 'uid-123', email: 'test@example.com' }

// ── localStorage mock ─────────────────────────────────────────────
const ls: Record<string, string> = {}

beforeEach(() => {
  Object.keys(ls).forEach(k => delete ls[k])
  vi.stubGlobal('localStorage', {
    getItem:    (k: string) => ls[k] ?? null,
    setItem:    (k: string, v: string) => { ls[k] = v },
    removeItem: (k: string) => { delete ls[k] },
    clear:      () => Object.keys(ls).forEach(k => delete ls[k]),
  })
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:mock'), revokeObjectURL: vi.fn() })
  vi.stubGlobal('confirm', vi.fn(() => true))
  vi.stubGlobal('alert', vi.fn())

  // Default: no session, stable subscription
  mockAuth.getSession.mockResolvedValue({ data: { session: null }, error: null })
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })

  // RecipesTab fetch mocks
  mockSync['fetchBuiltinRecipes'].mockResolvedValue([])
  mockSync['fetchUserRecipes'].mockResolvedValue([])

  // All pull/push mocks resolve immediately with empty data
  mockSync['pullAllDays'].mockResolvedValue({})
  mockSync['pullTags'].mockResolvedValue([])
  mockSync['pullGrocery'].mockResolvedValue([])
  mockSync['pullFoodLibrary'].mockResolvedValue([])
  mockSync['pullSchedule'].mockResolvedValue(null)
  mockSync['pullWeekSchedule'].mockResolvedValue(null)
  mockSync['pullMedGuides'].mockResolvedValue(null)
  mockSync['pullGroceryCatalog'].mockResolvedValue(null)
  mockSync['pullUserGroceryCatalog'].mockResolvedValue(null)
  mockSync['pushDay'].mockResolvedValue(undefined)
  mockSync['pushTags'].mockResolvedValue(undefined)
  mockSync['pushGrocery'].mockResolvedValue(undefined)
  mockSync['pushFoodLibrary'].mockResolvedValue(undefined)
  mockSync['pushSchedule'].mockResolvedValue(undefined)
  mockSync['pushWeekSchedule'].mockResolvedValue(undefined)
  mockSync['pushMedGuides'].mockResolvedValue(undefined)
  mockSync['pushUserGroceryCatalog'].mockResolvedValue(undefined)
  mockSync['fetchReminders'].mockResolvedValue([])
  mockSync['upsertReminder'].mockResolvedValue(undefined)
  mockSync['deleteReminder'].mockResolvedValue(undefined)
  mockSync['fetchUserSettings'].mockResolvedValue(null)
  mockSync['upsertUserSettings'].mockResolvedValue(undefined)
  mockSync['fetchUserBodyStats'].mockResolvedValue(null)
  mockSync['fetchUserWorkoutPlan'].mockResolvedValue(null)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────
describe('App (with mocked Supabase)', () => {
  it('renders normally with supabase configured', () => {
    render(<App />)
    expect(screen.getByText(/Wellness Hub/)).toBeInTheDocument()
  })

  it('does NOT call pullAllDays when there is no session on mount', async () => {
    render(<App />)
    // Allow effects to settle
    await new Promise(r => setTimeout(r, 50))
    expect(mockSync['pullAllDays']).not.toHaveBeenCalled()
  })

  it('calls syncAll (pullAllDays) when getSession returns a user', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: MOCK_USER } },
      error: null,
    })
    render(<App />)
    await waitFor(() => {
      expect(mockSync['pullAllDays']).toHaveBeenCalledWith(MOCK_USER.id)
    }, { timeout: 3000 })
  })

  it('calls all pull functions during syncAll', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: MOCK_USER } },
      error: null,
    })
    render(<App />)
    await waitFor(() => {
      expect(mockSync['pullAllDays']).toHaveBeenCalledWith(MOCK_USER.id)
    }, { timeout: 3000 })
    expect(mockSync['pullTags']).toHaveBeenCalledWith(MOCK_USER.id)
    expect(mockSync['pullGrocery']).toHaveBeenCalledWith(MOCK_USER.id)
    expect(mockSync['pullFoodLibrary']).toHaveBeenCalledWith(MOCK_USER.id)
    expect(mockSync['pullUserGroceryCatalog']).toHaveBeenCalledWith(MOCK_USER.id)
  })

  it('local-only grocery catalog items survive the merge', async () => {
    ls['whub_grocery_catalog_v1'] = JSON.stringify([{ id: 'local-1', n: 'Local Kale', cat: 'Produce - Vegetables' }])
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: MOCK_USER } }, error: null })
    mockSync['pullUserGroceryCatalog'].mockResolvedValue([{ id: 'remote-1', n: 'Remote Salmon', cat: 'Protein - Animal' }])

    render(<App />)
    await waitFor(() => {
      expect(mockSync['pushUserGroceryCatalog']).toHaveBeenCalled()
    }, { timeout: 3000 })
    const pushed = mockSync['pushUserGroceryCatalog'].mock.calls[0]?.[1]
    expect(pushed?.find((i: any) => i.id === 'local-1')).toBeDefined()
    expect(pushed?.find((i: any) => i.id === 'remote-1')).toBeDefined()
  })

  it('calls push functions after syncing', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: MOCK_USER } },
      error: null,
    })
    render(<App />)
    await waitFor(() => {
      expect(mockSync['pushTags']).toHaveBeenCalled()
    }, { timeout: 3000 })
    expect(mockSync['pushGrocery']).toHaveBeenCalled()
    expect(mockSync['pushFoodLibrary']).toHaveBeenCalled()
  })

  it('auth state change with a user triggers syncAll', async () => {
    let authCb: ((_event: string, session: any) => void) | null = null
    mockAuth.onAuthStateChange.mockImplementation((cb: typeof authCb) => {
      authCb = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })

    render(<App />)
    await new Promise(r => setTimeout(r, 30))  // let mount effects settle

    vi.clearAllMocks()
    mockSync['pullAllDays'].mockResolvedValue({})
    mockSync['pullTags'].mockResolvedValue([])
    mockSync['pullGrocery'].mockResolvedValue([])
    mockSync['pullFoodLibrary'].mockResolvedValue([])
    mockSync['pullSchedule'].mockResolvedValue(null)
    mockSync['pullWeekSchedule'].mockResolvedValue(null)
    mockSync['pullMedGuides'].mockResolvedValue(null)
    mockSync['pullGroceryCatalog'].mockResolvedValue(null)
    mockSync['pullUserGroceryCatalog'].mockResolvedValue(null)
    mockSync['pushDay'].mockResolvedValue(undefined)
    mockSync['pushTags'].mockResolvedValue(undefined)
    mockSync['pushGrocery'].mockResolvedValue(undefined)
    mockSync['pushFoodLibrary'].mockResolvedValue(undefined)
    mockSync['pushSchedule'].mockResolvedValue(undefined)
    mockSync['pushWeekSchedule'].mockResolvedValue(undefined)
    mockSync['pushMedGuides'].mockResolvedValue(undefined)
    mockSync['pushUserGroceryCatalog'].mockResolvedValue(undefined)

    authCb!('SIGNED_IN', { user: MOCK_USER })

    await waitFor(() => {
      expect(mockSync['pullAllDays']).toHaveBeenCalledWith(MOCK_USER.id)
    }, { timeout: 3000 })
  })

  it('auth state change with null user clears sync (no pullAllDays)', async () => {
    let authCb: ((_event: string, session: any) => void) | null = null
    mockAuth.onAuthStateChange.mockImplementation((cb: typeof authCb) => {
      authCb = cb
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    })
    render(<App />)
    await new Promise(r => setTimeout(r, 30))
    vi.clearAllMocks()

    authCb!('SIGNED_OUT', null)
    await new Promise(r => setTimeout(r, 50))
    expect(mockSync['pullAllDays']).not.toHaveBeenCalled()
  })

  it('syncAll handles pull errors gracefully (catch branch)', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: MOCK_USER } },
      error: null,
    })
    mockSync['pullAllDays'].mockRejectedValue(new Error('network error'))
    render(<App />)
    // Error is caught inside syncAll — app should not crash
    await new Promise(r => setTimeout(r, 100))
    expect(screen.getByText(/Wellness Hub/)).toBeInTheDocument()
  })

  it('subscription is unsubscribed on unmount', async () => {
    const unsubscribe = vi.fn()
    mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe } } })
    const { unmount } = render(<App />)
    await new Promise(r => setTimeout(r, 30))
    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('local-only tags survive the merge (union with remote)', async () => {
    ls['whub_custom_tags_v1'] = JSON.stringify(['keto'])
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: MOCK_USER } }, error: null })
    mockSync['pullTags'].mockResolvedValue(['vegan'])

    render(<App />)
    await waitFor(() => {
      expect(mockSync['pushTags']).toHaveBeenCalled()
    }, { timeout: 3000 })
    const pushed = mockSync['pushTags'].mock.calls[0]?.[1]
    // Both local and remote tags should be present in the merged push
    expect(pushed).toContain('keto')
    expect(pushed).toContain('vegan')
  })

  it('local-only food library entries survive the merge filter (line 63)', async () => {
    ls['whub_food_library_v1'] = JSON.stringify([{ n: 'Local Food', k: 100, p: 5, c: 10, f: 3, fi: 2 }])
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: MOCK_USER } }, error: null })
    mockSync['pullFoodLibrary'].mockResolvedValue([{ n: 'Remote Food', k: 200, p: 10, c: 20, f: 6, fi: 4 }])

    render(<App />)
    await waitFor(() => {
      expect(mockSync['pushFoodLibrary']).toHaveBeenCalled()
    }, { timeout: 3000 })
    const pushed = mockSync['pushFoodLibrary'].mock.calls[0]?.[1]
    expect(pushed?.find((f: any) => f.n === 'Local Food')).toBeDefined()
  })

  it('tracker days are pushed individually via pushDay (line 78)', async () => {
    const dayData = {
      foods: [], workout: 'pilates', wkNotes: '', energy: 3,
      mood: 4, sleep: 5, stress: 0, water: 0, phase: '', notes: '', medMin: 0, medStyle: '',
    }
    ls['whub_tracker_v3'] = JSON.stringify({ '2026-01-15': dayData })
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: MOCK_USER } }, error: null })

    render(<App />)
    await waitFor(() => {
      expect(mockSync['pushDay']).toHaveBeenCalledWith(
        MOCK_USER.id, '2026-01-15', expect.objectContaining({ workout: 'pilates' })
      )
    }, { timeout: 3000 })
  })
})
