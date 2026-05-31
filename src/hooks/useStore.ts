import type { DayData, QuickFood } from '../data/tracker'
import { EMPTY_DAY } from '../data/tracker'
import type { Recipe } from '../data/recipes'
import type { CustomBlock } from '../data/schedule'
import type { MedGuide } from '../lib/sync'
import type { Reminder } from '../data/reminders'
import type { GroceryCatalogItem } from '../data/grocery'
import { supabase } from '../lib/supabase'
import * as sync from '../lib/sync'
import { safeGet, safeSet } from '../lib/storage'

const TRACKER_KEY             = 'whub_tracker_v3'
const RECIPES_KEY             = 'whub_custom_recipes_v1'
const TAGS_KEY                = 'whub_custom_tags_v1'
const GROCERY_KEY             = 'whub_grocery_v1'
const GROCERY_CATALOG_KEY     = 'whub_grocery_catalog_v1'
const FOOD_LIBRARY_KEY        = 'whub_food_library_v1'
const SCHEDULE_KEY            = 'whub_schedule_v1'
export const MED_GUIDES_KEY   = 'whub_med_guides_v1'
const REMINDERS_KEY           = 'whub_reminders_v1'
const HIDDEN_RECIPES_KEY      = 'whub_hidden_recipes_v1'

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
  getAll: () => safeGet<Record<string, DayData>>(TRACKER_KEY, {}),

  getDay: (dateKey: string): DayData => {
    const all = safeGet<Record<string, DayData>>(TRACKER_KEY, {})
    return all[dateKey] ?? { ...EMPTY_DAY, foods: [] }
  },

  setDay: (dateKey: string, data: DayData) => {
    const all = safeGet<Record<string, DayData>>(TRACKER_KEY, {})
    all[dateKey] = data
    safeSet(TRACKER_KEY, all)
    tryPush(uid => sync.pushDay(uid, dateKey, data))
  },
}

// ── Recipes ── plain functions ───────────────────────────────────
// Note: recipe sync to Supabase is handled explicitly in RecipesTab
// via upsertUserRecipe / deleteUserRecipe — not through tryPush here.
export const recipeStore = {
  getRecipes:  () => safeGet<Recipe[]>(RECIPES_KEY, []),
  saveRecipes: (arr: Recipe[]) => safeSet(RECIPES_KEY, arr),
  addRecipe:   (r: Recipe) => recipeStore.saveRecipes([...recipeStore.getRecipes(), r]),
  deleteRecipe:(id: number) => recipeStore.saveRecipes(recipeStore.getRecipes().filter(r => r.id !== id)),

  getTags:  () => safeGet<string[]>(TAGS_KEY, []),
  saveTags: (arr: string[]) => {
    safeSet(TAGS_KEY, arr)
    tryPush(uid => sync.pushTags(uid, arr))
  },
  addTag:   (tag: string) => {
    const tags = recipeStore.getTags()
    if (!tags.includes(tag)) recipeStore.saveTags([...tags, tag])
  },
}

