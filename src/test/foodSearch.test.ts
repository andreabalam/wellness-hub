import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the supabase client so estimateFoodMacros tests are deterministic
// regardless of whether .env.local exists on the machine running them.
const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: mockInvoke } },
}))

import { searchUSDA, searchUSDAFoods, estimateFoodMacros } from '../lib/foodSearch'

beforeEach(() => { vi.unstubAllGlobals(); mockInvoke.mockReset() })

// ── helpers ───────────────────────────────────────────────────────

const NUTRIENTS_100G = [
  { nutrientId: 1008, value: 200 },   // energy kcal
  { nutrientId: 1003, value: 10 },    // protein
  { nutrientId: 1005, value: 30 },    // carbs
  { nutrientId: 1004, value: 5 },     // fat
  { nutrientId: 1079, value: 8 },     // fiber
]

function mockUSDA(foods: unknown[]) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: vi.fn().mockResolvedValue({ foods }),
  }))
}

// ── searchUSDA ────────────────────────────────────────────────────

describe('searchUSDA', () => {
  it('returns null when API returns empty foods array', async () => {
    mockUSDA([])
    expect(await searchUSDA('ghost food')).toBeNull()
  })

  it('returns null when foods key is absent from response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    }))
    expect(await searchUSDA('anything')).toBeNull()
  })

  it('returns NutriInfo per 100 g when no servingSize provided', async () => {
    mockUSDA([{ foodNutrients: NUTRIENTS_100G }])
    expect(await searchUSDA('chicken')).toEqual({
      srv: '100g', cal: 200, p: 10, c: 30, f: 5, fi: 8,
    })
  })

  it('scales nutrients by serving size', async () => {
    mockUSDA([{
      servingSize: 50, servingSizeUnit: 'G',
      foodNutrients: NUTRIENTS_100G,
    }])
    const result = await searchUSDA('bread')
    expect(result).toMatchObject({ srv: '50g', cal: 100, p: 5, c: 15, f: 2.5, fi: 4 })
  })

  it('omits fiber when the USDA value is zero', async () => {
    const noFiber = NUTRIENTS_100G.map(n => n.nutrientId === 1079 ? { ...n, value: 0 } : n)
    mockUSDA([{ foodNutrients: noFiber }])
    const result = await searchUSDA('sugar')
    expect(result?.fi).toBeUndefined()
  })

  it('rounds calories to integer and macros to one decimal', async () => {
    mockUSDA([{
      servingSize: 33,
      foodNutrients: [
        { nutrientId: 1008, value: 300 },   // 99 kcal — rounds to 99
        { nutrientId: 1003, value: 25.33 }, // 8.359 → 8.4
        { nutrientId: 1005, value: 10 },
        { nutrientId: 1004, value: 9 },
        { nutrientId: 1079, value: 3 },
      ],
    }])
    const result = await searchUSDA('test')
    expect(result?.cal).toBe(99)
    expect(result?.p).toBe(8.4)
  })

  it('throws with USDA status code when fetch returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(searchUSDA('test')).rejects.toThrow('USDA 403')
  })

  it('passes abort signal through to fetch', async () => {
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue({ foods: [] }),
    })
    vi.stubGlobal('fetch', mockFetchFn)
    const signal = new AbortController().signal
    await searchUSDA('test', signal)
    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.stringContaining('foods/search'),
      expect.objectContaining({ signal }),
    )
  })

  it('includes query in the request URL', async () => {
    const mockFetchFn = vi.fn().mockResolvedValue({
      ok: true, json: vi.fn().mockResolvedValue({ foods: [] }),
    })
    vi.stubGlobal('fetch', mockFetchFn)
    await searchUSDA('brown rice')
    expect(mockFetchFn).toHaveBeenCalledWith(
      expect.stringContaining('brown+rice'),
      expect.anything(),
    )
  })
})

// ── searchUSDAFoods ───────────────────────────────────────────────

describe('searchUSDAFoods', () => {
  it('returns empty array when API has no matches', async () => {
    mockUSDA([])
    expect(await searchUSDAFoods('ghost food')).toEqual([])
  })

  it('maps every returned food with its description as name', async () => {
    mockUSDA([
      { description: 'Chicken, broiler, breast', foodNutrients: NUTRIENTS_100G },
      { description: 'Chicken, thigh', servingSize: 50, foodNutrients: NUTRIENTS_100G },
    ])
    const hits = await searchUSDAFoods('chicken')
    expect(hits).toHaveLength(2)
    expect(hits[0]).toEqual({
      name: 'Chicken, broiler, breast', srv: '100g',
      k: 200, p: 10, c: 30, f: 5, fi: 8,
    })
    expect(hits[1]).toMatchObject({ name: 'Chicken, thigh', srv: '50g', k: 100, p: 5 })
  })

  it('throws with USDA status code when fetch returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await expect(searchUSDAFoods('test')).rejects.toThrow('USDA 500')
  })
})

// ── estimateFoodMacros ────────────────────────────────────────────

describe('estimateFoodMacros', () => {
  const ESTIMATE = {
    name: 'Pozole Rojo', kcal: 320, protein: 22, carbs: 28, fat: 14, fiber: 5,
    confidence: 'medium', notes: 'Assumes 1 bowl (~400 g)',
  }

  it('invokes the estimate-food-macros function with the food name', async () => {
    mockInvoke.mockResolvedValue({ data: { estimate: ESTIMATE }, error: null })
    await estimateFoodMacros('pozole')
    expect(mockInvoke).toHaveBeenCalledWith('estimate-food-macros', { body: { name: 'pozole' } })
  })

  it('returns the estimate on success', async () => {
    mockInvoke.mockResolvedValue({ data: { estimate: ESTIMATE }, error: null })
    expect(await estimateFoodMacros('pozole')).toEqual(ESTIMATE)
  })

  it('returns null when the function errors', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'boom' } })
    expect(await estimateFoodMacros('pozole')).toBeNull()
  })

  it('returns null when the response has no estimate', async () => {
    mockInvoke.mockResolvedValue({ data: {}, error: null })
    expect(await estimateFoodMacros('pozole')).toBeNull()
  })
})
