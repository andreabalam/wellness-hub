import type { DayData, QuickFood } from '../data/tracker'
import { EMPTY_DAY } from '../data/tracker'
import type { Recipe } from '../data/recipes'
import { normalizeCat, catLabel } from '../data/recipes'
import type { CustomBlock, WeekSchedule, DayKey } from '../data/schedule'
import { SCHEDULE_BLOCKS, defaultToCustomBlock, makeWeekSchedule } from '../data/schedule'
import type { MedGuide, UserSettings, UserBodyStats, UserWorkoutPlan } from '../lib/sync'
import type { Reminder } from '../data/reminders'
import type { GroceryCatalogItem } from '../data/grocery'
import { supabase } from '../lib/supabase'
import * as sync from '../lib/sync'
import { safeGet, safeSet, safeRemove, safeHas } from '../lib/storage'
import { reportError } from '../lib/errorLog'
import { isDayDataMap, isRecipe, isQuickFood, isArrayOf } from '../lib/schema'

const isRecipeArray = (v: unknown): v is Recipe[] => isArrayOf(v, isRecipe)
const isQuickFoodArray = (v: unknown): v is QuickFood[] => isArrayOf(v, isQuickFood)

const TRACKER_KEY = 'whub_tracker_v3'
const RECIPES_KEY = 'whub_custom_recipes_v1'
const TAGS_KEY = 'whub_custom_tags_v1'
const GROCERY_KEY = 'whub_grocery_v1'
const GROCERY_CATALOG_KEY = 'whub_grocery_catalog_v1'
const FOOD_LIBRARY_KEY = 'whub_food_library_v1'
const SCHEDULE_KEY = 'whub_schedule_v1'
const WEEK_SCHEDULE_KEY = 'whub_schedule_v2'
export const MED_GUIDES_KEY = 'whub_med_guides_v1'
const REMINDERS_KEY = 'whub_reminders_v1'
const HIDDEN_RECIPES_KEY = 'whub_hidden_recipes_v1'
const USER_SETTINGS_KEY = 'whub_user_settings_v1'
const BODY_STATS_KEY = 'whub_body_stats_v1'
const WORKOUT_PLAN_KEY = 'whub_workout_plan_v1'

// ── Sync status ── whether local writes are pending a confirmed push ─────
// Persisted so the "changes not yet synced" hint survives a reload (e.g. edits
// made offline). Cleared by syncAll once every push succeeds.
const SYNC_DIRTY_KEY = 'whub_sync_dirty'
type SyncStatusListener = (pending: boolean) => void
const syncStatusListeners = new Set<SyncStatusListener>()

export const syncStatusStore = {
  isPending: (): boolean => safeGet<boolean>(SYNC_DIRTY_KEY, false),
  markPending: () => {
    if (syncStatusStore.isPending()) return
    safeSet(SYNC_DIRTY_KEY, true)
    syncStatusListeners.forEach(l => l(true))
  },
  clear: () => {
    if (!syncStatusStore.isPending()) return
    safeSet(SYNC_DIRTY_KEY, false)
    syncStatusListeners.forEach(l => l(false))
  },
  subscribe: (l: SyncStatusListener): (() => void) => {
    syncStatusListeners.add(l)
    return () => {
      syncStatusListeners.delete(l)
    }
  },
}

/**
 * Fire-and-forget push to Supabase — only runs when a user is signed in.
 * The local store is the source of truth; a failed push is logged and flips the
 * sync-pending flag so the next syncAll reconciles it (syncAll re-pushes all
 * local data), and the UI can show a "changes not yet synced" hint.
 */
async function tryPush(fn: (userId: string) => Promise<void>) {
  if (!supabase) return // not configured (tests / dev without .env.local)
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user)
      fn(user.id).catch(err => {
        reportError('tryPush:push', err)
        syncStatusStore.markPending()
      })
  } catch (err) {
    reportError('tryPush:getUser', err)
  }
}