// ── Grocery ── plain functions ───────────────────────────────────
export const groceryStore = {
  getChecked:  () => safeGet<string[]>(GROCERY_KEY, []),
  saveChecked: (arr: string[]) => {
    safeSet(GROCERY_KEY, arr)
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
  getAll: (): QuickFood[] => safeGet<QuickFood[]>(FOOD_LIBRARY_KEY, []),

  upsert: (entry: QuickFood): QuickFood[] => {
    const lib = foodLibraryStore.getAll()
    const idx = lib.findIndex(f => f.n.toLowerCase() === entry.n.toLowerCase())
    if (idx >= 0) lib[idx] = entry
    else lib.push(entry)
    safeSet(FOOD_LIBRARY_KEY, lib)
    tryPush(uid => sync.pushFoodLibrary(uid, lib))
    return lib
  },
}

// ── Schedule ── custom blocks (null = use built-in defaults) ────────
export const scheduleStore = {
  getBlocks: (): CustomBlock[] | null =>
    safeGet<CustomBlock[] | null>(SCHEDULE_KEY, null),

  saveBlocks: (blocks: CustomBlock[]) =>
    safeSet(SCHEDULE_KEY, blocks),

  reset: () => {
    try { localStorage.removeItem(SCHEDULE_KEY) } catch { /* quota */ }
  },
}

// ── Grocery catalog ── user-owned dynamic list of shopping items ──
export const groceryCatalogStore = {
  getAll: (): GroceryCatalogItem[] => safeGet<GroceryCatalogItem[]>(GROCERY_CATALOG_KEY, []),

  save: (items: GroceryCatalogItem[]) => {
    safeSet(GROCERY_CATALOG_KEY, items)
    tryPush(uid => sync.pushUserGroceryCatalog(uid, items))
  },

  add: (item: GroceryCatalogItem) =>
    groceryCatalogStore.save([...groceryCatalogStore.getAll(), item]),

  update: (id: string, patch: Partial<GroceryCatalogItem>) =>
    groceryCatalogStore.save(
      groceryCatalogStore.getAll().map(i => i.id === id ? { ...i, ...patch } : i)
    ),

  remove: (id: string) =>
    groceryCatalogStore.save(groceryCatalogStore.getAll().filter(i => i.id !== id)),

  /** True when the key exists in localStorage (even if the array is empty) */
  isInitialized: (): boolean => {
    try { return localStorage.getItem(GROCERY_CATALOG_KEY) !== null } catch { return false }
  },

  /** Wipe the key so it can be re-seeded from defaults */
  reset: () => {
    try { localStorage.removeItem(GROCERY_CATALOG_KEY) } catch { /* quota */ }
  },
}

// ── Hidden built-in recipes ── set of recipe IDs the user has hidden ─
export const hiddenRecipeStore = {
  getAll: (): number[] => safeGet<number[]>(HIDDEN_RECIPES_KEY, []),

  hide: (id: number) => {
    const current = hiddenRecipeStore.getAll()
    if (!current.includes(id)) safeSet(HIDDEN_RECIPES_KEY, [...current, id])
  },

  restore: (id: number) =>
    safeSet(HIDDEN_RECIPES_KEY, hiddenRecipeStore.getAll().filter(i => i !== id)),

  restoreAll: () => safeSet(HIDDEN_RECIPES_KEY, []),

  isHidden: (id: number): boolean => hiddenRecipeStore.getAll().includes(id),
}

// ── Reminders ── persistent cross-day checklist ───────────────────
export const remindersStore = {
  getAll: (): Reminder[] => safeGet<Reminder[]>(REMINDERS_KEY, []),
  save:   (arr: Reminder[]) => safeSet(REMINDERS_KEY, arr),

  add: (r: Reminder) =>
    remindersStore.save([...remindersStore.getAll(), r]),

  update: (id: string, patch: Partial<Reminder>) =>
    remindersStore.save(
      remindersStore.getAll().map(r => r.id === id ? { ...r, ...patch } : r)
    ),

  remove: (id: string) =>
    remindersStore.save(remindersStore.getAll().filter(r => r.id !== id)),
}

// ── React hook wrappers (same object, named for clarity in components) ──
export function useTrackerStore()     { return trackerStore }
export function useRecipeStore()      { return recipeStore }
export function useGroceryStore()     { return groceryStore }
export function useFoodLibraryStore() { return foodLibraryStore }
export function useRemindersStore()      { return remindersStore }
export function useGroceryCatalogStore() { return groceryCatalogStore }
export function useHiddenRecipeStore()   { return hiddenRecipeStore }

// ── Merge remote data into localStorage without triggering another push ──
export function importRemoteData(remote: {
  tracker?: Record<string, DayData>
  recipes?: Recipe[]
  tags?: string[]
  grocery?: string[]
  foodLibrary?: QuickFood[]
  schedule?: CustomBlock[]
  medGuides?: MedGuide[]
  groceryCatalog?: GroceryCatalogItem[]
}) {
  if (remote.tracker        !== undefined) safeSet(TRACKER_KEY,        remote.tracker)
  if (remote.recipes        !== undefined) safeSet(RECIPES_KEY,        remote.recipes)
  if (remote.tags           !== undefined) safeSet(TAGS_KEY,           remote.tags)
  if (remote.grocery        !== undefined) safeSet(GROCERY_KEY,        remote.grocery)
  if (remote.foodLibrary    !== undefined) safeSet(FOOD_LIBRARY_KEY,   remote.foodLibrary)
  if (remote.schedule       !== undefined) safeSet(SCHEDULE_KEY,       remote.schedule)
  if (remote.medGuides      !== undefined) safeSet(MED_GUIDES_KEY,     remote.medGuides)
  if (remote.groceryCatalog !== undefined) safeSet(GROCERY_CATALOG_KEY, remote.groceryCatalog)
}

// ── Full export / import (JSON backup) ───────────────────────────
export function exportAllData() {
  return {
    tracker:        safeGet(TRACKER_KEY, {}),
    customRecipes:  safeGet<Recipe[]>(RECIPES_KEY, []),
    customTags:     safeGet<string[]>(TAGS_KEY, []),
    groceryChecked: safeGet<string[]>(GROCERY_KEY, []),
    foodLibrary:    safeGet<QuickFood[]>(FOOD_LIBRARY_KEY, []),
    groceryCatalog: safeGet<GroceryCatalogItem[]>(GROCERY_CATALOG_KEY, []),
    hiddenRecipes:  safeGet<number[]>(HIDDEN_RECIPES_KEY, []),
    exportedAt:     new Date().toISOString(),
    version:        'whub_v1',
  }
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json)
    if (data.version !== 'whub_v1') throw new Error('bad version')
    if (data.tracker)        safeSet(TRACKER_KEY,         data.tracker)
    if (data.customRecipes)  safeSet(RECIPES_KEY,         data.customRecipes)
    if (data.customTags)     safeSet(TAGS_KEY,            data.customTags)
    if (data.groceryChecked) safeSet(GROCERY_KEY,         data.groceryChecked)
    if (data.foodLibrary)    safeSet(FOOD_LIBRARY_KEY,    data.foodLibrary)
    if (data.groceryCatalog) safeSet(GROCERY_CATALOG_KEY, data.groceryCatalog)
    if (data.hiddenRecipes)  safeSet(HIDDEN_RECIPES_KEY,  data.hiddenRecipes)
    return true
  } catch { return false }
}
