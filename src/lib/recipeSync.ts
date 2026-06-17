/**
 * Pure merge logic for custom recipes (no I/O), shared by the sync flow and
 * tested in isolation.
 *
 * The recipe id doubles as a tombstone:
 *  - A real (small, BIGSERIAL) DB id that is absent from a SUCCESSFUL DB fetch
 *    means the recipe was deleted on another device → prune it locally instead
 *    of re-pushing it (no resurrection of deleted recipes).
 *  - A placeholder id (Date.now(), ~1.7e12) was generated locally and never
 *    synced → push it so the DB assigns a real id.
 *  - For an id present in both, the DB row wins.
 *
 * IMPORTANT: only call mergeRecipes when the DB fetch actually succeeded. An
 * empty array from a *failed* fetch would otherwise prune every synced recipe.
 */
import type { Recipe } from '../data/recipes'

/** BIGSERIAL ids are small; locally-generated Date.now() placeholders are ~1.7e12. */
export const PLACEHOLDER_ID_MIN = 1e12

export function isPlaceholderId(id: number | undefined | null): boolean {
  return id != null && id >= PLACEHOLDER_ID_MIN
}

export interface RecipeMergeResult {
  /** Custom recipes to persist to localStorage + render (DB rows + local-only). */
  merged: Recipe[]
  /** Local-only, never-synced recipes that must be pushed to the DB. */
  toPush: Recipe[]
  /** Real DB ids found locally but absent from the DB — deleted on another device. */
  prunedIds: number[]
}

export function mergeRecipes(local: Recipe[], db: Recipe[]): RecipeMergeResult {
  const dbIds = new Set(db.map(r => r.id))
  const localOnly = local.filter(r => r.id != null && !dbIds.has(r.id))

  // Never-synced local recipes (placeholder id) → push and keep.
  const toPush = localOnly.filter(r => r.custom && isPlaceholderId(r.id))
  // Real DB ids missing from the DB fetch → deleted elsewhere → drop locally.
  const prunedIds = localOnly.filter(r => !isPlaceholderId(r.id)).map(r => r.id as number)

  // DB rows win; keep genuinely-local recipes so they stay visible while syncing.
  const merged = [...db, ...toPush]
  return { merged, toPush, prunedIds }
}

/** Apply an old-id → new-id map (from a push) across a recipe list. */
export function applyIdMap(recipes: Recipe[], idMap: Map<number, number>): Recipe[] {
  if (!idMap.size) return recipes
  return recipes.map(r => (r.id != null && idMap.has(r.id) ? { ...r, id: idMap.get(r.id)! } : r))
}
