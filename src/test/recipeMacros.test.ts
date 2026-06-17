import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client so importing foodSearch (via recipeMacros) never
// touches a real client regardless of .env.local on the machine running tests.
vi.mock('../lib/supabase', () => ({ supabase: null }))

import { parseIngredientAmount } from '../lib/ingredientAmount'
import {
  computeRecipeMacros,
  makeCachedUsdaLookup,
  USDA_CACHE_KEY,
  type Per100gLookup,
} from '../lib/recipeMacros'
import { searchUSDAPer100g, type UsdaPer100g } from '../lib/foodSearch'

// ── localStorage mock (project convention — jsdom storage is not stubbed globally) ──
const store: Record<string, string> = {}

beforeEach(() => {
  vi.unstubAllGlobals()
  Object.keys(store).forEach(k => delete store[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => {
      store[k] = v
    },
    removeItem: (k: string) => {
      delete store[k]
    },
    clear: () => Object.keys(store).forEach(k => delete store[k]),
  })
})

// ── parseIngredientAmount ─────────────────────────────────────────

describe('parseIngredientAmount', () => {
  it('parses mass units to grams', () => {
    expect(parseIngredientAmount('200g', 'chicken')).toEqual({ grams: 200, method: 'mass' })
    expect(parseIngredientAmount('1 kg', 'potatoes')).toEqual({ grams: 1000, method: 'mass' })
    expect(parseIngredientAmount('4 oz', 'salmon')).toEqual({ grams: 113.4, method: 'mass' })
    expect(parseIngredientAmount('1 lb', 'beef')).toEqual({ grams: 453.6, method: 'mass' })
  })

  it('parses volume units using water-like density by default', () => {
    expect(parseIngredientAmount('1 cup', 'milk')?.grams).toBeCloseTo(240 * 1.03, 0)
    expect(parseIngredientAmount('2 tbsp', 'soy sauce')?.grams).toBe(30)
    expect(parseIngredientAmount('1 tsp', 'vanilla extract')?.grams).toBe(5)
    expect(parseIngredientAmount('250ml', 'water')?.grams).toBe(250)
  })

  it('applies ingredient density for volume conversions', () => {
    expect(parseIngredientAmount('1 cup', 'all-purpose flour')?.grams).toBeCloseTo(240 * 0.53, 0)
    expect(parseIngredientAmount('1 cup', 'rolled oats')?.grams).toBeCloseTo(96, 0)
    expect(parseIngredientAmount('1 tbsp', 'olive oil')?.grams).toBeCloseTo(13.8, 1)
    expect(parseIngredientAmount('1 tbsp', 'honey')?.grams).toBeCloseTo(21.3, 1)
  })

  it('parses fractions: ascii, mixed, and unicode', () => {
    expect(parseIngredientAmount('1/2 cup', 'water')?.grams).toBe(120)
    expect(parseIngredientAmount('1 1/2 cups', 'water')?.grams).toBe(360)
    expect(parseIngredientAmount('½ cup', 'water')?.grams).toBe(120)
    expect(parseIngredientAmount('1½ cups', 'water')?.grams).toBe(360)
  })

  it('takes the midpoint of ranges', () => {
    expect(parseIngredientAmount('1-2 cups', 'water')?.grams).toBe(360)
  })

  it('resolves bare counts via per-piece weights', () => {
    expect(parseIngredientAmount('2', 'eggs')).toEqual({ grams: 100, method: 'piece' })
    expect(parseIngredientAmount('1', 'banana')).toEqual({ grams: 118, method: 'piece' })
  })

  it('applies size adjectives to piece weights', () => {
    expect(parseIngredientAmount('1 large', 'egg')?.grams).toBe(60)
    expect(parseIngredientAmount('2 small', 'bananas')?.grams).toBeCloseTo(188.8, 1)
  })

  it('resolves count-style units independent of name', () => {
    expect(parseIngredientAmount('2 cloves', 'garlic')).toEqual({ grams: 6, method: 'piece' })
    expect(parseIngredientAmount('1 scoop', 'protein powder')).toEqual({
      grams: 30,
      method: 'piece',
    })
  })

  it('treats a unit without a number as quantity 1', () => {
    expect(parseIngredientAmount('cup', 'water')?.grams).toBe(240)
  })

  it('returns null for unmeasurable or unknown amounts', () => {
    expect(parseIngredientAmount('—', 'salt')).toBeNull()
    expect(parseIngredientAmount('to taste', 'pepper')).toBeNull()
    expect(parseIngredientAmount('a pinch', 'nutmeg')).toBeNull()
    expect(parseIngredientAmount('1 bunch', 'cilantro')).toBeNull()
    expect(parseIngredientAmount('2', 'star anise')).toBeNull() // no piece weight
    expect(parseIngredientAmount('', 'salt')).toBeNull()
  })
})

// ── computeRecipeMacros ───────────────────────────────────────────

const OATS: UsdaPer100g = { name: 'Oats, raw', k: 379, p: 13.2, c: 67.7, f: 6.5, fi: 10.1 }
const BANANA: UsdaPer100g = { name: 'Bananas, raw', k: 89, p: 1.1, c: 22.8, f: 0.3, fi: 2.6 }

