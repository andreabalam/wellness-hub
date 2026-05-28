import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  trackerStore, recipeStore, groceryStore, scheduleStore,
  foodLibraryStore, importRemoteData,
  useTrackerStore, useRecipeStore, useGroceryStore, useFoodLibraryStore,
  exportAllData, importAllData,
} from '../hooks/useStore'
import { EMPTY_DAY } from '../data/tracker'
import type { CustomBlock } from '../data/schedule'

// ── localStorage mock ────────────────────────────────────────────
const store: Record<string, string> = {}

beforeEach(() => {
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear:      () => Object.keys(store).forEach(k => delete store[k]),
  })
})

// ── trackerStore ─────────────────────────────────────────────────
describe('trackerStore', () => {
  it('getDay returns EMPTY_DAY shape for a new key', () => {
    const day = trackerStore.getDay('2026-01-01')
    expect(day.foods).toEqual([])
    expect(day.workout).toBeNull()
    expect(day.energy).toBe(0)
  })

  it('setDay persists and getDay retrieves it', () => {
    const data = {
      foods: [{ n: 'Oats', k: 350, p: 18, c: 42, f: 12, fi: 9 }],
      workout: 'pilates', wkNotes: 'felt great',
      energy: 4, mood: 3, sleep: 5, phase: 'Follicular',
      notes: 'good day', medMin: 13, medStyle: 'Breath focus',
    }
    trackerStore.setDay('2026-01-01', data)
    const result = trackerStore.getDay('2026-01-01')
    expect(result.foods[0].n).toBe('Oats')
    expect(result.workout).toBe('pilates')
    expect(result.energy).toBe(4)
    expect(result.medMin).toBe(13)
  })

  it('setDay for different dates do not overwrite each other', () => {
    const base = { foods: [], workout: null, wkNotes: '', energy: 0, mood: 0, sleep: 0, phase: '', notes: '', medMin: 0, medStyle: '' }
    trackerStore.setDay('2026-01-01', { ...base, energy: 5 })
    trackerStore.setDay('2026-01-02', { ...base, energy: 2 })
    expect(trackerStore.getDay('2026-01-01').energy).toBe(5)
    expect(trackerStore.getDay('2026-01-02').energy).toBe(2)
  })

  it('getAll returns all stored days', () => {
    const base = { foods: [], workout: null, wkNotes: '', energy: 0, mood: 0, sleep: 0, phase: '', notes: '', medMin: 0, medStyle: '' }
    trackerStore.setDay('2026-01-01', base)
    trackerStore.setDay('2026-01-02', base)
    expect(Object.keys(trackerStore.getAll())).toHaveLength(2)
  })

  it('overwriting a day replaces only that day', () => {
    const base = { foods: [], workout: null, wkNotes: '', energy: 0, mood: 0, sleep: 0, phase: '', notes: '', medMin: 0, medStyle: '' }
    trackerStore.setDay('2026-01-01', { ...base, energy: 3 })
    trackerStore.setDay('2026-01-01', { ...base, energy: 5 })
    expect(trackerStore.getDay('2026-01-01').energy).toBe(5)
    expect(Object.keys(trackerStore.getAll())).toHaveLength(1)
  })
})

// ── recipeStore ──────────────────────────────────────────────────
describe('recipeStore', () => {
  const base = { cat: 'dinner', type: 'Dinner', color: '', sc: '', tag: '', prepL: '', prepC: '', hk: 0, hp: '0g', hc: '0g', hf: '0g', mk: 0, mp: '0g', mc: '0g', mf: '0g', ings: [] as [string,string][], steps: [], tip: '', custom: true }

  it('starts with empty recipes', () => {
    expect(recipeStore.getRecipes()).toEqual([])
  })

  it('addRecipe persists and is retrievable', () => {
    recipeStore.addRecipe({ ...base, id: 1, name: 'Test Chicken' })
    const result = recipeStore.getRecipes()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Test Chicken')
  })

  it('deleteRecipe removes by id', () => {
    recipeStore.addRecipe({ ...base, id: 1, name: 'Keep' })
    recipeStore.addRecipe({ ...base, id: 2, name: 'Delete me' })
    recipeStore.deleteRecipe(2)
    const result = recipeStore.getRecipes()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Keep')
  })

  it('deleteRecipe with unknown id leaves list unchanged', () => {
    recipeStore.addRecipe({ ...base, id: 1, name: 'Keep' })
    recipeStore.deleteRecipe(999)
    expect(recipeStore.getRecipes()).toHaveLength(1)
  })

  it('addTag deduplicates', () => {
    recipeStore.addTag('snack')
    recipeStore.addTag('snack')
    recipeStore.addTag('dessert')
    expect(recipeStore.getTags()).toEqual(['snack', 'dessert'])
  })

  it('starts with empty tags', () => {
    expect(recipeStore.getTags()).toEqual([])
  })
})

