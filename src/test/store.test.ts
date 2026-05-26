import { describe, it, expect, beforeEach, vi } from 'vitest'
import { trackerStore, recipeStore, groceryStore, exportAllData, importAllData } from '../hooks/useStore'

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
