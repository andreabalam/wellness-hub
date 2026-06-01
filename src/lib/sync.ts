/**
 * All Supabase I/O — pure push/pull, no localStorage access.
 * Call sites are responsible for reading from / writing to the stores.
 */
import { supabase } from './supabase'
import type { DayData, QuickFood } from '../data/tracker'
import type { Recipe } from '../data/recipes'
import type { CustomBlock } from '../data/schedule'
import type { GroceryItem, GroceryCatalogItem } from '../data/grocery'
import type { Reminder } from '../data/reminders'
import type { WorkoutWeek } from '../data/workouts'

// ── Tracker days ─────────────────────────────────────────────────

export async function pushDay(userId: string, date: string, data: DayData) {
  await supabase!
    .from('tracker_days')
    .upsert({ user_id: userId, date, data, updated_at: new Date().toISOString() })
}

export async function pullAllDays(userId: string): Promise<Record<string, DayData>> {
  const { data, error } = await supabase!
    .from('tracker_days')
    .select('date, data')
    .eq('user_id', userId)
  if (error || !data) return {}
  return Object.fromEntries(data.map(r => [r.date as string, r.data as DayData]))
}

// ── Built-in recipes (public recipes table) ───────────────────────

/** Map a DB row (snake_case) → Recipe (camelCase) */
function rowToRecipe(row: Record<string, unknown>): Recipe {
  const source = (row.source ?? 'builtin') as Recipe['source']
  return {
    id:        row.id as number,
    cat:       row.cat as string,
    type:      row.type as string,
    color:     row.color as string,
    sc:        row.sc as string,
    name:      row.name as string,
    tag:       row.tag as string,
    prepL:     row.prep_l as string,
    prepC:     row.prep_c as string,
    prepTime:  row.prep_time as string | undefined,
    healthTag: row.health_tag as Recipe['healthTag'],
    image:     row.image as string | undefined,
    link:      row.link as string | undefined,
    hk:        row.hk as number,
    hp:        row.hp as string,
    hc:        row.hc as string,
    hf:        row.hf as string,
    hfi:       row.hfi as string | undefined,
    mk:        row.mk as number,
    mp:        row.mp as string,
    mc:        row.mc as string,
    mf:        row.mf as string,
    ings:      row.ings as Recipe['ings'],
    steps:     row.steps as string[],
    tip:       row.tip as string,
    custom:    source === 'user',
    source,
  }
}

/** Fetch all built-in recipes (user_id IS NULL). Returns null if unavailable. */
export async function fetchBuiltinRecipes(): Promise<Recipe[] | null> {
  const { data, error } = await supabase!
    .from('recipes')
    .select('*')
    .is('user_id', null)
    .order('id')
  if (error || !data) return null
  return data.map(rowToRecipe)
}

/** Fetch this user's custom recipes from the recipes table. */
export async function fetchUserRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase!
    .from('recipes')
    .select('*')
    .eq('user_id', userId)
    .eq('custom', true)
    .order('id')
  if (error || !data) return []
  return data.map(rowToRecipe)
}

/** Insert or update a custom recipe for the logged-in user. Returns the DB id. */
export async function upsertUserRecipe(userId: string, r: Recipe): Promise<number | null> {
  const payload = {
    cat: r.cat, type: r.type, color: r.color, sc: r.sc, name: r.name,
    tag: r.tag, prep_l: r.prepL, prep_c: r.prepC,
    prep_time: r.prepTime ?? null, health_tag: r.healthTag ?? null,
    image: r.image ?? null, link: r.link ?? null,
    hk: r.hk, hp: r.hp, hc: r.hc, hf: r.hf, hfi: r.hfi ?? null,
    mk: r.mk, mp: r.mp, mc: r.mc, mf: r.mf,
    ings: r.ings, steps: r.steps, tip: r.tip,
    custom: true, source: 'user', user_id: userId,
    updated_at: new Date().toISOString(),
  }
  const { data, error } = await supabase!
    .from('recipes')
    .upsert(payload, { onConflict: 'id' })
    .select('id')
    .single()
  if (error || !data) return null
  return data.id as number
}

/** Hard-delete a custom recipe by DB id. */
export async function deleteUserRecipe(recipeId: number): Promise<void> {
  await supabase!.from('recipes').delete().eq('id', recipeId)
}


// ── Custom tags ───────────────────────────────────────────────────

export async function pushTags(userId: string, tags: string[]) {
  await supabase!
    .from('custom_tags')
    .upsert({ user_id: userId, tags, updated_at: new Date().toISOString() })
}