// ── Tracker ── plain functions, safe to call anywhere ────────────
export const trackerStore = {
  getAll: () => safeGet<Record<string, DayData>>(TRACKER_KEY, {}, isDayDataMap),

  getDay: (dateKey: string): DayData => {
    const all = safeGet<Record<string, DayData>>(TRACKER_KEY, {}, isDayDataMap)
    return all[dateKey] ?? { ...EMPTY_DAY, foods: [] }
  },

  setDay: (dateKey: string, data: DayData) => {
    const all = safeGet<Record<string, DayData>>(TRACKER_KEY, {}, isDayDataMap)
    all[dateKey] = data
    safeSet(TRACKER_KEY, all)
    tryPush(uid => sync.pushDay(uid, dateKey, data))
  },
}

// ── One-time localStorage migration: lunch/dinner/missing cat → meal ──
;(() => {
  const raw = safeGet<Recipe[]>(RECIPES_KEY, [])
  if (raw.some(r => normalizeCat(r.cat) !== r.cat)) {
    safeSet(
      RECIPES_KEY,
      raw.map(r =>
        normalizeCat(r.cat) !== r.cat
          ? { ...r, cat: normalizeCat(r.cat), type: catLabel(normalizeCat(r.cat)) }
          : r,
      ),
    )
  }
})()

// ── Recipes ── plain functions ───────────────────────────────────
// Note: recipe sync to Supabase is handled explicitly in RecipesTab
// via upsertUserRecipe / deleteUserRecipe — not through tryPush here.
export const recipeStore = {
  getRecipes: () => safeGet<Recipe[]>(RECIPES_KEY, [], isRecipeArray),
  saveRecipes: (arr: Recipe[]) => safeSet(RECIPES_KEY, arr),
  addRecipe: (r: Recipe) => recipeStore.saveRecipes([...recipeStore.getRecipes(), r]),
  deleteRecipe: (id: number) =>
    recipeStore.saveRecipes(recipeStore.getRecipes().filter(r => r.id !== id)),

  getTags: () => safeGet<string[]>(TAGS_KEY, []),
  saveTags: (arr: string[]) => {
    safeSet(TAGS_KEY, arr)
    tryPush(uid => sync.pushTags(uid, arr))
  },
  addTag: (tag: string) => {
    const tags = recipeStore.getTags()
    if (!tags.includes(tag)) recipeStore.saveTags([...tags, tag])
  },
}

// ── Built-in recipe catalog cache ────────────────────────────────
// The full catalog lives in the Supabase `recipes` table (user_id IS NULL).
// RecipesTab refreshes this cache on every fetch; TrackerTab reads it so the
// log-food search can match built-in recipes without its own network round-trip.
const BUILTIN_CACHE_KEY = 'whub_builtin_recipes_v1'
export const builtinRecipeCacheStore = {
  getAll: (): Recipe[] => safeGet<Recipe[]>(BUILTIN_CACHE_KEY, [], isRecipeArray),
  save: (arr: Recipe[]) => safeSet(BUILTIN_CACHE_KEY, arr),
}

// ── Grocery ── plain functions ───────────────────────────────────
export const groceryStore = {
  getChecked: () => safeGet<string[]>(GROCERY_KEY, []),
  saveChecked: (arr: string[]) => {
    safeSet(GROCERY_KEY, arr)
    tryPush(uid => sync.pushGrocery(uid, arr))
  },

  toggle: (name: string) => {
    const checked = groceryStore.getChecked()
    groceryStore.saveChecked(
      checked.includes(name) ? checked.filter(n => n !== name) : [...checked, name],
    )
  },
  clearAll: () => groceryStore.saveChecked([]),
}