// ── groceryStore ─────────────────────────────────────────────────
describe('groceryStore', () => {
  it('starts empty', () => {
    expect(groceryStore.getChecked()).toEqual([])
  })

  it('toggle adds an item', () => {
    groceryStore.toggle('Spinach')
    expect(groceryStore.getChecked()).toContain('Spinach')
  })

  it('toggle removes an already-checked item', () => {
    groceryStore.toggle('Spinach')
    groceryStore.toggle('Spinach')
    expect(groceryStore.getChecked()).not.toContain('Spinach')
  })

  it('multiple items can be checked independently', () => {
    groceryStore.toggle('Spinach')
    groceryStore.toggle('Salmon')
    const checked = groceryStore.getChecked()
    expect(checked).toContain('Spinach')
    expect(checked).toContain('Salmon')
    expect(checked).toHaveLength(2)
  })

  it('clearAll empties the list', () => {
    groceryStore.toggle('Spinach')
    groceryStore.toggle('Salmon')
    groceryStore.clearAll()
    expect(groceryStore.getChecked()).toHaveLength(0)
  })
})

// ── exportAllData / importAllData ────────────────────────────────
describe('export / import round-trip', () => {
  it('exports a valid whub_v1 object', () => {
    const data = exportAllData()
    expect(data.version).toBe('whub_v1')
    expect(data).toHaveProperty('tracker')
    expect(data).toHaveProperty('customRecipes')
    expect(data).toHaveProperty('customTags')
    expect(data).toHaveProperty('groceryChecked')
    expect(data).toHaveProperty('exportedAt')
  })

  it('importAllData restores all keys', () => {
    const base = { foods: [], workout: null, wkNotes: '', energy: 0, mood: 0, sleep: 0, phase: '', notes: '', medMin: 0, medStyle: '' }
    const recipeBase = { cat: 'snack', type: 'Snack', color: '', sc: '', tag: '', prepL: '', prepC: '', hk: 100, hp: '5g', hc: '10g', hf: '3g', mk: 0, mp: '0g', mc: '0g', mf: '0g', ings: [] as [string,string][], steps: [], tip: '', custom: true }

    trackerStore.setDay('2026-05-25', { ...base, workout: 'pilates' })
    recipeStore.addRecipe({ ...recipeBase, id: 99, name: 'Exported Recipe' })
    groceryStore.toggle('Avocados')

    const json = JSON.stringify(exportAllData())
    Object.keys(store).forEach(k => delete store[k])

    expect(importAllData(json)).toBe(true)
    expect(trackerStore.getDay('2026-05-25').workout).toBe('pilates')
    expect(recipeStore.getRecipes()[0].name).toBe('Exported Recipe')
    expect(groceryStore.getChecked()).toContain('Avocados')
  })

  it('importAllData rejects a bad version', () => {
    expect(importAllData(JSON.stringify({ version: 'bad', tracker: {} }))).toBe(false)
  })

  it('importAllData rejects malformed JSON', () => {
    expect(importAllData('not json at all')).toBe(false)
  })

  it('exportedAt is a valid ISO date string', () => {
    const data = exportAllData()
    expect(() => new Date(data.exportedAt)).not.toThrow()
    expect(new Date(data.exportedAt).getFullYear()).toBeGreaterThan(2020)
  })
})

// ── scheduleStore ────────────────────────────────────────────────
describe('scheduleStore', () => {
  const sampleBlock: CustomBlock = {
    id: 'b1', time: '09:00', title: 'Test Block',
    dur: '30 min', color: 'green', whyTxt: '', desc: '', phase: '',
  }

  it('getBlocks returns null when nothing is saved', () => {
    expect(scheduleStore.getBlocks()).toBeNull()
  })

  it('saveBlocks persists blocks', () => {
    scheduleStore.saveBlocks([sampleBlock])
    const result = scheduleStore.getBlocks()
    expect(result).toHaveLength(1)
    expect(result![0].title).toBe('Test Block')
  })

  it('saveBlocks overwrites previous blocks', () => {
    scheduleStore.saveBlocks([sampleBlock])
    scheduleStore.saveBlocks([{ ...sampleBlock, id: 'b2', title: 'Replaced' }])
    const result = scheduleStore.getBlocks()
    expect(result).toHaveLength(1)
    expect(result![0].title).toBe('Replaced')
  })

  it('saveBlocks persists multiple blocks', () => {
    const blocks = [
      sampleBlock,
      { ...sampleBlock, id: 'b2', title: 'Second Block', color: 'teal' },
    ]
    scheduleStore.saveBlocks(blocks)
    expect(scheduleStore.getBlocks()).toHaveLength(2)
  })

  it('reset removes saved blocks so getBlocks returns null', () => {
    scheduleStore.saveBlocks([sampleBlock])
    scheduleStore.reset()
    expect(scheduleStore.getBlocks()).toBeNull()
  })
})