function stubLookup(map: Record<string, UsdaPer100g | null>): Per100gLookup {
  return async (name: string) => map[name] ?? null
}

describe('computeRecipeMacros', () => {
  it('sums matched ingredients and divides by servings', async () => {
    const res = await computeRecipeMacros(
      [
        ['oats', '100g'],
        ['banana', '2'],
      ],
      2,
      stubLookup({ oats: OATS, banana: BANANA }),
    )
    // oats 100g: 379 kcal · banana 2×118g = 236g: 210 kcal → 589 total / 2
    expect(res.totals.k).toBe(Math.round((379 + 89 * 2.36) / 2))
    expect(res.totals.p).toBe(Math.round((13.2 + 1.1 * 2.36) / 2))
    expect(res.matched).toBe(2)
    expect(res.rows).toHaveLength(2)
    expect(res.rows[0]).toMatchObject({
      status: 'ok',
      grams: 100,
      matchName: 'Oats, raw',
      kcal: 379,
    })
  })

  it('flags unparseable amounts and missing matches without failing', async () => {
    const res = await computeRecipeMacros(
      [
        ['salt', 'to taste'],
        ['mystery sauce', '2 tbsp'],
        ['oats', '50g'],
      ],
      1,
      stubLookup({ oats: OATS }),
    )
    expect(res.rows[0].status).toBe('no-amount')
    expect(res.rows[1].status).toBe('no-match')
    expect(res.rows[2].status).toBe('ok')
    expect(res.matched).toBe(1)
    expect(res.totals.k).toBe(Math.round(379 / 2))
  })

  it('treats servings < 1 as 1', async () => {
    const res = await computeRecipeMacros([['oats', '100g']], 0, stubLookup({ oats: OATS }))
    expect(res.totals.k).toBe(379)
  })

  it('returns matched 0 and zero totals when nothing resolves', async () => {
    const res = await computeRecipeMacros(
      [
        ['x', '—'],
        ['y', '1 cup'],
      ],
      1,
      stubLookup({}),
    )
    expect(res.matched).toBe(0)
    expect(res.totals).toEqual({ k: 0, p: 0, c: 0, f: 0, fi: 0 })
  })

  it('propagates lookup errors', async () => {
    const failing: Per100gLookup = async () => {
      throw new Error('USDA 429')
    }
    await expect(computeRecipeMacros([['oats', '100g']], 1, failing)).rejects.toThrow('USDA 429')
  })
})

// ── makeCachedUsdaLookup ──────────────────────────────────────────

const NUTRIENTS_100G = [
  { nutrientId: 1008, value: 379 },
  { nutrientId: 1003, value: 13.2 },
  { nutrientId: 1005, value: 67.7 },
  { nutrientId: 1004, value: 6.5 },
  { nutrientId: 1079, value: 10.1 },
]

function mockUSDA(foods: unknown[]) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ foods }),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('makeCachedUsdaLookup', () => {
  it('fetches once and serves repeats from the localStorage cache', async () => {
    const fetchMock = mockUSDA([{ description: 'Oats, raw', foodNutrients: NUTRIENTS_100G }])
    const lookup = makeCachedUsdaLookup()

    const first = await lookup('Oats')
    expect(first).toMatchObject({ name: 'Oats, raw', k: 379 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    // same name, different casing/whitespace → cache hit, no new request
    const second = await lookup('  oats ')
    expect(second).toMatchObject({ name: 'Oats, raw', k: 379 })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const cached = JSON.parse(localStorage.getItem(USDA_CACHE_KEY)!)
    expect(cached.oats).toMatchObject({ k: 379 })
  })

  it('does not cache misses', async () => {
    const fetchMock = mockUSDA([])
    const lookup = makeCachedUsdaLookup()
    expect(await lookup('ghost food')).toBeNull()
    expect(await lookup('ghost food')).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(localStorage.getItem(USDA_CACHE_KEY)).toBeNull()
  })
})

// ── searchUSDAPer100g ─────────────────────────────────────────────

describe('searchUSDAPer100g', () => {
  it('returns per-100g macros without serving scaling', async () => {
    mockUSDA([
      {
        description: 'Oats, raw',
        servingSize: 40,
        servingSizeUnit: 'G', // would scale searchUSDAFoods; must NOT scale here
        foodNutrients: NUTRIENTS_100G,
      },
    ])
    expect(await searchUSDAPer100g('oats')).toEqual({
      name: 'Oats, raw',
      k: 379,
      p: 13.2,
      c: 67.7,
      f: 6.5,
      fi: 10.1,
    })
  })

  it('skips hits with no calorie data', async () => {
    mockUSDA([
      { description: 'Water', foodNutrients: [] },
      { description: 'Oats, raw', foodNutrients: NUTRIENTS_100G },
    ])
    expect((await searchUSDAPer100g('oats'))?.name).toBe('Oats, raw')
  })

  it('returns null when nothing matches', async () => {
    mockUSDA([])
    expect(await searchUSDAPer100g('ghost food')).toBeNull()
  })

  it('throws on HTTP errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    await expect(searchUSDAPer100g('oats')).rejects.toThrow('USDA 429')
  })
})