// ── Food library ── remembers per-serving macros for previously logged foods ─
export const foodLibraryStore = {
  getAll: (): QuickFood[] => safeGet<QuickFood[]>(FOOD_LIBRARY_KEY, [], isQuickFoodArray),

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

// ── Schedule ── per-day week schedule ───────────────────────────
export const scheduleStore = {
  getWeek(): WeekSchedule {
    const v2 = safeGet<WeekSchedule | null>(WEEK_SCHEDULE_KEY, null)
    if (v2) return v2
    // migrate v1 (single CustomBlock[]) → v2 (per-day)
    const v1 = safeGet<CustomBlock[] | null>(SCHEDULE_KEY, null)
    const base = v1 ?? SCHEDULE_BLOCKS.map(defaultToCustomBlock)
    return makeWeekSchedule(base)
  },

  saveDay(day: DayKey, blocks: CustomBlock[]) {
    const next = { ...scheduleStore.getWeek(), [day]: blocks }
    safeSet(WEEK_SCHEDULE_KEY, next)
    tryPush(uid => sync.pushWeekSchedule(uid, next))
  },

  saveWeek(week: WeekSchedule) {
    safeSet(WEEK_SCHEDULE_KEY, week)
    tryPush(uid => sync.pushWeekSchedule(uid, week))
  },

  resetDay(day: DayKey) {
    const base = SCHEDULE_BLOCKS.map(defaultToCustomBlock)
    const dayBlocks = base.map(b => ({ ...b, id: `${day}-${b.id}` }))
    scheduleStore.saveDay(day, dayBlocks)
    return dayBlocks
  },

  resetWeek() {
    const week = makeWeekSchedule(SCHEDULE_BLOCKS.map(defaultToCustomBlock))
    scheduleStore.saveWeek(week)
    return week
  },

  reset() {
    safeRemove(WEEK_SCHEDULE_KEY)
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
      groceryCatalogStore.getAll().map(i => (i.id === id ? { ...i, ...patch } : i)),
    ),

  remove: (id: string) =>
    groceryCatalogStore.save(groceryCatalogStore.getAll().filter(i => i.id !== id)),

  /** True when the key exists in localStorage (even if the array is empty) */
  isInitialized: (): boolean => safeHas(GROCERY_CATALOG_KEY),

  /** Wipe the key so it can be re-seeded from defaults */
  reset: () => safeRemove(GROCERY_CATALOG_KEY),
}

// ── Hidden built-in recipes ── set of recipe IDs the user has hidden ─
export const hiddenRecipeStore = {
  getAll: (): number[] => safeGet<number[]>(HIDDEN_RECIPES_KEY, []),

  hide: (id: number) => {
    const current = hiddenRecipeStore.getAll()
    if (!current.includes(id)) safeSet(HIDDEN_RECIPES_KEY, [...current, id])
  },

  restore: (id: number) =>
    safeSet(
      HIDDEN_RECIPES_KEY,
      hiddenRecipeStore.getAll().filter(i => i !== id),
    ),

  restoreAll: () => safeSet(HIDDEN_RECIPES_KEY, []),

  isHidden: (id: number): boolean => hiddenRecipeStore.getAll().includes(id),
}

// ── User settings (macro targets + cognitive peak) ────────────────

const USER_SETTINGS_DEFAULTS: UserSettings = {
  kcalTarget: 1380,
  protTarget: 110,
  carbTarget: 130,
  fatTarget: 52,
  fiberTarget: 25,
  macroSplit: 'custom',
  cognitivePeakStart: '11:00',
  cognitivePeakEnd: '13:00',
}

export const userSettingsStore = {
  get: (): UserSettings => safeGet<UserSettings>(USER_SETTINGS_KEY, USER_SETTINGS_DEFAULTS),

  set: (patch: Partial<UserSettings>) => {
    const next = { ...userSettingsStore.get(), ...patch }
    safeSet(USER_SETTINGS_KEY, next)
    tryPush(uid => sync.upsertUserSettings(uid, next))
  },

  /** Used during syncAll — writes remote value without re-triggering a push */
  importFromRemote: (s: UserSettings) => safeSet(USER_SETTINGS_KEY, s),
}

export function useUserSettingsStore() {
  return userSettingsStore
}

// ── Body stats (weight, body fat, TDEE etc.) ─────────────────────

const BODY_STATS_DEFAULTS: UserBodyStats = {
  weightKg: 0,
  heightM: 0,
  age: 0,
  biologicalSex: '',
  waistCm: 0,
  glutesCm: 0,
  measurementUnit: 'cm',
  bodyFatPct: 0,
  cycleType: 'none',
  equipment: '',
  chronotype: '',
  fatLossRateKg: 0,
  macroSplit: 'balanced',
  tdeeKcal: 0,
  kcalTarget: 0,
  protRange: '',
  fatLossGoal: '',
}

export const bodyStatsStore = {
  get: (): UserBodyStats => safeGet<UserBodyStats>(BODY_STATS_KEY, BODY_STATS_DEFAULTS),

  set: (patch: Partial<UserBodyStats>) => {
    const next = { ...bodyStatsStore.get(), ...patch }
    safeSet(BODY_STATS_KEY, next)
    tryPush(uid => sync.upsertUserBodyStats(uid, next))
  },

  /** Used during syncAll — writes remote value without re-triggering a push */
  importFromRemote: (s: UserBodyStats) => safeSet(BODY_STATS_KEY, s),
}

export function useBodyStatsStore() {
  return bodyStatsStore
}

// ── Workout plan (user_workout_plans JSONB) ─────────────────────

export const workoutPlanStore = {
  get: (): UserWorkoutPlan | null => safeGet<UserWorkoutPlan | null>(WORKOUT_PLAN_KEY, null),

  set: (plan: UserWorkoutPlan) => {
    safeSet(WORKOUT_PLAN_KEY, plan)
    tryPush(uid => sync.upsertUserWorkoutPlan(uid, plan))
  },

  /** Used during syncAll — writes remote value without re-triggering a push */
  importFromRemote: (p: UserWorkoutPlan) => safeSet(WORKOUT_PLAN_KEY, p),
}

export function useWorkoutPlanStore() {
  return workoutPlanStore
}

// ── Reminders ── persistent cross-day checklist ───────────────────
export const remindersStore = {
  getAll: (): Reminder[] => safeGet<Reminder[]>(REMINDERS_KEY, []),
  save: (arr: Reminder[]) => safeSet(REMINDERS_KEY, arr),

  add: (r: Reminder) => remindersStore.save([...remindersStore.getAll(), r]),

  update: (id: string, patch: Partial<Reminder>) =>
    remindersStore.save(remindersStore.getAll().map(r => (r.id === id ? { ...r, ...patch } : r))),

  remove: (id: string) => remindersStore.save(remindersStore.getAll().filter(r => r.id !== id)),
}

// ── React hook wrappers (same object, named for clarity in components) ──
export function useTrackerStore() {
  return trackerStore
}
export function useRecipeStore() {
  return recipeStore
}
export function useGroceryStore() {
  return groceryStore
}
export function useFoodLibraryStore() {
  return foodLibraryStore
}
export function useRemindersStore() {
  return remindersStore
}
export function useGroceryCatalogStore() {
  return groceryCatalogStore
}
export function useHiddenRecipeStore() {
  return hiddenRecipeStore
}

// ── Merge remote data into localStorage without triggering another push ──
export function importRemoteData(remote: {
  tracker?: Record<string, DayData>
  recipes?: Recipe[]
  tags?: string[]
  grocery?: string[]
  foodLibrary?: QuickFood[]
  schedule?: CustomBlock[]
  weekSchedule?: WeekSchedule
  medGuides?: MedGuide[]
  groceryCatalog?: GroceryCatalogItem[]
  reminders?: Reminder[]
}) {
  if (remote.tracker !== undefined) safeSet(TRACKER_KEY, remote.tracker)
  if (remote.recipes !== undefined) safeSet(RECIPES_KEY, remote.recipes)
  if (remote.tags !== undefined) safeSet(TAGS_KEY, remote.tags)
  if (remote.grocery !== undefined) safeSet(GROCERY_KEY, remote.grocery)
  if (remote.foodLibrary !== undefined) safeSet(FOOD_LIBRARY_KEY, remote.foodLibrary)
  if (remote.schedule !== undefined) safeSet(SCHEDULE_KEY, remote.schedule)
  if (remote.weekSchedule !== undefined) safeSet(WEEK_SCHEDULE_KEY, remote.weekSchedule)
  if (remote.medGuides !== undefined) safeSet(MED_GUIDES_KEY, remote.medGuides)
  if (remote.groceryCatalog !== undefined) safeSet(GROCERY_CATALOG_KEY, remote.groceryCatalog)
  if (remote.reminders !== undefined) safeSet(REMINDERS_KEY, remote.reminders)
}

// ── Full export / import (JSON backup) ───────────────────────────
// Versions importAllData accepts. v2 added reminders, medGuides, bodyStats and
// workoutPlan; v1 backups still import cleanly because every key is optional.
const BACKUP_VERSION = 'whub_v2'
const SUPPORTED_BACKUP_VERSIONS = ['whub_v1', 'whub_v2']

export function exportAllData() {
  return {
    tracker: safeGet(TRACKER_KEY, {}),
    customRecipes: safeGet<Recipe[]>(RECIPES_KEY, []),
    customTags: safeGet<string[]>(TAGS_KEY, []),
    groceryChecked: safeGet<string[]>(GROCERY_KEY, []),
    foodLibrary: safeGet<QuickFood[]>(FOOD_LIBRARY_KEY, []),
    groceryCatalog: safeGet<GroceryCatalogItem[]>(GROCERY_CATALOG_KEY, []),
    hiddenRecipes: safeGet<number[]>(HIDDEN_RECIPES_KEY, []),
    userSettings: safeGet<UserSettings>(USER_SETTINGS_KEY, USER_SETTINGS_DEFAULTS),
    weekSchedule: safeGet(WEEK_SCHEDULE_KEY, null),
    reminders: safeGet<Reminder[]>(REMINDERS_KEY, []),
    medGuides: safeGet<MedGuide[] | null>(MED_GUIDES_KEY, null),
    bodyStats: safeGet<UserBodyStats>(BODY_STATS_KEY, BODY_STATS_DEFAULTS),
    workoutPlan: safeGet<UserWorkoutPlan | null>(WORKOUT_PLAN_KEY, null),
    exportedAt: new Date().toISOString(),
    version: BACKUP_VERSION,
  }
}

export function importAllData(json: string): boolean {
  try {
    const data = JSON.parse(json)
    if (!SUPPORTED_BACKUP_VERSIONS.includes(data.version)) throw new Error('bad version')
    if (data.tracker) safeSet(TRACKER_KEY, data.tracker)
    if (data.customRecipes) safeSet(RECIPES_KEY, data.customRecipes)
    if (data.customTags) safeSet(TAGS_KEY, data.customTags)
    if (data.groceryChecked) safeSet(GROCERY_KEY, data.groceryChecked)
    if (data.foodLibrary) safeSet(FOOD_LIBRARY_KEY, data.foodLibrary)
    if (data.groceryCatalog) safeSet(GROCERY_CATALOG_KEY, data.groceryCatalog)
    if (data.hiddenRecipes) safeSet(HIDDEN_RECIPES_KEY, data.hiddenRecipes)
    if (data.userSettings) safeSet(USER_SETTINGS_KEY, data.userSettings)
    if (data.weekSchedule) safeSet(WEEK_SCHEDULE_KEY, data.weekSchedule)
    else if (data.schedule) safeSet(SCHEDULE_KEY, data.schedule)
    if (data.reminders) safeSet(REMINDERS_KEY, data.reminders)
    if (data.medGuides) safeSet(MED_GUIDES_KEY, data.medGuides)
    if (data.bodyStats) safeSet(BODY_STATS_KEY, data.bodyStats)
    if (data.workoutPlan) safeSet(WORKOUT_PLAN_KEY, data.workoutPlan)
    return true
  } catch {
    return false
  }
}
