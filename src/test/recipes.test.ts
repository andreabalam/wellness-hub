import { describe, it, expect } from 'vitest'
import { PRESET_CATS, DEFAULT_RECIPE_IDS } from '../data/recipes'
import type { Recipe } from '../data/recipes'

// ── Recipe interface fixtures ─────────────────────────────────────

const BREAKFAST: Recipe = {
  id: 1, cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'ca',
  name: 'Berry Walnut Power Oats', tag: 'Prep night before - 5 min',
  prepL: 'Prep ahead', prepC: 'var(--teal)',
  hk: 350, hp: '18g', hc: '42g', hf: '12g', hfi: '5g',
  mk: 420, mp: '22g', mc: '50g', mf: '14g',
  ings: [['Rolled oats', '35g'], ['Greek yogurt', '75g']],
  steps: ['Combine oats', 'Refrigerate overnight'],
  tip: 'Make three jars on Sunday.',
  source: 'builtin',
}

const SMOOTHIE: Recipe = {
  id: 2, cat: 'smoothie', type: 'Smoothie', color: 'var(--blue)', sc: 'cb',
  name: 'Green Protein Powerhouse', tag: '5 min - blender',
  prepL: 'Quick', prepC: 'var(--green)',
  hk: 390, hp: '35g', hc: '56g', hf: '9g',
  mk: 480, mp: '43g', mc: '66g', mf: '10g',
  ings: [['Baby spinach', '1 handful'], ['Frozen banana', '1/2']],
  steps: ['Blend all ingredients.'],
  tip: 'Drink immediately.',
  source: 'builtin',
}

const DR_EMILY: Recipe = {
  id: 3, cat: 'breakfast', type: 'Breakfast', color: 'var(--amber)', sc: 'ca',
  name: 'Lemon & Blueberry Overnight Oats', tag: 'Dr Emily Prpa',
  prepL: 'Prep ahead', prepC: 'var(--teal)',
  hk: 450, hp: '27g', hc: '50g', hf: '15g', hfi: '13g',
  mk: 0, mp: '0g', mc: '0g', mf: '0g',
  ings: [['Rolled oats', '1.5 cups']],
  steps: ['Make chia jam.', 'Layer into jars.'],
  tip: 'Source: Dr Emily Prpa',
  source: 'dr_emily',
}

const CUSTOM: Recipe = {
  id: 4, cat: 'dinner', type: 'Dinner', color: 'var(--purple)', sc: 'cp',
  name: 'My Special Bowl', tag: 'quick',
  prepL: 'Custom', prepC: 'var(--purple)',
  hk: 400, hp: '30g', hc: '40g', hf: '10g',
  mk: 0, mp: '0g', mc: '0g', mf: '0g',
  ings: [['Rice', '1 cup']],
  steps: ['Cook rice.'],
  tip: '',
  custom: true, source: 'user',
}

const ALL_FIXTURES = [BREAKFAST, SMOOTHIE, DR_EMILY, CUSTOM]

// ── Recipe interface validation ───────────────────────────────────

describe('Recipe interface', () => {
  it('required string fields are present on a valid recipe', () => {
    ALL_FIXTURES.forEach(r => {
      expect(r.name,  `${r.name} missing name`).toBeTruthy()
      expect(r.cat,   `${r.name} missing cat`).toBeTruthy()
      expect(r.type,  `${r.name} missing type`).toBeTruthy()
    })
  })

  it('hk (kcal) is a positive number', () => {
    ALL_FIXTURES.forEach(r => {
      expect(r.hk, `${r.name} has no kcal`).toBeGreaterThan(0)
    })
  })

  it('ingredients are [string, string] tuples', () => {
    ALL_FIXTURES.forEach(r => {
      r.ings.forEach(([name, amt]) => {
        expect(typeof name).toBe('string')
        expect(typeof amt).toBe('string')
      })
    })
  })

  it('steps is a non-empty string array', () => {
    ALL_FIXTURES.forEach(r => {
      expect(Array.isArray(r.steps)).toBe(true)
      expect(r.steps.length).toBeGreaterThan(0)
      r.steps.forEach(s => expect(typeof s).toBe('string'))
    })
  })

  it('source field is one of the expected values', () => {
    const valid = ['builtin', 'dr_emily', 'user', undefined]
    ALL_FIXTURES.forEach(r => {
      expect(valid).toContain(r.source)
    })
  })

  it('custom flag is true when source is "user"', () => {
    expect(CUSTOM.custom).toBe(true)
    expect(CUSTOM.source).toBe('user')
  })

  it('optional fields can be undefined', () => {
    const minimal: Recipe = {
      cat: 'snack', type: 'Snack', color: 'var(--gold)', sc: 'cgo',
      name: 'Apple', tag: 'quick',
      prepL: '1 min', prepC: 'var(--green)',
      hk: 80, hp: '0g', hc: '21g', hf: '0g',
      mk: 80, mp: '0g', mc: '21g', mf: '0g',
      ings: [['Apple', '1 medium']],
      steps: ['Eat it.'],
      tip: '',
    }
    expect(minimal.id).toBeUndefined()
    expect(minimal.prepTime).toBeUndefined()
    expect(minimal.healthTag).toBeUndefined()
    expect(minimal.image).toBeUndefined()
    expect(minimal.link).toBeUndefined()
    expect(minimal.hfi).toBeUndefined()
    expect(minimal.source).toBeUndefined()
  })
})

// ── Recipe filtering logic (mirrors RecipesTab) ───────────────────