export async function pullTags(userId: string): Promise<string[]> {
  const { data } = await supabase!
    .from('custom_tags')
    .select('tags')
    .eq('user_id', userId)
    .single()
  return (data?.tags as string[]) ?? []
}

// ── Grocery ───────────────────────────────────────────────────────

export async function pushGrocery(userId: string, checked: string[]) {
  await supabase!
    .from('grocery_checked')
    .upsert({ user_id: userId, checked, updated_at: new Date().toISOString() })
}

export async function pullGrocery(userId: string): Promise<string[]> {
  const { data } = await supabase!
    .from('grocery_checked')
    .select('checked')
    .eq('user_id', userId)
    .single()
  return (data?.checked as string[]) ?? []
}

// ── Food library ──────────────────────────────────────────────────

export async function pushFoodLibrary(userId: string, library: QuickFood[]) {
  await supabase!
    .from('food_library')
    .upsert({ user_id: userId, library, updated_at: new Date().toISOString() })
}

export async function pullFoodLibrary(userId: string): Promise<QuickFood[]> {
  const { data } = await supabase!
    .from('food_library')
    .select('library')
    .eq('user_id', userId)
    .single()
  return (data?.library as QuickFood[]) ?? []
}

// ── Schedule blocks (per user) ────────────────────────────────────

export async function pushSchedule(userId: string, blocks: CustomBlock[]) {
  await supabase!
    .from('schedule_blocks')
    .upsert({ user_id: userId, blocks, updated_at: new Date().toISOString() })
}

export async function pullSchedule(userId: string): Promise<CustomBlock[] | null> {
  const { data } = await supabase!
    .from('schedule_blocks')
    .select('blocks')
    .eq('user_id', userId)
    .single()
  return data ? (data.blocks as CustomBlock[]) : null
}

// ── Meditation guides (per user) ─────────────────────────────────

export interface MedGuide { title: string; url: string }

export async function pushMedGuides(userId: string, guides: MedGuide[]) {
  await supabase!
    .from('med_guides')
    .upsert({ user_id: userId, guides, updated_at: new Date().toISOString() })
}

export async function pullMedGuides(userId: string): Promise<MedGuide[] | null> {
  const { data } = await supabase!
    .from('med_guides')
    .select('guides')
    .eq('user_id', userId)
    .single()
  return data ? (data.guides as MedGuide[]) : null
}

// ── Reminders ──────────────────────────────────────────────────────
export async function fetchReminders(userId: string): Promise<Reminder[]> {
  const { data, error } = await supabase!
    .from('reminders')
    .select('id, text, checked, checked_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(r => ({
    id:        r.id as string,
    text:      r.text as string,
    checked:   r.checked as boolean,
    checkedAt: r.checked_at as string | null,
    createdAt: r.created_at as string,
  }))
}

