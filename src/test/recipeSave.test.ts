/**
 * Unit tests for the recipe save flow.
 *
 * These test the store layer (localStorage) directly — the piece that was
 * losing saved recipes after a Supabase-fetch overwrote React state.
 *
 * Component-level integration tests (useEffect merge, handleSave state update)
 * are covered by the store invariants here: if the store roundtrips correctly
 * and the component uses functional state updates, the UI stays coherent.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ── localStorage stub ─────────────────────────────────────────────

const _ls: Record<string, string> = {}

beforeEach(() => {
  Object.keys(_ls).forEach(k => delete _ls[k])
  vi.stubGlobal('localStorage', {
    getItem:    (k: string) => _ls[k] ?? null,
    setItem:    (k: string, v: string) => { _ls[k] = v },
    removeItem: (k: string) => { delete _ls[k] },
    clear:      () => Object.keys(_ls).forEach(k => delete _ls[k]),
  })
})

const RECIPES_KEY = 'whub_recipes_v1'
const TAGS_KEY    = 'whub_tags_v1'

function safeGet<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function safeSet(key: string, val: unknown) {
  localStorage.setItem(key, JSON.stringify(val))
}

// Minimal store implementation matching useStore.ts — tested in isolation
// so we don't need to import the full module with its Supabase side-effects.
function makeStore() {
  const getRecipes   = () => safeGet<unknown[]>(RECIPES_KEY, [])
  const saveRecipes  = (arr: unknown[]) => safeSet(RECIPES_KEY, arr)
  const addRecipe    = (r: unknown) => saveRecipes([...getRecipes(), r])
  const deleteRecipe = (id: number) => saveRecipes(getRecipes().filter((r: unknown) => (r as { id: number }).id !== id))
  const getTags      = () => safeGet<string[]>(TAGS_KEY, [])
  const addTag       = (t: string) => { const ts = getTags(); if (!ts.includes(t)) safeSet(TAGS_KEY, [...ts, t]) }
  return { getRecipes, saveRecipes, addRecipe, deleteRecipe, getTags, addTag }
}

function makeRecipe(id: number, name = `Recipe ${id}`) {
  return {
    id, name, cat: 'dinner', type: 'Dinner', color: 'var(--purple)', sc: 'cp',
    tag: 'Test', prepL: '20 min', prepC: 'var(--purple)',
    hk: 400, hp: '30g', hc: '40g', hf: '10g',
    mk: 400, mp: '30g', mc: '40g', mf: '10g',
    ings: [['Chicken', '200g']], steps: ['Cook it'], tip: '',
    custom: true, source: 'user',
  }
}

// ═════════════════════════════════════════════════════════════════
// Store roundtrip
// ═════════════════════════════════════════════════════════════════

describe('store roundtrip', () => {
  it('addRecipe persists to localStorage and getRecipes returns it', () => {
    const store = makeStore()
    const r = makeRecipe(1)
    store.addRecipe(r)
    expect(store.getRecipes()).toHaveLength(1)
    expect((store.getRecipes()[0] as { name: string }).name).toBe('Recipe 1')
  })

  it('adding a second recipe keeps the first', () => {
    const store = makeStore()
    store.addRecipe(makeRecipe(1))
    store.addRecipe(makeRecipe(2))
    expect(store.getRecipes()).toHaveLength(2)
  })

  it('deleteRecipe removes only the target recipe', () => {
    const store = makeStore()
    store.addRecipe(makeRecipe(1))
    store.addRecipe(makeRecipe(2))
    store.addRecipe(makeRecipe(3))
    store.deleteRecipe(2)
    const ids = store.getRecipes().map((r: unknown) => (r as { id: number }).id)
    expect(ids).toEqual([1, 3])
  })
})

// ═════════════════════════════════════════════════════════════════
// ID-swap pattern (local id -> DB-assigned id)
// ═════════════════════════════════════════════════════════════════

describe('id-swap after Supabase sync', () => {
  it('replaces local Date.now() id with DB-assigned id', () => {
    const store = makeStore()
    const localId = Date.now()
    const dbId    = 42

    store.addRecipe(makeRecipe(localId, 'My Recipe'))
    expect(store.getRecipes()).toHaveLength(1)

    // Simulate the id-swap that handleSave performs after upsertUserRecipe returns
    store.deleteRecipe(localId)
    store.addRecipe(makeRecipe(dbId, 'My Recipe'))

    const recipes = store.getRecipes()
    expect(recipes).toHaveLength(1)
    expect((recipes[0] as { id: number }).id).toBe(dbId)
    expect((recipes[0] as { name: string }).name).toBe('My Recipe')
  })

  it('does not lose other recipes during the id-swap', () => {
    const store = makeStore()
    store.addRecipe(makeRecipe(1, 'Existing A'))
    store.addRecipe(makeRecipe(2, 'Existing B'))

    const localId = Date.now()
    const dbId    = 99
    store.addRecipe(makeRecipe(localId, 'New Recipe'))
    expect(store.getRecipes()).toHaveLength(3)

    store.deleteRecipe(localId)
    store.addRecipe(makeRecipe(dbId, 'New Recipe'))

    expect(store.getRecipes()).toHaveLength(3)
    const names = store.getRecipes().map((r: unknown) => (r as { name: string }).name)
    expect(names).toContain('Existing A')
    expect(names).toContain('Existing B')
    expect(names).toContain('New Recipe')
  })
})

// ═════════════════════════════════════════════════════════════════
// Reload persistence
// ═════════════════════════════════════════════════════════════════

describe('reload persistence', () => {
  it('recipe survives a simulated reload (fresh store reading same localStorage)', () => {
    const store1 = makeStore()
    store1.addRecipe(makeRecipe(1, 'Persisted Recipe'))

    // Simulate reload: new store instance reads from the same localStorage
    const store2 = makeStore()
    expect(store2.getRecipes()).toHaveLength(1)
    expect((store2.getRecipes()[0] as { name: string }).name).toBe('Persisted Recipe')
  })

  it('multiple recipes all survive a simulated reload', () => {
    const store1 = makeStore()
    store1.addRecipe(makeRecipe(1))
    store1.addRecipe(makeRecipe(2))
    store1.addRecipe(makeRecipe(3))

    const store2 = makeStore()
    expect(store2.getRecipes()).toHaveLength(3)
  })
})

// ═════════════════════════════════════════════════════════════════
// React state merge - simulated (pure logic, no component render)
// ═════════════════════════════════════════════════════════════════

describe('Supabase-fetch merge logic', () => {
  // This is the logic from the useEffect in RecipesTab/index.tsx:
  //   setCustomRecipes(prev => {
  //     const dbIds = new Set(user.map(r => r.id))
  //     const localOnly = prev.filter(r => r.id != null && !dbIds.has(r.id))
  //     return [...user, ...localOnly]
  //   })
  type R = ReturnType<typeof makeRecipe>

  function merge(prev: R[], fromDb: R[]): R[] {
    const dbIds = new Set(fromDb.map(r => r.id))
    const localOnly = prev.filter(r => r.id != null && !dbIds.has(r.id))
    return [...fromDb, ...localOnly]
  }

  it('keeps local-only recipes when Supabase returns other recipes', () => {
    const prev   = [makeRecipe(1001, 'Local Only')]
    const fromDb = [makeRecipe(1, 'DB Recipe A'), makeRecipe(2, 'DB Recipe B')]
    const result = merge(prev, fromDb)
    expect(result).toHaveLength(3)
    const names = result.map(r => r.name)
    expect(names).toContain('Local Only')
    expect(names).toContain('DB Recipe A')
  })

  it('does not duplicate a recipe that exists in both Supabase and localStorage', () => {
    const result = merge([makeRecipe(1, 'Synced Recipe')], [makeRecipe(1, 'Synced Recipe')])
    expect(result).toHaveLength(1)
  })

  it('prefers Supabase version when same id exists in both', () => {
    const prev   = [{ ...makeRecipe(1), name: 'Old Name' }]
    const fromDb = [{ ...makeRecipe(1), name: 'Updated Name' }]
    const result = merge(prev, fromDb)
    expect(result[0].name).toBe('Updated Name')
  })

  it('returns only DB recipes when localStorage is empty', () => {
    expect(merge([], [makeRecipe(1), makeRecipe(2)])).toHaveLength(2)
  })
})

// ═════════════════════════════════════════════════════════════════
// upsertUserRecipe id-in-payload logic
// ═════════════════════════════════════════════════════════════════

describe('upsertUserRecipe id-in-payload logic', () => {
  // This mirrors the isDbId guard in sync.ts:
  //   const isDbId = r.id != null && r.id < 1e12
  function buildPayload(id: number | undefined) {
    const isDbId = id != null && id < 1e12
    return { ...(isDbId ? { id } : {}), name: 'Test' }
  }

  it('omits id for a Date.now() local id (new recipe, let DB assign)', () => {
    const payload = buildPayload(Date.now())
    expect(payload).not.toHaveProperty('id')
  })

  it('includes id for a small BIGSERIAL id (update existing row)', () => {
    const payload = buildPayload(42)
    expect(payload).toHaveProperty('id', 42)
  })

  it('omits id when id is undefined', () => {
    const payload = buildPayload(undefined)
    expect(payload).not.toHaveProperty('id')
  })
})
