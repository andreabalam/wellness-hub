import { useCallback } from 'react'
import type { DayData } from '../data/tracker'
import { EMPTY_DAY } from '../data/tracker'
import type { Recipe } from '../data/recipes'

const TRACKER_KEY  = 'whub_tracker_v3'
const RECIPES_KEY  = 'whub_custom_recipes_v1'
const TAGS_KEY     = 'whub_custom_tags_v1'
const GROCERY_KEY  = 'whub_grocery_v1'

// ── raw helpers ──────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function save<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

// ── Tracker ──────────────────────────────────────────────────────
export function useTrackerStore() {
  const getAll = useCallback(() => load<Record<string, DayData>>(TRACKER_KEY, {}), [])

  const getDay = useCallback((dateKey: string): DayData => {
    const all = load<Record<string, DayData>>(TRACKER_KEY, {})
    return all[dateKey] ?? { ...EMPTY_DAY, foods: [] }
  }, [])

  const setDay = useCallback((dateKey: string, data: DayData) => {
    const all = load<Record<string, DayData>>(TRACKER_KEY, {})
    all[dateKey] = data
    save(TRACKER_KEY, all)
  }, [])

  return { getAll, getDay, setDay }
}

// ── Custom Recipes ────────────────────────────────────────────────
export function useRecipeStore() {
  const getRecipes  = () => load<Recipe[]>(RECIPES_KEY, [])
  const saveRecipes = (arr: Recipe[]) => save(RECIPES_KEY, arr)

  const addRecipe = (r: Recipe) => saveRecipes([...getRecipes(), r])
  const deleteRecipe = (id: number) => saveRecipes(getRecipes().filter(r => r.id !== id))

  const getTags  = () => load<string[]>(TAGS_KEY, [])
  const saveTags = (arr: string[]) => save(TAGS_KEY, arr)
  const addTag   = (tag: string) => {
    const tags = getTags()
    if (!tags.includes(tag)) saveTags([...tags, tag])
  }

  return { getRecipes, addRecipe, deleteRecipe, getTags, addTag }
}

// ── Grocery ───────────────────────────────────────────────────────
export function useGroceryStore() {
  const getChecked  = () => load<string[]>(GROCERY_KEY, [])
  const saveChecked = (arr: string[]) => save(GROCERY_KEY, arr)

  const toggle = (name: string) => {
    const checked = getChecked()
    if (checked.includes(name)) saveChecked(checked.filter(n => n !== name))
    else saveChecked([...checked, name])
  }
  const clearAll = () => saveChecked([])

  return { getChecked, toggle, clearAll }
}

// ── Full export / import ──────────────────────────────────────────
export function exportAllData() {
  return {
    tracker:       load(TRACKER_KEY, {}),
    customRecipes: load<Recipe[]>(RECIPES_KEY, []),
    customTags:    load<string[]>(TAGS_KEY, []),
    groceryChecked:load<string[]>(GROCERY_KEY, []),
    exportedAt:    new Date().toISOString(),
    version:       'whub_v1',
  }
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json)
    if (data.version !== 'whub_v1') throw new Error('bad version')
    if (data.tracker)        save(TRACKER_KEY, data.tracker)
    if (data.customRecipes)  save(RECIPES_KEY, data.customRecipes)
    if (data.customTags)     save(TAGS_KEY, data.customTags)
    if (data.groceryChecked) save(GROCERY_KEY, data.groceryChecked)
    return true
  } catch { return false }
}
