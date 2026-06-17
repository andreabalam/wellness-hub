/**
 * Compute per-serving recipe macros from the ingredient list — no AI.
 * Each ingredient amount is parsed to grams (ingredientAmount.ts), looked up
 * in USDA FoodData Central per 100 g, summed, and divided by servings.
 * Lookups are cached in localStorage so repeat ingredients cost no requests.
 */
import { parseIngredientAmount } from './ingredientAmount'
import { searchUSDAPer100g, type UsdaPer100g } from './foodSearch'
import { safeGet, safeSet } from './storage'

export type ResolutionStatus = 'ok' | 'no-amount' | 'no-match'

export interface IngredientResolution {
  ing: string
  amount: string
  status: ResolutionStatus
  /** Set when status === 'ok' */
  grams?: number
  matchName?: string
  kcal?: number
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
}

export type Per100gLookup = (name: string) => Promise<UsdaPer100g | null>

/**
 * Sum macros across ingredients and divide by servings.
 * Pure orchestration — the lookup is injected (see makeCachedUsdaLookup).
 * Lookup errors propagate so the UI can show a retry row.
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

  for (const [ing, amount] of ings) {
    const parsed = parseIngredientAmount(amount, ing)
    if (!parsed) {
      rows.push({ ing, amount, status: 'no-amount' })
      continue
    }
    const per100 = await lookup(ing)
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
    rows.push({
      ing,
      amount,
      status: 'ok',
      grams: parsed.grams,
      matchName: per100.name,
      kcal: Math.round(per100.k * scale),
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
  }
}

// ── Cached USDA lookup ────────────────────────────────────────────

export const USDA_CACHE_KEY = 'whub_usda_per100g_v1'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
/** Pause between live USDA requests — stays polite under DEMO_KEY rate limits */
const THROTTLE_MS = 150

interface CacheEntry extends UsdaPer100g {
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

/**
 * Build a lookup that checks the localStorage cache before hitting USDA,
 * and throttles consecutive network calls. One instance per calculation —
 * the throttle timestamp is closed over, not global.
 */
export function makeCachedUsdaLookup(signal?: AbortSignal): Per100gLookup {
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

    const per100 = await searchUSDAPer100g(key, signal)
    if (per100) {
      cache[key] = { ...per100, t: Date.now() }
      writeCache(cache)
    }
    return per100
  }
}
