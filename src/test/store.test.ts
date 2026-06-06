import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  trackerStore, recipeStore, groceryStore, scheduleStore,
  foodLibraryStore, groceryCatalogStore, importRemoteData,
  useTrackerStore, useRecipeStore, useGroceryStore, useFoodLibraryStore,
  useGroceryCatalogStore,
  exportAllData, importAllData,
  bodyStatsStore, workoutPlanStore,
  useBodyStatsStore, useWorkoutPlanStore,
  userSettingsStore,
} from '../hooks/useStore'
import { EMPTY_DAY } from '../data/tracker'
import type { CustomBlock } from '../data/schedule'
import type { GroceryCatalogItem } from '../data/grocery'
import type { UserBodyStats, UserWorkoutPlan } from '../lib/sync'

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
    expect(data).toHaveProperty('groceryCatalog')
    expect(data).toHaveProperty('exportedAt')
  })

  it('importAllData restores all keys', () => {
    const base = { foods: [], workout: null, wkNotes: '', energy: 0, mood: 0, sleep: 0, phase: '', notes: '', medMin: 0, medStyle: '' }
    const recipeBase = { cat: 'snack', type: 'Snack', color: '', sc: '', tag: '', prepL: '', prepC: '', hk: 100, hp: '5g', hc: '10g', hf: '3g', mk: 0, mp: '0g', mc: '0g', mf: '0g', ings: [] as [string,string][], steps: [], tip: '', custom: true }

    trackerStore.setDay('2026-05-25', { ...base, workout: 'pilates' })
    recipeStore.addRecipe({ ...recipeBase, id: 99, name: 'Exported Recipe' })
    groceryStore.toggle('Avocados')

    const catItem: GroceryCatalogItem = { id: 'e1', n: 'Exported Kale', cat: 'Produce - Vegetables' }
    groceryCatalogStore.add(catItem)

    const json = JSON.stringify(exportAllData())
    Object.keys(store).forEach(k => delete store[k])

    expect(importAllData(json)).toBe(true)
    expect(trackerStore.getDay('2026-05-25').workout).toBe('pilates')
    expect(recipeStore.getRecipes()[0].name).toBe('Exported Recipe')
    expect(groceryStore.getChecked()).toContain('Avocados')
    expect(groceryCatalogStore.getAll().find(i => i.id === 'e1')?.n).toBe('Exported Kale')
  })

  it('importAllData rejects a bad version', () => {
    expect(importAllData(JSON.stringify({ version: 'bad', tracker: {} }))).toBe(false)
  })

  it('importAllData rejects malformed JSON', () => {
    expect(importAllData('not json at all')).toBe(false)
  })

  it('importAllData skips falsy optional fields without error', () => {
    // version is valid but all optional fields are absent → should still return true
    expect(importAllData(JSON.stringify({ version: 'whub_v1' }))).toBe(true)
  })

  it('importAllData only saves fields that are present and truthy', () => {
    // Pass only customTags, omit tracker and others
    const json = JSON.stringify({ version: 'whub_v1', customTags: ['keto'] })
    expect(importAllData(json)).toBe(true)
    expect(recipeStore.getTags()).toContain('keto')
    expect(trackerStore.getAll()).toEqual({})  // tracker not in payload — untouched
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

  it('getWeek returns a WeekSchedule with all 7 days', () => {
    const week = scheduleStore.getWeek()
    const keys = Object.keys(week)
    expect(keys).toContain('mon')
    expect(keys).toContain('sun')
    expect(keys).toHaveLength(7)
  })

  it('getWeek returns default blocks for each day when nothing is saved', () => {
    const week = scheduleStore.getWeek()
    // Default schedule has blocks for every day
    expect(week.mon.length).toBeGreaterThan(0)
    expect(week.sat.length).toBeGreaterThan(0)
  })

  it('saveDay persists blocks for a specific day', () => {
    const monBlocks = [{ ...sampleBlock, id: 'mon-b1' }]
    scheduleStore.saveDay('mon', monBlocks)
    const week = scheduleStore.getWeek()
    expect(week.mon).toHaveLength(1)
    expect(week.mon[0].title).toBe('Test Block')
  })

  it('saveDay for one day does not affect another day', () => {
    const monBlocks = [{ ...sampleBlock, id: 'mon-custom', title: 'Mon Only' }]
    scheduleStore.saveDay('mon', monBlocks)
    const week = scheduleStore.getWeek()
    // Sat should still have default blocks (not mon's custom block)
    const satHasMonOnly = week.sat.some(b => b.title === 'Mon Only')
    expect(satHasMonOnly).toBe(false)
  })

  it('saveWeek persists the entire week', () => {
    const week = scheduleStore.getWeek()
    const updated = { ...week, fri: [{ ...sampleBlock, id: 'fri-b1', title: 'Fri Block' }] }
    scheduleStore.saveWeek(updated)
    const loaded = scheduleStore.getWeek()
    expect(loaded.fri).toHaveLength(1)
    expect(loaded.fri[0].title).toBe('Fri Block')
  })

  it('resetDay restores default blocks for a day', () => {
    // Save custom blocks first
    scheduleStore.saveDay('tue', [{ ...sampleBlock, id: 'tue-custom', title: 'Custom Tue' }])
    // Reset
    const fresh = scheduleStore.resetDay('tue')
    expect(fresh.length).toBeGreaterThan(0)
    // The titles should be default titles (not 'Custom Tue')
    expect(fresh.some(b => b.title === 'Custom Tue')).toBe(false)
  })

  it('reset clears the v2 schedule key', () => {
    scheduleStore.saveDay('mon', [sampleBlock])
    scheduleStore.reset()
    // After reset, getWeek falls back to defaults (not the saved custom blocks)
    const week = scheduleStore.getWeek()
    // Default blocks don't have 'Test Block' as a title
    expect(week.mon.some(b => b.title === 'Test Block')).toBe(false)
  })

  it('resetWeek restores all 7 days to defaults', () => {
    // Customise every day
    const customBlock = { ...sampleBlock }
    for (const day of ['mon','tue','wed','thu','fri','sat','sun'] as const) {
      scheduleStore.saveDay(day, [{ ...customBlock, id: `${day}-custom`, title: 'Custom Block' }])
    }
    // Verify they're all custom
    const before = scheduleStore.getWeek()
    for (const day of ['mon','tue','wed','thu','fri','sat','sun'] as const) {
      expect(before[day].every(b => b.title === 'Custom Block')).toBe(true)
    }
    // Reset all
    const fresh = scheduleStore.resetWeek()
    // All 7 days should have default blocks (not 'Custom Block')
    for (const day of ['mon','tue','wed','thu','fri','sat','sun'] as const) {
      expect(fresh[day].some(b => b.title === 'Custom Block')).toBe(false)
      expect(fresh[day].length).toBeGreaterThan(0)
    }
    // Persisted state matches the returned week
    const loaded = scheduleStore.getWeek()
    expect(loaded.mon.map(b => b.title)).toEqual(fresh.mon.map(b => b.title))
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

  it('writes v1 schedule blocks (legacy) to localStorage', () => {
    const block = { id: 's1', time: '08:00', title: 'Remote Block', dur: '30 min', color: 'teal', whyTxt: '', desc: '', phase: '' }
    importRemoteData({ schedule: [block] })
    // v1 is stored under the old key; accessible directly from localStorage
    const stored = JSON.parse(store['whub_schedule_v1'] ?? '[]')
    expect(stored).toHaveLength(1)
    expect(stored[0].title).toBe('Remote Block')
  })

  it('writes weekSchedule (v2) to localStorage', () => {
    const monBlock = { id: 'mon-s1', time: '08:00', title: 'Mon Remote', dur: '30 min', color: 'teal', whyTxt: '', desc: '', phase: '' }
    const weekSched = {
      mon: [monBlock], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [],
    }
    importRemoteData({ weekSchedule: weekSched as never })
    const week = scheduleStore.getWeek()
    expect(week.mon).toHaveLength(1)
    expect(week.mon[0].title).toBe('Mon Remote')
  })

  it('writes medGuides to localStorage', () => {
    importRemoteData({ medGuides: [{ title: 'Remote Guide', url: 'https://example.com' }] })
    const stored = JSON.parse(store['whub_med_guides_v1'] ?? '[]')
    expect(stored[0].title).toBe('Remote Guide')
  })

  it('writes groceryCatalog to localStorage', () => {
    const item: GroceryCatalogItem = { id: 'rc1', n: 'Remote Kale', cat: 'Produce - Vegetables' }
    importRemoteData({ groceryCatalog: [item] })
    expect(groceryCatalogStore.getAll().find(i => i.id === 'rc1')).toBeDefined()
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

  it('useGroceryCatalogStore returns the same groceryCatalogStore', () => {
    expect(useGroceryCatalogStore()).toBe(groceryCatalogStore)
  })
})

// ── groceryCatalogStore ──────────────────────────────────────────
describe('groceryCatalogStore', () => {
  const spinach: GroceryCatalogItem = { id: 'g1', n: 'Spinach', cat: 'Produce - Vegetables' }
  const salmon:  GroceryCatalogItem = { id: 'g2', n: 'Salmon',  cat: 'Protein - Animal' }

  it('getAll returns [] initially', () => {
    expect(groceryCatalogStore.getAll()).toEqual([])
  })

  it('add appends an item', () => {
    groceryCatalogStore.add(spinach)
    const items = groceryCatalogStore.getAll()
    expect(items).toHaveLength(1)
    expect(items[0].n).toBe('Spinach')
  })

  it('add appends multiple distinct items', () => {
    groceryCatalogStore.add(spinach)
    groceryCatalogStore.add(salmon)
    expect(groceryCatalogStore.getAll()).toHaveLength(2)
  })

  it('update patches a field by id', () => {
    groceryCatalogStore.add(spinach)
    groceryCatalogStore.update('g1', { n: 'Baby Spinach' })
    expect(groceryCatalogStore.getAll()[0].n).toBe('Baby Spinach')
  })

  it('update leaves other items untouched', () => {
    groceryCatalogStore.add(spinach)
    groceryCatalogStore.add(salmon)
    groceryCatalogStore.update('g1', { cat: 'Produce - Fruit' })
    expect(groceryCatalogStore.getAll().find(i => i.id === 'g2')?.n).toBe('Salmon')
  })

  it('update with unknown id is a no-op', () => {
    groceryCatalogStore.add(spinach)
    groceryCatalogStore.update('zz', { n: 'Ghost' })
    expect(groceryCatalogStore.getAll()[0].n).toBe('Spinach')
  })

  it('remove deletes by id', () => {
    groceryCatalogStore.add(spinach)
    groceryCatalogStore.add(salmon)
    groceryCatalogStore.remove('g1')
    const items = groceryCatalogStore.getAll()
    expect(items).toHaveLength(1)
    expect(items[0].id).toBe('g2')
  })

  it('remove with unknown id is a no-op', () => {
    groceryCatalogStore.add(spinach)
    groceryCatalogStore.remove('zz')
    expect(groceryCatalogStore.getAll()).toHaveLength(1)
  })

  it('isInitialized returns false before any write', () => {
    expect(groceryCatalogStore.isInitialized()).toBe(false)
  })

  it('isInitialized returns true after an add', () => {
    groceryCatalogStore.add(spinach)
    expect(groceryCatalogStore.isInitialized()).toBe(true)
  })

  it('isInitialized returns true even when catalog is empty after save([])', () => {
    groceryCatalogStore.save([])
    expect(groceryCatalogStore.isInitialized()).toBe(true)
  })

  it('reset removes the key so isInitialized returns false', () => {
    groceryCatalogStore.add(spinach)
    groceryCatalogStore.reset()
    expect(groceryCatalogStore.isInitialized()).toBe(false)
    expect(groceryCatalogStore.getAll()).toEqual([])
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

// ── bodyStatsStore ────────────────────────────────────────────────
describe('bodyStatsStore', () => {
  const sampleStats: UserBodyStats = {
    weightKg: 70, bodyFatPct: 18, heightM: 1.78, age: 30, biologicalSex: 'male',
    waistCm: 80, glutesCm: 95, measurementUnit: 'cm',
    cycleType: 'none', equipment: 'Barbell + dumbbells', fatLossRateKg: 0.5,
    macroSplit: 'high_protein', tdeeKcal: 2400, kcalTarget: 2000,
    protRange: '140-160g/day', fatLossGoal: '0.5 kg/wk',
    chronotype: 'bear',
  }

  it('get returns defaults when nothing is saved', () => {
    const s = bodyStatsStore.get()
    expect(s.weightKg).toBe(0)
    expect(s.bodyFatPct).toBe(0)
    expect(s.cycleType).toBe('none')
    expect(s.chronotype).toBe('')
  })

  it('set persists a partial patch and is retrievable via get', () => {
    bodyStatsStore.set({ weightKg: 70, bodyFatPct: 18 })
    const s = bodyStatsStore.get()
    expect(s.weightKg).toBe(70)
    expect(s.bodyFatPct).toBe(18)
    // Other fields remain at defaults
    expect(s.heightM).toBe(0)
  })

  it('set merges a second patch without erasing previous fields', () => {
    bodyStatsStore.set({ weightKg: 70 })
    bodyStatsStore.set({ heightM: 1.78 })
    const s = bodyStatsStore.get()
    expect(s.weightKg).toBe(70)
    expect(s.heightM).toBe(1.78)
  })

  it('set persists all stats fields', () => {
    bodyStatsStore.set(sampleStats)
    const s = bodyStatsStore.get()
    expect(s.equipment).toBe('Barbell + dumbbells')
    expect(s.protRange).toBe('140-160g/day')
    expect(s.fatLossGoal).toBe('0.5 kg/wk')
    expect(s.tdeeKcal).toBe(2400)
    expect(s.kcalTarget).toBe(2000)
  })

  it('importFromRemote writes remote value without triggering push', () => {
    bodyStatsStore.importFromRemote(sampleStats)
    const s = bodyStatsStore.get()
    expect(s.weightKg).toBe(70)
    expect(s.chronotype).toBe('bear')
  })

  it('importFromRemote overwrites existing local data', () => {
    bodyStatsStore.set({ weightKg: 50 })
    bodyStatsStore.importFromRemote({ ...sampleStats, weightKg: 80 })
    expect(bodyStatsStore.get().weightKg).toBe(80)
  })

  it('useBodyStatsStore returns the same bodyStatsStore object', () => {
    expect(useBodyStatsStore()).toBe(bodyStatsStore)
  })
})

// ── workoutPlanStore ──────────────────────────────────────────────
describe('workoutPlanStore', () => {
  const samplePlan: UserWorkoutPlan = {
    gender: 'female',
    numWeeks: 3,
    planData: [
      {
        week: 1, label: 'Week 1', color: 'var(--teal)', note: 'Test note', nutr: 'Test nutr',
        days: [{ slot: 'Day A', type: 'Home', label: 'Test day', time: '30 min', color: 'var(--teal)', solin: 'Note', exs: [] }],
      },
    ],
  }

  it('get returns null when nothing is saved', () => {
    expect(workoutPlanStore.get()).toBeNull()
  })

  it('set persists a plan and is retrievable via get', () => {
    workoutPlanStore.set(samplePlan)
    const p = workoutPlanStore.get()
    expect(p).not.toBeNull()
    expect(p!.gender).toBe('female')
    expect(p!.numWeeks).toBe(3)
    expect(p!.planData[0].label).toBe('Week 1')
  })

  it('set overwrites the previous plan', () => {
    workoutPlanStore.set(samplePlan)
    workoutPlanStore.set({ ...samplePlan, gender: 'male', numWeeks: 4 })
    const p = workoutPlanStore.get()
    expect(p!.gender).toBe('male')
    expect(p!.numWeeks).toBe(4)
  })

  it('importFromRemote writes a plan without triggering push', () => {
    workoutPlanStore.importFromRemote(samplePlan)
    const p = workoutPlanStore.get()
    expect(p!.gender).toBe('female')
    expect(p!.planData).toHaveLength(1)
  })

  it('importFromRemote overwrites an existing plan', () => {
    workoutPlanStore.set(samplePlan)
    const malePlan = { ...samplePlan, gender: 'male' as const }
    workoutPlanStore.importFromRemote(malePlan)
    expect(workoutPlanStore.get()!.gender).toBe('male')
  })

  it('useWorkoutPlanStore returns the same workoutPlanStore object', () => {
    expect(useWorkoutPlanStore()).toBe(workoutPlanStore)
  })
})

// ── userSettingsStore ─────────────────────────────────────────────
describe('userSettingsStore', () => {
  it('get returns defaults when nothing is saved', () => {
    const s = userSettingsStore.get()
    expect(s.kcalTarget).toBe(1380)
    expect(s.macroSplit).toBe('custom')
    expect(s.cognitivePeakStart).toBe('11:00')
  })

  it('set persists a partial patch', () => {
    userSettingsStore.set({ kcalTarget: 1600, macroSplit: 'high_protein' })
    const s = userSettingsStore.get()
    expect(s.kcalTarget).toBe(1600)
    expect(s.macroSplit).toBe('high_protein')
    expect(s.protTarget).toBe(110) // unchanged default
  })

  it('importFromRemote writes remote settings', () => {
    userSettingsStore.importFromRemote({
      kcalTarget: 1800, protTarget: 140, carbTarget: 180, fatTarget: 60,
      fiberTarget: 30, macroSplit: 'balanced',
      cognitivePeakStart: '09:00', cognitivePeakEnd: '11:00',
    })
    const s = userSettingsStore.get()
    expect(s.kcalTarget).toBe(1800)
    expect(s.cognitivePeakStart).toBe('09:00')
  })
})