export async function upsertReminder(userId: string, r: Reminder): Promise<string | null> {
  const { error } = await supabase!
    .from('reminders')
    .upsert({
      id:         r.id,
      user_id:    userId,
      text:       r.text,
      checked:    r.checked,
      checked_at: r.checkedAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' })
  return error ? error.message : null
}

export async function deleteReminder(reminderId: string): Promise<void> {
  await supabase!.from('reminders').delete().eq('id', reminderId)
}

// ── User grocery catalog (per-user CRUD) ─────────────────────────

export async function pushUserGroceryCatalog(userId: string, items: GroceryCatalogItem[]) {
  await supabase!
    .from('user_grocery_catalog')
    .upsert({ user_id: userId, items, updated_at: new Date().toISOString() })
}

export async function pullUserGroceryCatalog(userId: string): Promise<GroceryCatalogItem[] | null> {
  const { data } = await supabase!
    .from('user_grocery_catalog')
    .select('items')
    .eq('user_id', userId)
    .single()
  return data ? (data.items as GroceryCatalogItem[]) : null
}

// ── Grocery catalog (shared, public read) ─────────────────────────
// Returns the full item catalog ordered by sort_order, or null if unavailable.

export async function pullGroceryCatalog(): Promise<Record<string, GroceryItem[]> | null> {
  const { data, error } = await supabase!
    .from('grocery_catalog')
    .select('category, items')
    .order('sort_order')
  if (error || !data?.length) return null
  return Object.fromEntries(
    data.map(r => [r.category as string, r.items as GroceryItem[]])
  )
}

// ── User settings (macro targets + cognitive peak) ─────────────────────────

export interface UserSettings {
  kcalTarget:         number
  protTarget:         number
  carbTarget:         number
  fatTarget:          number
  fiberTarget:        number
  macroSplit:         'balanced' | 'high_protein' | 'low_carb' | 'custom'
  cognitivePeakStart: string   // "HH:MM" 24-h
  cognitivePeakEnd:   string
}

export async function fetchUserSettings(userId: string): Promise<UserSettings | null> {
  const { data, error } = await supabase!
    .from('user_settings')
    .select('kcal_target, prot_target, carb_target, fat_target, fiber_target, macro_split, cognitive_peak_start, cognitive_peak_end')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    kcalTarget:         data.kcal_target          as number,
    protTarget:         data.prot_target          as number,
    carbTarget:         data.carb_target          as number,
    fatTarget:          data.fat_target           as number,
    fiberTarget:        data.fiber_target         as number,
    macroSplit:         data.macro_split          as UserSettings['macroSplit'],
    cognitivePeakStart: data.cognitive_peak_start as string,
    cognitivePeakEnd:   data.cognitive_peak_end   as string,
  }
}

export async function upsertUserSettings(userId: string, s: UserSettings): Promise<void> {
  await supabase!.from('user_settings').upsert({
    user_id:              userId,
    kcal_target:          s.kcalTarget,
    prot_target:          s.protTarget,
    carb_target:          s.carbTarget,
    fat_target:           s.fatTarget,
    fiber_target:         s.fiberTarget,
    macro_split:          s.macroSplit,
    cognitive_peak_start: s.cognitivePeakStart,
    cognitive_peak_end:   s.cognitivePeakEnd,
    updated_at:           new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ── User body stats ─────────────────────────────────────────────────

export interface UserBodyStats {
  weightKg:    number
  bodyFatPct:  number
  heightM:     number
  cycleType:   'regular' | 'irregular' | 'none'
  equipment:   string
  tdeeKcal:    number
  kcalTarget:  number
  protRange:   string
  fatLossGoal: string
  chronotype:  'early' | 'intermediate' | 'late'
}

export async function fetchUserBodyStats(userId: string): Promise<UserBodyStats | null> {
  const { data, error } = await supabase!
    .from('user_body_stats')
    .select('weight_kg, body_fat_pct, height_m, cycle_type, equipment, tdee_kcal, kcal_target, prot_range, fat_loss_goal, chronotype')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    weightKg:    data.weight_kg     as number,
    bodyFatPct:  data.body_fat_pct  as number,
    heightM:     data.height_m      as number,
    cycleType:   data.cycle_type    as UserBodyStats['cycleType'],
    equipment:   data.equipment     as string,
    tdeeKcal:    data.tdee_kcal     as number,
    kcalTarget:  data.kcal_target   as number,
    protRange:   data.prot_range    as string,
    fatLossGoal: data.fat_loss_goal as string,
    chronotype:  data.chronotype    as UserBodyStats['chronotype'],
  }
}

export async function upsertUserBodyStats(userId: string, s: UserBodyStats): Promise<void> {
  await supabase!.from('user_body_stats').upsert({
    user_id:       userId,
    weight_kg:     s.weightKg,
    body_fat_pct:  s.bodyFatPct,
    height_m:      s.heightM,
    cycle_type:    s.cycleType,
    equipment:     s.equipment,
    tdee_kcal:     s.tdeeKcal,
    kcal_target:   s.kcalTarget,
    prot_range:    s.protRange,
    fat_loss_goal: s.fatLossGoal,
    chronotype:    s.chronotype,
    updated_at:    new Date().toISOString(),
  }, { onConflict: 'user_id' })
}

// ── User workout plan ─────────────────────────────────────────────────

export interface UserWorkoutPlan {
  gender:   'female' | 'male'
  numWeeks: number
  planData: WorkoutWeek[]
}

export async function fetchUserWorkoutPlan(userId: string): Promise<UserWorkoutPlan | null> {
  const { data, error } = await supabase!
    .from('user_workout_plans')
    .select('gender, num_weeks, plan_data')
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return {
    gender:   data.gender    as 'female' | 'male',
    numWeeks: data.num_weeks  as number,
    planData: data.plan_data  as WorkoutWeek[],
  }
}

export async function upsertUserWorkoutPlan(userId: string, plan: UserWorkoutPlan): Promise<void> {
  await supabase!.from('user_workout_plans').upsert({
    user_id:    userId,
    gender:     plan.gender,
    num_weeks:  plan.numWeeks,
    plan_data:  plan.planData,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' })
}
