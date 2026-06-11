import { describe, it, expect } from 'vitest'
import {
  parseMacro, recipeToHit, historyFoods, searchLocalFoods, MAX_HITS,
} from '../lib/localFoodSearch'
import type { LocalSearchSources } from '../lib/localFoodSearch'
import type { Recipe } from '../data/recipes'
import type { DayData, QuickFood } from '../data/tracker'

// ── Fixtures ──────────────────────────────────────────────────────

function makeRecipe(over: Partial<Recipe> = {}): Recipe {
  return {
    id: 1, cat: 'meal', type: 'Meal', color: 'var(--green)', sc: 'cg',
    name: 'Chicken Bowl', tag: 'Quick', prepL: '20 min', prepC: 'var(--green)',
    hk: 400, hp: '35g', hc: '30g', hf: '12g', hfi: '5g',
    mk: 550, mp: '28g', mc: '48g', mf: '22g',
    ings: [], steps: [], tip: '',
    ...over,
  }
}

function makeDay(foods: DayData['foods']): DayData {
  return {
    foods, workout: null, wkNotes: '', energy: 0, mood: 0, sleep: 0,
    phase: '', notes: '', medMin: 0, medStyle: '',
  }
}

const EMPTY_SOURCES: LocalSearchSources = {
  library: [], history: [], recipes: [], quickFoods: [],
}

const food = (n: string, k = 100): QuickFood => ({ n, k, p: 10, c: 10, f: 5, fi: 2 })

// ── parseMacro ────────────────────────────────────────────────────

describe('parseMacro', () => {
  it('parses "32g" to 32', () => expect(parseMacro('32g')).toBe(32))
  it('parses "32 g" with a space', () => expect(parseMacro('32 g')).toBe(32))
  it('parses decimals "12.5g"', () => expect(parseMacro('12.5g')).toBe(12.5))
  it('parses bare numbers "40"', () => expect(parseMacro('40')).toBe(40))
  it('returns 0 for empty string', () => expect(parseMacro('')).toBe(0))
  it('returns 0 for undefined', () => expect(parseMacro(undefined)).toBe(0))
  it('returns 0 for non-numeric text', () => expect(parseMacro('lots')).toBe(0))
})

// ── recipeToHit ───────────────────────────────────────────────────

describe('recipeToHit', () => {
  it('uses the healthy variant by default', () => {
    expect(recipeToHit(makeRecipe())).toEqual({
      source: 'recipe', recipeId: 1, n: 'Chicken Bowl',
      k: 400, p: 35, c: 30, f: 12, fi: 5,
    })
  })

  it('uses the indulgent variant when healthTag is indulgent', () => {
    const hit = recipeToHit(makeRecipe({ healthTag: 'indulgent' }))
    expect(hit).toMatchObject({ k: 550, p: 28, c: 48, f: 22, fi: 0 })
  })

  it('returns null when the recipe has no calories', () => {
    expect(recipeToHit(makeRecipe({ hk: 0 }))).toBeNull()
  })

  it('omits recipeId when the recipe has no id', () => {
    const hit = recipeToHit(makeRecipe({ id: undefined }))
    expect(hit).not.toBeNull()
    expect('recipeId' in hit!).toBe(false)
  })

  it('defaults fiber to 0 when hfi is missing', () => {
    expect(recipeToHit(makeRecipe({ hfi: undefined }))?.fi).toBe(0)
  })
})

// ── historyFoods ──────────────────────────────────────────────────

