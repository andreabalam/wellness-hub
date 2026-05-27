/**
 * All Supabase I/O — pure push/pull, no localStorage access.
 * Call sites are responsible for reading from / writing to the stores.
 */
import { supabase } from './supabase'
import type { DayData, QuickFood } from '../data/tracker'
import type { Recipe } from '../data/recipes'

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

// ── Custom recipes ────────────────────────────────────────────────

export async function pushRecipes(userId: string, recipes: Recipe[]) {
  // Replace remote list wholesale — small dataset, simplest correct approach
  await supabase!.from('custom_recipes').delete().eq('user_id', userId)
  if (recipes.length > 0) {
    await supabase!.from('custom_recipes').insert(
      recipes.map(r => ({
        user_id: userId,
        recipe_id: r.id!,
        data: r,
        updated_at: new Date().toISOString(),
      }))
    )
  }
}

export async function pullRecipes(userId: string): Promise<Recipe[]> {
  const { data, error } = await supabase!
    .from('custom_recipes')
    .select('data')
    .eq('user_id', userId)
    .order('recipe_id')
  if (error || !data) return []
  return data.map(r => r.data as Recipe)
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
