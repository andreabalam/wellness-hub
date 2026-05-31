/**
 * All Supabase I/O — pure push/pull, no localStorage access.
 * Call sites are responsible for reading from / writing to the stores.
 */
import { supabase } from './supabase'
import type { DayData, QuickFood } from '../data/tracker'
import type { Recipe } from '../data/recipes'
import type { CustomBlock } from '../data/schedule'
import type { GroceryItem } from '../data/grocery'
import type { Reminder } from '../data/reminders'

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
