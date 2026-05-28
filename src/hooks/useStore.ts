import type { DayData, QuickFood } from '../data/tracker'
import { EMPTY_DAY } from '../data/tracker'
import type { Recipe } from '../data/recipes'
import type { CustomBlock } from '../data/schedule'
import { supabase } from '../lib/supabase'
import * as sync from '../lib/sync'

const TRACKER_KEY      = 'whub_tracker_v3'
const RECIPES_KEY      = 'whub_custom_recipes_v1'
const TAGS_KEY         = 'whub_custom_tags_v1'
const GROCERY_KEY      = 'whub_grocery_v1'
const FOOD_LIBRARY_KEY = 'whub_food_library_v1'
const SCHEDULE_KEY     = 'whub_schedule_v1'

// ── raw helpers ──────────────────────────────────────────────────
function load<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback }
  catch { return fallback }
}
function save<T>(key: string, value: T) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota */ }
}

/**
 * Fire-and-forget push to Supabase — only runs when a user is signed in.
 * Errors are swallowed; local store is always the source of truth.
 */
async function tryPush(fn: (userId: string) => Promise<void>) {
  if (!supabase) return // not configured (tests / dev without .env.local)
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) fn(user.id).catch(() => { /* offline — next sync will catch up */ })
  } catch { /* ignore */ }
}

// ── Tracker ── plain functions, safe to call anywhere ────────────
export const trackerStore = {
  getAll: () => load<Record<string, DayData>>(TRACKER_KEY, {}),

  getDay: (dateKey: string): DayData => {
    const all = load<Record<string, DayData>>(TRACKER_KEY, {})
    return all[dateKey] ?? { ...EMPTY_DAY, foods: [] }
  },

  setDay: (dateKey: string, data: DayData) => {
    const all = load<Record<string, DayData>>(TRACKER_KEY, {})
    all[dateKey] = data
    save(TRACKER_KEY, all)
    tryPush(uid => sync.pushDay(uid, dateKey, data))
  },
}

// ── Recipes ── plain functions ───────────────────────────────────
export const recipeStore = {
  getRecipes:  () => load<Recipe[]>(RECIPES_KEY, []),
  saveRecipes: (arr: Recipe[]) => {
    save(RECIPES_KEY, arr)
    tryPush(uid => sync.pushRecipes(uid, arr))
  },
  addRecipe:   (r: Recipe) => recipeStore.saveRecipes([...recipeStore.getRecipes(), r]),
  deleteRecipe:(id: number) => recipeStore.saveRecipes(recipeStore.getRecipes().filter(r => r.id !== id)),

  getTags:  () => load<string[]>(TAGS_KEY, []),
  saveTags: (arr: string[]) => {
    save(TAGS_KEY, arr)
    tryPush(uid => sync.pushTags(uid, arr))
  },
  addTag:   (tag: string) => {
    const tags = recipeStore.getTags()
    if (!tags.includes(tag)) recipeStore.saveTags([...tags, tag])
  },
}

// ── Grocery ── plain functions ───────────────────────────────────
export const groceryStore = {
  getChecked:  () => load<string[]>(GROCERY_KEY, []),
  saveChecked: (arr: string[]) => {
    save(GROCERY_KEY, arr)
    tryPush(uid => sync.pushGrocery(uid, arr))
  },

  toggle: (name: string) => {
    const checked = groceryStore.getChecked()
    groceryStore.saveChecked(
      checked.includes(name) ? checked.filter(n => n !== name) : [...checked, name]
    )
  },
  clearAll: () => groceryStore.saveChecked([]),
}

// ── Food library ── remembers per-serving macros for previously logged foods ─
export const foodLibraryStore = {
  getAll: (): QuickFood[] => load<QuickFood[]>(FOOD_LIBRARY_KEY, []),

  upsert: (entry: QuickFood): QuickFood[] => {
    const lib = foodLibraryStore.getAll()
    const idx = lib.findIndex(f => f.n.toLowerCase() === entry.n.toLowerCase())
    if (idx >= 0) lib[idx] = entry
    else lib.push(entry)
    save(FOOD_LIBRARY_KEY, lib)
    tryPush(uid => sync.pushFoodLibrary(uid, lib))
    return lib
  },
}

// ── Schedule ── custom blocks (null = use built-in defaults) ────────
export const scheduleStore = {
  getBlocks: (): CustomBlock[] | null =>
    load<CustomBlock[] | null>(SCHEDULE_KEY, null),

  saveBlocks: (blocks: CustomBlock[]) =>
    save(SCHEDULE_KEY, blocks),

  reset: () => {
    try { localStorage.removeItem(SCHEDULE_KEY) } catch { /* quota */ }
  },
}

// ── React hook wrappers (same object, named for clarity in components) ──
export function useTrackerStore()     { return trackerStore }
export function useRecipeStore()      { return recipeStore }
export function useGroceryStore()     { return groceryStore }
export function useFoodLibraryStore() { return foodLibraryStore }

// ── Merge remote data into localStorage without triggering another push ──
export function importRemoteData(remote: {
  tracker?: Record<string, DayData>
  recipes?: Recipe[]
  tags?: string[]
  grocery?: string[]
  foodLibrary?: QuickFood[]
  schedule?: CustomBlock[]
}) {
  if (remote.tracker     !== undefined) save(TRACKER_KEY,      remote.tracker)
  if (remote.recipes     !== undefined) save(RECIPES_KEY,      remote.recipes)
  if (remote.tags        !== undefined) save(TAGS_KEY,         remote.tags)
  if (remote.grocery     !== undefined) save(GROCERY_KEY,      remote.grocery)
  if (remote.foodLibrary !== undefined) save(FOOD_LIBRARY_KEY, remote.foodLibrary)
  if (remote.schedule    !== undefined) save(SCHEDULE_KEY,     remote.schedule)
}

// ── Full export / import (JSON backup) ───────────────────────────
export function exportAllData() {
  return {
    tracker:        load(TRACKER_KEY, {}),
    customRecipes:  load<Recipe[]>(RECIPES_KEY, []),
    customTags:     load<string[]>(TAGS_KEY, []),
    groceryChecked: load<string[]>(GROCERY_KEY, []),
    foodLibrary:    load<QuickFood[]>(FOOD_LIBRARY_KEY, []),
    exportedAt:     new Date().toISOString(),
    version:        'whub_v1',
  }
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json)
    if (data.version !== 'whub_v1') throw new Error('bad version')
    if (data.tracker)        save(TRACKER_KEY,      data.tracker)
    if (data.customRecipes)  save(RECIPES_KEY,      data.customRecipes)
    if (data.customTags)     save(TAGS_KEY,         data.customTags)
    if (data.groceryChecked) save(GROCERY_KEY,      data.groceryChecked)
    if (data.foodLibrary)    save(FOOD_LIBRARY_KEY, data.foodLibrary)
    return true
  } catch { return false }
}