// ── foodLibraryStore ─────────────────────────────────────────────
describe('foodLibraryStore', () => {
  const oats = { n: 'Oats', k: 150, p: 5, c: 27, f: 2, fi: 4 }
  const eggs = { n: 'Eggs', k: 72, p: 6, c: 0, f: 5, fi: 0 }

  it('getAll returns [] initially', () => {
    expect(foodLibraryStore.getAll()).toEqual([])
  })

  it('upsert adds a new food entry', () => {
    foodLibraryStore.upsert(oats)
    const lib = foodLibraryStore.getAll()
    expect(lib).toHaveLength(1)
    expect(lib[0].n).toBe('Oats')
    expect(lib[0].k).toBe(150)
  })

  it('upsert updates existing entry matched case-insensitively', () => {
    foodLibraryStore.upsert(oats)
    foodLibraryStore.upsert({ ...oats, n: 'oats', k: 200 })
    const lib = foodLibraryStore.getAll()
    expect(lib).toHaveLength(1)
    expect(lib[0].k).toBe(200)
  })

  it('upsert adds distinct entries for different names', () => {
    foodLibraryStore.upsert(oats)
    foodLibraryStore.upsert(eggs)
    expect(foodLibraryStore.getAll()).toHaveLength(2)
  })

  it('upsert returns the updated library', () => {
    const result = foodLibraryStore.upsert(oats)
    expect(Array.isArray(result)).toBe(true)
    expect(result[0].n).toBe('Oats')
  })
})

// ── importRemoteData ─────────────────────────────────────────────
describe('importRemoteData', () => {
  const baseDay = { ...EMPTY_DAY, foods: [] }
  const recipeBase = {
    cat: 'dinner', type: 'Dinner', color: '', sc: '', tag: '', prepL: '', prepC: '',
    hk: 0, hp: '0g', hc: '0g', hf: '0g', mk: 0, mp: '0g', mc: '0g', mf: '0g',
    ings: [] as [string, string][], steps: [] as string[], tip: '', custom: true,
  }

  it('writes tracker days to localStorage', () => {
    importRemoteData({ tracker: { '2026-03-01': { ...baseDay, energy: 5 } } })
    expect(trackerStore.getDay('2026-03-01').energy).toBe(5)
  })

  it('writes recipes to localStorage', () => {
    importRemoteData({ recipes: [{ ...recipeBase, id: 77, name: 'Remote Dish' }] })
    expect(recipeStore.getRecipes().find(r => r.name === 'Remote Dish')).toBeDefined()
  })

  it('writes tags to localStorage', () => {
    importRemoteData({ tags: ['keto', 'vegan'] })
    expect(recipeStore.getTags()).toContain('keto')
  })

  it('writes grocery checked list to localStorage', () => {
    importRemoteData({ grocery: ['Spinach', 'Salmon'] })
    expect(groceryStore.getChecked()).toContain('Spinach')
    expect(groceryStore.getChecked()).toContain('Salmon')
  })

  it('writes food library to localStorage', () => {
    importRemoteData({ foodLibrary: [{ n: 'Chicken', k: 130, p: 26, c: 0, f: 3, fi: 0 }] })
    expect(foodLibraryStore.getAll().find(f => f.n === 'Chicken')).toBeDefined()
  })

  it('ignores undefined fields (no-ops)', () => {
    importRemoteData({})
    expect(trackerStore.getAll()).toEqual({})
  })
})

// ── hook wrappers ────────────────────────────────────────────────
describe('store hook wrappers', () => {
  it('useTrackerStore returns the same trackerStore', () => {
    expect(useTrackerStore()).toBe(trackerStore)
  })

  it('useRecipeStore returns the same recipeStore', () => {
    expect(useRecipeStore()).toBe(recipeStore)
  })

  it('useGroceryStore returns the same groceryStore', () => {
    expect(useGroceryStore()).toBe(groceryStore)
  })

  it('useFoodLibraryStore returns the same foodLibraryStore', () => {
    expect(useFoodLibraryStore()).toBe(foodLibraryStore)
  })
})

// ── load catch branch (useStore line 18) ─────────────────────────
describe('load() error handling', () => {
  it('returns the fallback when localStorage contains invalid JSON', () => {
    // Write corrupt data directly so getItem returns non-parseable JSON
    store['whub_tracker_v3'] = 'not valid json {{{'
    // trackerStore.getAll() calls load(...) which catches the parse error
    const result = trackerStore.getAll()
    // Should return the fallback ({}) instead of throwing
    expect(result).toEqual({})
  })
})
