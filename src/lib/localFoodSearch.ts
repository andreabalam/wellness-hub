/**
 * Local-first food search for the tracker's log-food input.
 * Searches the personal food library, tracker history, saved recipes,
 * and built-in quick foods. Pure functions — no I/O.
 */
import type { QuickFood, DayData } from '../data/tracker'
import type { Recipe } from '../data/recipes'

export interface LocalFoodHit extends QuickFood {
  source: 'library' | 'history' | 'recipe' | 'builtin'
  /** Set when the hit comes from a recipe — stored as FoodEntry.r on log */
  recipeId?: number
}

export interface LocalSearchSources {
  library: QuickFood[]
  history: QuickFood[]
  recipes: Recipe[]
  quickFoods: QuickFood[]
}

export const MAX_HITS = 12

/** Parse a macro string like "32g" / "32 g" / "12.5g" → number. 0 when unparseable. */
export function parseMacro(s: string | undefined | null): number {
  if (!s) return 0
  const m = String(s).match(/[\d.]+/)
  return m ? parseFloat(m[0]) || 0 : 0
}

/**
 * Per-serving macros for a recipe — healthy variant (hk/hp/hc/hf/hfi) unless
 * the recipe is tagged indulgent, then the indulgent variant (mk/mp/mc/mf).
 * Returns null when the recipe has no usable calorie value.
 */
export function recipeToHit(r: Recipe): LocalFoodHit | null {
  const indulgent = r.healthTag === 'indulgent'
  const k = indulgent ? r.mk : r.hk
  if (!k || k <= 0) return null
  return {
    source: 'recipe',
    ...(r.id != null ? { recipeId: r.id } : {}),
    n: r.name,
    k: Math.round(k),
    p: Math.round(parseMacro(indulgent ? r.mp : r.hp)),
    c: Math.round(parseMacro(indulgent ? r.mc : r.hc)),
    f: Math.round(parseMacro(indulgent ? r.mf : r.hf)),
    fi: indulgent ? 0 : Math.round(parseMacro(r.hfi)),
  }
}

/** All unique foods ever logged, newest first, normalized to per-serving values. */
export function historyFoods(days: Record<string, DayData>): QuickFood[] {
  const sorted = Object.entries(days).sort(([a], [b]) => b.localeCompare(a))
  const seen = new Set<string>()
  const result: QuickFood[] = []
  for (const [, d] of sorted) {
    for (const food of [...d.foods].reverse()) {
      const key = food.n.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      const s = food.s && food.s > 0 ? food.s : 1
      result.push({
        n: food.n,
        k: Math.round(food.k / s), p: Math.round(food.p / s),
        c: Math.round(food.c / s), f: Math.round(food.f / s),
        fi: Math.round(food.fi / s),
      })
    }
  }
  return result
}

const SOURCE_RANK: Record<LocalFoodHit['source'], number> = {
  library: 0, history: 1, recipe: 2, builtin: 3,
}

/**
 * Case-insensitive substring search across all local sources.
 * Prefix matches rank first, then source priority (library/history →
 * recipe → builtin). Deduped by name — the higher-priority source wins.
 */
export function searchLocalFoods(query: string, src: LocalSearchSources): LocalFoodHit[] {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return []

  const candidates: LocalFoodHit[] = [
    ...src.library.map(f => ({ ...f, source: 'library' as const })),
    ...src.history.map(f => ({ ...f, source: 'history' as const })),
    ...src.recipes.filter(r => !r.hidden).map(recipeToHit)
      .filter((h): h is LocalFoodHit => h !== null),
    ...src.quickFoods.map(f => ({ ...f, source: 'builtin' as const })),
  ]

  const seen = new Set<string>()
  const hits: LocalFoodHit[] = []
  for (const cand of candidates) {
    const name = cand.n.toLowerCase()
    if (!name.includes(q) || seen.has(name)) continue
    seen.add(name)
    hits.push(cand)
  }

  hits.sort((a, b) => {
    const aPre = a.n.toLowerCase().startsWith(q) ? 0 : 1
    const bPre = b.n.toLowerCase().startsWith(q) ? 0 : 1
    if (aPre !== bPre) return aPre - bPre
    if (SOURCE_RANK[a.source] !== SOURCE_RANK[b.source]) {
      return SOURCE_RANK[a.source] - SOURCE_RANK[b.source]
    }
    return a.n.localeCompare(b.n)
  })
  return hits.slice(0, MAX_HITS)
}
