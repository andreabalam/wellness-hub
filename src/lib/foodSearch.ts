import type { NutriInfo } from '../data/grocery'
import { supabase } from './supabase'

const USDA_BASE = 'https://api.nal.usda.gov/fdc/v1'

interface USDANutrient {
  nutrientId: number
  value: number
}

interface USDAFood {
  description?: string
  servingSize?: number
  servingSizeUnit?: string
  foodNutrients: USDANutrient[]
}

interface USDASearchResponse {
  foods?: USDAFood[]
}

function get(nutrients: USDANutrient[], id: number): number {
  return nutrients.find(n => n.nutrientId === id)?.value ?? 0
}

function r1(n: number): number {
  return Math.round(n * 10) / 10
}

/** One USDA search result with per-serving macros. */
export interface UsdaFoodHit {
  name: string
  srv: string
  k: number; p: number; c: number; f: number; fi: number
}

function toHit(food: USDAFood): UsdaFoodHit {
  const scale = food.servingSize ? food.servingSize / 100 : 1
  const srv = food.servingSize
    ? `${food.servingSize}${(food.servingSizeUnit ?? 'g').toLowerCase()}`
    : '100g'
  const ns = food.foodNutrients
  return {
    name: food.description ?? '',
    srv,
    k: Math.round(get(ns, 1008) * scale),
    p: r1(get(ns, 1003) * scale),
    c: r1(get(ns, 1005) * scale),
    f: r1(get(ns, 1004) * scale),
    fi: r1(get(ns, 1079) * scale),
  }
}

// USDA FoodData Central — Foundation and SR Legacy foods return nutrients per 100 g.
// Docs: https://api.nal.usda.gov/fdc/v1/foods/search
export async function searchUSDAFoods(query: string, signal?: AbortSignal): Promise<UsdaFoodHit[]> {
  const apiKey = (import.meta.env.VITE_USDA_API_KEY as string | undefined) || 'DEMO_KEY'
  const url = `${USDA_BASE}/foods/search?` + new URLSearchParams({
    query,
    api_key: apiKey,
    pageSize: '5',
    dataType: 'Foundation,SR Legacy',
  })

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`USDA ${res.status}`)

  const data: USDASearchResponse = await res.json()
  if (!data.foods?.length) return []
  return data.foods.map(toHit)
}

/** Best USDA match as NutriInfo (grocery panel), or null when nothing matches. */
export async function searchUSDA(query: string, signal?: AbortSignal): Promise<NutriInfo | null> {
  const hits = await searchUSDAFoods(query, signal)
  if (!hits.length) return null
  const h = hits[0]
  return {
    srv: h.srv,
    cal: h.k,
    p:   h.p,
    c:   h.c,
    f:   h.f,
    fi:  h.fi > 0 ? h.fi : undefined,
  }
}

// ── AI macro estimation (estimate-food-macros Edge Function) ──────

export interface AiFoodEstimate {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

/**
 * Ask the estimate-food-macros Edge Function (Claude Haiku) for per-serving
 * macros of a free-form food/dish name. Requires a signed-in user — the
 * function verifies the JWT. Returns null when unavailable or unparseable.
 *
 * Without a configured Supabase client (no env), falls back to a same-origin
 * request so dev setups and tests can proxy or intercept it; with nothing
 * listening there it fails → null, and the UI shows the retry row.
 */
export async function estimateFoodMacros(name: string): Promise<AiFoodEstimate | null> {
  try {
    if (supabase) {
      const { data, error } = await supabase.functions.invoke('estimate-food-macros', {
        body: { name },
      })
      if (error || !data?.estimate) return null
      return data.estimate as AiFoodEstimate
    }
    const res = await fetch('/functions/v1/estimate-food-macros', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    if (!res.ok) return null
    const data = await res.json().catch(() => null)
    return (data?.estimate as AiFoodEstimate) ?? null
  } catch {
    return null
  }
}
