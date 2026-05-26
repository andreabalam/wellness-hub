import { describe, it, expect } from 'vitest'
import { ALL_RECIPES, PRESET_CATS } from '../data/recipes'

describe('ALL_RECIPES', () => {
  it('has at least 20 built-in recipes', () => {
    expect(ALL_RECIPES.length).toBeGreaterThanOrEqual(20)
  })

  it('every recipe has required string fields', () => {
    ALL_RECIPES.forEach(r => {
      expect(r.name, `${r.name} missing name`).toBeTruthy()
      expect(r.cat,  `${r.name} missing cat`).toBeTruthy()
      expect(r.type, `${r.name} missing type`).toBeTruthy()
      expect(r.tag,  `${r.name} missing tag`).toBeTruthy()
    })
  })

  it('every recipe has numeric kcal > 0', () => {
    ALL_RECIPES.forEach(r => {
      expect(r.hk, `${r.name} has no kcal`).toBeGreaterThan(0)
    })
  })

  it('every recipe has at least one ingredient', () => {
    ALL_RECIPES.forEach(r => {
      expect(r.ings.length, `${r.name} has no ingredients`).toBeGreaterThan(0)
    })
  })

  it('every recipe has at least one step', () => {
    ALL_RECIPES.forEach(r => {
      expect(r.steps.length, `${r.name} has no steps`).toBeGreaterThan(0)
    })
  })

  it('every recipe cat is a known preset category', () => {
    ALL_RECIPES.forEach(r => {
      expect(PRESET_CATS, `${r.name} has unknown cat "${r.cat}"`).toContain(r.cat)
    })
  })

  it('ingredient tuples are [string, string]', () => {
    ALL_RECIPES.forEach(r => {
      r.ings.forEach(([name, amt]) => {
        expect(typeof name).toBe('string')
        expect(typeof amt).toBe('string')
      })
    })
  })
})

// ── Recipe filter logic (mirrors RecipesTab) ─────────────────────
describe('recipe filtering', () => {
  it('filter by "breakfast" returns only breakfast recipes', () => {
    const filtered = ALL_RECIPES.filter(r => r.cat === 'breakfast')
    expect(filtered.length).toBeGreaterThan(0)
    filtered.forEach(r => expect(r.cat).toBe('breakfast'))
  })

  it('filter by "smoothie" returns only smoothies', () => {
    const filtered = ALL_RECIPES.filter(r => r.cat === 'smoothie')
    expect(filtered.length).toBeGreaterThan(0)
    filtered.forEach(r => expect(r.cat).toBe('smoothie'))
  })

  it('filter "all" returns every built-in recipe', () => {
    const filtered = ALL_RECIPES.filter(() => true)
    expect(filtered.length).toBe(ALL_RECIPES.length)
  })

  it('ferments are separate from dinner', () => {
    const ferments = ALL_RECIPES.filter(r => r.cat === 'ferments')
    const dinners  = ALL_RECIPES.filter(r => r.cat === 'dinner')
    expect(ferments.length).toBeGreaterThan(0)
    expect(dinners.length).toBeGreaterThan(0)
    ferments.forEach(r => expect(r.cat).not.toBe('dinner'))
  })
})

describe('PRESET_CATS', () => {
  it('contains all expected filter categories', () => {
    const expected = ['breakfast', 'smoothie', 'lunch', 'dinner', 'dessert', 'ferments']
    expected.forEach(cat => expect(PRESET_CATS).toContain(cat))
  })
})