describe('historyFoods', () => {
  it('returns unique foods newest-day first', () => {
    const days = {
      '2026-06-01': makeDay([{ n: 'Old Soup', k: 200, p: 10, c: 20, f: 5, fi: 3 }]),
      '2026-06-09': makeDay([{ n: 'New Bowl', k: 300, p: 20, c: 25, f: 8, fi: 4 }]),
    }
    expect(historyFoods(days).map(f => f.n)).toEqual(['New Bowl', 'Old Soup'])
  })

  it('dedupes by name, keeping the most recent entry', () => {
    const days = {
      '2026-06-01': makeDay([{ n: 'Oats', k: 999, p: 1, c: 1, f: 1, fi: 1 }]),
      '2026-06-09': makeDay([{ n: 'oats', k: 350, p: 18, c: 42, f: 12, fi: 9 }]),
    }
    const result = historyFoods(days)
    expect(result).toHaveLength(1)
    expect(result[0].k).toBe(350)
  })

  it('normalizes multi-serving entries back to per-serving values', () => {
    const days = {
      '2026-06-09': makeDay([{ n: 'Tacos', k: 600, p: 40, c: 50, f: 20, fi: 6, s: 2 }]),
    }
    expect(historyFoods(days)[0]).toEqual({ n: 'Tacos', k: 300, p: 20, c: 25, f: 10, fi: 3 })
  })
})

// ── searchLocalFoods ──────────────────────────────────────────────

describe('searchLocalFoods', () => {
  it('returns nothing for queries shorter than 2 chars', () => {
    const src = { ...EMPTY_SOURCES, library: [food('Apple')] }
    expect(searchLocalFoods('a', src)).toEqual([])
    expect(searchLocalFoods('', src)).toEqual([])
  })

  it('matches case-insensitive substrings across all sources', () => {
    const src: LocalSearchSources = {
      library: [food('Berry Oats')],
      history: [food('Overnight Oats')],
      recipes: [makeRecipe({ name: 'Oat Pancakes' })],
      quickFoods: [food('Matcha Oats')],
    }
    const names = searchLocalFoods('oat', src).map(h => h.n)
    expect(names).toContain('Berry Oats')
    expect(names).toContain('Overnight Oats')
    expect(names).toContain('Oat Pancakes')
    expect(names).toContain('Matcha Oats')
  })

  it('tags each hit with its source', () => {
    const src: LocalSearchSources = {
      library: [food('Lib Meal')],
      history: [food('Hist Meal')],
      recipes: [makeRecipe({ name: 'Recipe Meal' })],
      quickFoods: [food('Quick Meal')],
    }
    const bySource = Object.fromEntries(searchLocalFoods('meal', src).map(h => [h.source, h.n]))
    expect(bySource).toEqual({
      library: 'Lib Meal', history: 'Hist Meal',
      recipe: 'Recipe Meal', builtin: 'Quick Meal',
    })
  })

  it('ranks prefix matches before substring matches', () => {
    const src = { ...EMPTY_SOURCES, library: [food('Green Smoothie'), food('Smoothie Bowl')] }
    expect(searchLocalFoods('smoo', src).map(h => h.n)).toEqual(['Smoothie Bowl', 'Green Smoothie'])
  })

  it('dedupes by name — higher-priority source wins', () => {
    const src: LocalSearchSources = {
      ...EMPTY_SOURCES,
      library: [{ n: 'Berry Oats', k: 360, p: 19, c: 43, f: 12, fi: 9 }],
      quickFoods: [{ n: 'berry oats', k: 350, p: 18, c: 42, f: 12, fi: 9 }],
    }
    const hits = searchLocalFoods('berry', src)
    expect(hits).toHaveLength(1)
    expect(hits[0].source).toBe('library')
    expect(hits[0].k).toBe(360)
  })

  it('skips hidden recipes', () => {
    const src = {
      ...EMPTY_SOURCES,
      recipes: [makeRecipe({ name: 'Hidden Bowl', hidden: true })],
    }
    expect(searchLocalFoods('bowl', src)).toEqual([])
  })

  it('skips recipes without calories', () => {
    const src = { ...EMPTY_SOURCES, recipes: [makeRecipe({ name: 'No Kcal Bowl', hk: 0 })] }
    expect(searchLocalFoods('bowl', src)).toEqual([])
  })

  it('caps results at MAX_HITS', () => {
    const src = {
      ...EMPTY_SOURCES,
      library: Array.from({ length: MAX_HITS + 5 }, (_, i) => food(`Oats ${i}`)),
    }
    expect(searchLocalFoods('oats', src)).toHaveLength(MAX_HITS)
  })
})
