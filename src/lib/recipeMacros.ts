/**
 * Compute per-serving recipe macros from the ingredient list — no AI.
 * Each ingredient amount is parsed to grams (ingredientAmount.ts), looked up
 * in USDA FoodData Central per 100 g, summed, and divided by servings.
 * Lookups are cached in localStorage so repeat ingredients cost no requests.
 */
import { parseIngredientAmount } from './ingredientAmount'
import { searchUSDAPer100g, estimateFoodMacros, type UsdaPer100g } from './foodSearch'
import { safeGet, safeSet } from './storage'

export type ResolutionStatus = 'ok' | 'no-amount' | 'no-match' | 'error'

/** Per-100g macros plus the provenance of the figures. */
export interface Per100g extends UsdaPer100g {
  /** True when the macros came from the AI estimator rather than USDA. */
  estimated?: boolean
}

export interface IngredientResolution {
  ing: string
  amount: string
  /** 'error' = the lookup threw (offline / rate-limited) and can be retried. */
  status: ResolutionStatus
  /** Set when status === 'ok' */
  grams?: number
  matchName?: string
  kcal?: number
  /** True when the 'ok' row's macros are an AI estimate, not a USDA match. */
  estimated?: boolean
}

export interface RecipeMacroTotals {
  k: number
  p: number
  c: number
  f: number
  fi: number
}

export interface RecipeMacroResult {
  /** Per-serving, rounded to integers (matches the form fields) */
  totals: RecipeMacroTotals
  rows: IngredientResolution[]
  /** Number of ingredients that contributed to the totals */
  matched: number
  /** Number of lookups that failed (offline / rate-limited) — retryable. */
  errored: number
  /** Number of resolved ingredients whose macros are AI estimates. */
  estimated: number
}

export type Per100gLookup = (name: string) => Promise<Per100g | null>

/**
 * Sum macros across ingredients and divide by servings.
 * Pure orchestration — the lookup is injected (see makeCachedUsdaLookup).
 *
 * A failed lookup (offline or USDA rate limit) is isolated to its own row
 * (status 'error') and never aborts the whole calculation — the ingredients
 * that did resolve still contribute, and the caller can surface a partial
 * result plus a retry hint. This keeps a single 429 from wiping out a recipe.
 */
export async function computeRecipeMacros(
  ings: [string, string][],
  servings: number,
  lookup: Per100gLookup,
): Promise<RecipeMacroResult> {
  const div = servings >= 1 ? servings : 1
  const rows: IngredientResolution[] = []
  let k = 0,
    p = 0,
    c = 0,
    f = 0,
    fi = 0
  let matched = 0
  let errored = 0
  let estimated = 0

  for (const [ing, amount] of ings) {
    const parsed = parseIngredientAmount(amount, ing)
    if (!parsed) {
      rows.push({ ing, amount, status: 'no-amount' })
      continue
    }
    let per100: Per100g | null
    try {
      per100 = await lookup(ing)
    } catch {
      // Network error or USDA rate limit — keep going so other ingredients resolve
      rows.push({ ing, amount, status: 'error' })
      errored++
      continue
    }
    if (!per100) {
      rows.push({ ing, amount, status: 'no-match' })
      continue
    }
    const scale = parsed.grams / 100
    k += per100.k * scale
    p += per100.p * scale
    c += per100.c * scale
    f += per100.f * scale
    fi += per100.fi * scale
    matched++
    if (per100.estimated) estimated++
    rows.push({
      ing,
      amount,
      status: 'ok',
      grams: parsed.grams,
      matchName: per100.name,
      kcal: Math.round(per100.k * scale),
      estimated: per100.estimated,
    })
  }

  return {
    totals: {
      k: Math.round(k / div),
      p: Math.round(p / div),
      c: Math.round(c / div),
      f: Math.round(f / div),
      fi: Math.round(fi / div),
    },
    rows,
    matched,
    errored,
    estimated,
  }
}

// ── Cached USDA lookup ────────────────────────────────────────────

export const USDA_CACHE_KEY = 'whub_usda_per100g_v1'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
/** Pause between live USDA requests — stays polite under DEMO_KEY rate limits */
const THROTTLE_MS = 150

interface CacheEntry extends Per100g {
  t: number
}

function readCache(): Record<string, CacheEntry> {
  return safeGet<Record<string, CacheEntry>>(USDA_CACHE_KEY, {})
}

function writeCache(cache: Record<string, CacheEntry>) {
  safeSet(USDA_CACHE_KEY, cache)
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Treat the AI estimator's per-serving answer for "100 g X" as per-100g macros. */
async function aiPer100g(name: string): Promise<Per100g | null> {
  const est = await estimateFoodMacros(`100 g ${name}`).catch(() => null)
  if (!est) return null
  return {
    name: est.name || name,
    k: Math.round(est.kcal),
    p: Math.round(est.protein),
    c: Math.round(est.carbs),
    f: Math.round(est.fat),
    fi: Math.round(est.fiber),
    estimated: true,
  }
}

/**
 * Build a lookup that checks the localStorage cache before hitting USDA,
 * and throttles consecutive network calls. One instance per calculation —
 * the throttle timestamp is closed over, not global.
 *
 * With `aiFallback`, a USDA miss *or* a USDA failure (offline / rate limit)
 * falls back to the AI estimator instead of returning null / throwing — so the
 * recipe calc still produces macros without a USDA key. Estimated results are
 * flagged (`estimated: true`) and cached like USDA hits. Without the flag the
 * lookup keeps its USDA-only contract: null on no-match, throws on error.
 */
export function makeCachedUsdaLookup(
  signal?: AbortSignal,
  opts: { aiFallback?: boolean } = {},
): Per100gLookup {
  let lastFetch = 0
  return async (name: string) => {
    const key = normalizeName(name)
    const cache = readCache()
    const hit = cache[key]
    if (hit && Date.now() - hit.t < CACHE_TTL_MS) {
      const { t: _t, ...per100 } = hit
      return per100
    }

    const wait = lastFetch + THROTTLE_MS - Date.now()
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    lastFetch = Date.now()

    let per100: Per100g | null
    try {
      per100 = await searchUSDAPer100g(key, signal)
    } catch (err) {
      if (!opts.aiFallback) throw err // preserve USDA-only contract for direct callers
      per100 = await aiPer100g(key) // rate-limited / offline → estimate instead
    }
    if (!per100 && opts.aiFallback) per100 = await aiPer100g(key) // no USDA match → estimate

    if (per100) {
      cache[key] = { ...per100, t: Date.now() }
      writeCache(cache)
    }
    return per100
  }
}