describe('recipe filtering', () => {
  it('filter by "breakfast" returns only breakfast recipes', () => {
    const filtered = ALL_FIXTURES.filter(r => r.cat === 'breakfast')
    expect(filtered.length).toBeGreaterThan(0)
    filtered.forEach(r => expect(r.cat).toBe('breakfast'))
  })

  it('filter by "smoothie" returns only smoothies', () => {
    const filtered = ALL_FIXTURES.filter(r => r.cat === 'smoothie')
    expect(filtered.length).toBeGreaterThan(0)
    filtered.forEach(r => expect(r.cat).toBe('smoothie'))
  })

  it('"user" source recipes can be filtered by custom flag', () => {
    const custom = ALL_FIXTURES.filter(r => r.source === 'user')
    expect(custom.length).toBeGreaterThan(0)
    custom.forEach(r => expect(r.custom).toBe(true))
  })

  it('"dr_emily" source recipes are separate from "builtin"', () => {
    const drEmily = ALL_FIXTURES.filter(r => r.source === 'dr_emily')
    const builtin = ALL_FIXTURES.filter(r => r.source === 'builtin')
    expect(drEmily.length).toBeGreaterThan(0)
    expect(builtin.length).toBeGreaterThan(0)
    drEmily.forEach(r => expect(r.source).not.toBe('builtin'))
  })

  it('search by ingredient returns matching recipes', () => {
    const q = 'oats'
    const matches = ALL_FIXTURES.filter(r =>
      r.name.toLowerCase().includes(q) ||
      r.ings.some(([ing]) => ing.toLowerCase().includes(q))
    )
    expect(matches.length).toBeGreaterThan(0)
  })
})

// ── PRESET_CATS ───────────────────────────────────────────────────

describe('PRESET_CATS', () => {
  it('contains all expected filter categories', () => {
    const expected = ['breakfast', 'smoothie', 'lunch', 'dinner', 'dessert', 'ferments', 'snack', 'drinks']
    expected.forEach(cat => expect(PRESET_CATS).toContain(cat))
  })

  it('has at least 8 categories', () => {
    expect(PRESET_CATS.length).toBeGreaterThanOrEqual(8)
  })

  it('all entries are non-empty strings', () => {
    PRESET_CATS.forEach(cat => {
      expect(typeof cat).toBe('string')
      expect(cat.length).toBeGreaterThan(0)
    })
  })
})

// ── DEFAULT_RECIPE_IDS ────────────────────────────────────────────

describe('DEFAULT_RECIPE_IDS', () => {
  it('contains exactly 7 ids (one per category except Drinks)', () => {
    expect(DEFAULT_RECIPE_IDS).toHaveLength(7)
  })

  it('includes the expected category representatives', () => {
    // Breakfast=2, Smoothie=5, Lunch=9, Dinner=13, Dessert=22, Ferments=24, Snack=45
    expect(DEFAULT_RECIPE_IDS).toContain(2)   // Breakfast
    expect(DEFAULT_RECIPE_IDS).toContain(5)   // Smoothie
    expect(DEFAULT_RECIPE_IDS).toContain(9)   // Lunch
    expect(DEFAULT_RECIPE_IDS).toContain(13)  // Dinner
    expect(DEFAULT_RECIPE_IDS).toContain(22)  // Dessert
    expect(DEFAULT_RECIPE_IDS).toContain(24)  // Ferments
    expect(DEFAULT_RECIPE_IDS).toContain(45)  // Snack
  })

  it('all ids are positive integers', () => {
    DEFAULT_RECIPE_IDS.forEach(id => {
      expect(Number.isInteger(id)).toBe(true)
      expect(id).toBeGreaterThan(0)
    })
  })

  it('all ids are unique', () => {
    expect(new Set(DEFAULT_RECIPE_IDS).size).toBe(DEFAULT_RECIPE_IDS.length)
  })
})

// ── Recipe optional Phase 1 fields ───────────────────────────────

describe('Recipe interface — Phase 1 new fields', () => {
  it('defaultId is optional and can be set on a forked recipe', () => {
    const forked: Recipe = {
      id: 1001, cat: 'breakfast', type: 'Breakfast', color: '', sc: '', name: 'My Oats',
      tag: '', prepL: '', prepC: '', hk: 300, hp: '15g', hc: '40g', hf: '8g',
      mk: 0, mp: '0g', mc: '0g', mf: '0g', ings: [], steps: [], tip: '',
      custom: true, source: 'user', defaultId: 2,
    }
    expect(forked.defaultId).toBe(2)
  })

  it('hidden is optional and defaults to undefined', () => {
    const recipe: Recipe = {
      cat: 'snack', type: 'Snack', color: '', sc: '', name: 'Hidden Snack',
      tag: '', prepL: '', prepC: '', hk: 100, hp: '5g', hc: '10g', hf: '2g',
      mk: 0, mp: '0g', mc: '0g', mf: '0g', ings: [], steps: [], tip: '',
    }
    expect(recipe.hidden).toBeUndefined()
  })

  it('hidden can be set to true to suppress a default recipe', () => {
    const recipe: Recipe = {
      cat: 'dinner', type: 'Dinner', color: '', sc: '', name: 'Boring Salmon',
      tag: '', prepL: '', prepC: '', hk: 400, hp: '35g', hc: '30g', hf: '10g',
      mk: 0, mp: '0g', mc: '0g', mf: '0g', ings: [], steps: [], tip: '',
      hidden: true,
    }
    expect(recipe.hidden).toBe(true)
  })
})
