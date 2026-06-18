/**
 * Store sync paths — exercises the `tryPush` fire-and-forget callbacks that only
 * run when Supabase is configured and a user is signed in (store.test runs with
 * supabase=null, so those lambdas are never reached there).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const getUser = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser: (...a: unknown[]) => getUser(...a) } },
  isConfigured: true,
}))

vi.mock('../lib/sync', () => ({
  pushDay: vi.fn().mockResolvedValue(undefined),
  pushTags: vi.fn().mockResolvedValue(undefined),
  pushGrocery: vi.fn().mockResolvedValue(undefined),
  pushFoodLibrary: vi.fn().mockResolvedValue(undefined),
  pushWeekSchedule: vi.fn().mockResolvedValue(undefined),
  pushUserGroceryCatalog: vi.fn().mockResolvedValue(undefined),
  upsertUserSettings: vi.fn().mockResolvedValue(undefined),
  upsertUserBodyStats: vi.fn().mockResolvedValue(undefined),
  upsertUserWorkoutPlan: vi.fn().mockResolvedValue(undefined),
  pushErrorLog: vi.fn().mockResolvedValue(undefined),
}))

import * as store from '../hooks/useStore'
import * as sync from '../lib/sync'
import { EMPTY_DAY } from '../data/tracker'

const mockSync = sync as unknown as Record<string, ReturnType<typeof vi.fn>>

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
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: { id: 'u-1' } } })
})
afterEach(() => vi.unstubAllGlobals())

const flush = () => new Promise(r => setTimeout(r, 0))

describe('store tryPush callbacks (signed in)', () => {
  it('pushes a tracker day on setDay', async () => {
    store.trackerStore.setDay('2026-06-15', { ...EMPTY_DAY, foods: [] })
    await flush()
    expect(mockSync['pushDay']).toHaveBeenCalledWith('u-1', '2026-06-15', expect.any(Object))
  })

  it('pushes tags, grocery and food library', async () => {
    store.recipeStore.saveTags(['keto'])
    store.groceryStore.toggle('Kale')
    store.foodLibraryStore.upsert({ n: 'Oats', k: 300, p: 10, c: 50, f: 5, fi: 8 })
    await flush()
    expect(mockSync['pushTags']).toHaveBeenCalledWith('u-1', ['keto'])
    expect(mockSync['pushGrocery']).toHaveBeenCalledWith('u-1', ['Kale'])
    expect(mockSync['pushFoodLibrary']).toHaveBeenCalled()
  })

  it('pushes schedule day + week', async () => {
    store.scheduleStore.saveDay('mon', [])
    store.scheduleStore.saveWeek(store.scheduleStore.getWeek())
    await flush()
    expect(mockSync['pushWeekSchedule']).toHaveBeenCalledTimes(2)
  })

  it('pushes the grocery catalog on add', async () => {
    store.groceryCatalogStore.add({ id: 'g1', n: 'Tofu', cat: 'Protein' })
    await flush()
    expect(mockSync['pushUserGroceryCatalog']).toHaveBeenCalled()
  })

  it('pushes user settings, body stats and workout plan', async () => {
    store.userSettingsStore.set({ kcalTarget: 2000 })
    store.bodyStatsStore.set({ weightKg: 70 })
    store.workoutPlanStore.set({ days: [] } as never)
    await flush()
    expect(mockSync['upsertUserSettings']).toHaveBeenCalled()
    expect(mockSync['upsertUserBodyStats']).toHaveBeenCalled()
    expect(mockSync['upsertUserWorkoutPlan']).toHaveBeenCalled()
  })

  it('flips the pending flag when a push rejects', async () => {
    store.syncStatusStore.clear()
    mockSync['pushTags'].mockRejectedValue(new Error('network'))
    store.recipeStore.saveTags(['x'])
    await flush()
    await flush()
    expect(store.syncStatusStore.isPending()).toBe(true)
  })

  it('handles getUser throwing without surfacing', async () => {
    getUser.mockRejectedValue(new Error('no auth'))
    expect(() => store.groceryStore.toggle('Beans')).not.toThrow()
    await flush()
  })
})

describe('remindersStore update/remove', () => {
  it('updates and removes reminders', () => {
    store.remindersStore.add({
      id: 'r1',
      text: 'Drink water',
      checked: false,
      checkedAt: null,
      createdAt: '2026-06-15T00:00:00Z',
    })
    store.remindersStore.update('r1', { checked: true })
    expect(store.remindersStore.getAll()[0].checked).toBe(true)
    store.remindersStore.remove('r1')
    expect(store.remindersStore.getAll()).toHaveLength(0)
  })
})
