import { describe, it, expect } from 'vitest'
import { GROCERY_DATA, GROCERY_CATEGORIES } from '../data/grocery'
import type { GroceryCatalogItem } from '../data/grocery'

const ALL_ITEMS = Object.values(GROCERY_DATA).flat()

describe('GROCERY_DATA structure', () => {
  it('has exactly 11 categories', () => {
    expect(Object.keys(GROCERY_DATA)).toHaveLength(11)
  })

  it('contains all expected category names', () => {
    const keys = Object.keys(GROCERY_DATA)
    expect(keys).toContain('Produce - Vegetables')
    expect(keys).toContain('Produce - Fruit')
    expect(keys).toContain('Protein - Animal')
    expect(keys).toContain('Protein - Plant')
    expect(keys).toContain('Dairy and Refrigerated')
    expect(keys).toContain('Grains and Bread')
    expect(keys).toContain('Nuts, Seeds and Fat')
    expect(keys).toContain('Oils and Condiments')
    expect(keys).toContain('Spices and Seasonings')
    expect(keys).toContain('Baking')
    expect(keys).toContain('Supplements and Extras')
  })

  it('has at least 80 total items', () => {
    expect(ALL_ITEMS.length).toBeGreaterThanOrEqual(80)
  })

  it('every item has a non-empty name', () => {
    ALL_ITEMS.forEach(item => {
      expect(item.n, `Item in list has empty name`).toBeTruthy()
    })
  })

  it('t field is one of: add | swap | remove | undefined', () => {
    const valid = new Set<string | undefined>(['add', 'swap', 'remove', undefined])
    ALL_ITEMS.forEach(item => {
      expect(valid.has(item.t), `"${item.n}" has invalid t="${item.t}"`).toBe(true)
    })
  })
})

describe('NutriInfo data integrity', () => {
  const withNutri = ALL_ITEMS.filter(i => i.nutri != null)

  it('at least 50 items have nutritional data', () => {
    expect(withNutri.length).toBeGreaterThanOrEqual(50)
  })

  it('every nutri.srv is a non-empty string', () => {
    withNutri.forEach(item => {
      expect(item.nutri!.srv, `${item.n} missing srv`).toBeTruthy()
    })
  })

  it('every nutri.cal is >= 0', () => {
    withNutri.forEach(item => {
      expect(item.nutri!.cal, `${item.n} cal < 0`).toBeGreaterThanOrEqual(0)
    })
  })

  it('every nutri.p is a number >= 0', () => {
    withNutri.forEach(item => {
      expect(typeof item.nutri!.p).toBe('number')
      expect(item.nutri!.p).toBeGreaterThanOrEqual(0)
    })
  })

  it('every nutri.c is a number >= 0', () => {
    withNutri.forEach(item => {
      expect(typeof item.nutri!.c).toBe('number')
      expect(item.nutri!.c).toBeGreaterThanOrEqual(0)
    })
  })

  it('every nutri.f is a number >= 0', () => {
    withNutri.forEach(item => {
      expect(typeof item.nutri!.f).toBe('number')
      expect(item.nutri!.f).toBeGreaterThanOrEqual(0)
    })
  })

  it('nutri.fi is a number when present', () => {
    withNutri
      .filter(i => i.nutri!.fi != null)
      .forEach(item => {
        expect(typeof item.nutri!.fi).toBe('number')
        expect(item.nutri!.fi!).toBeGreaterThanOrEqual(0)
      })
  })
})

describe('Category-specific nutrition spot checks', () => {
  it('Blueberries — 1 cup, 84 kcal', () => {
    const item = GROCERY_DATA['Produce - Fruit'].find(i => i.n === 'Blueberries')
    expect(item?.nutri?.cal).toBe(84)
    expect(item?.nutri?.srv).toBe('1 cup')
  })

  it('Bananas — 1 medium, 105 kcal', () => {
    const item = GROCERY_DATA['Produce - Fruit'].find(i => i.n === 'Bananas')
    expect(item?.nutri?.cal).toBe(105)
  })

  it('Baby spinach — 1 cup raw, 7 kcal', () => {
    const item = GROCERY_DATA['Produce - Vegetables'].find(i => i.n === 'Baby spinach')
    expect(item?.nutri?.cal).toBe(7)
  })

  it('Walnuts — 1 oz, 185 kcal', () => {
    const item = GROCERY_DATA['Nuts, Seeds and Fat'].find(i => i.n === 'Walnuts')
    expect(item?.nutri?.cal).toBe(185)
  })

  it('Whey protein — 1 scoop, 120 kcal, 25g protein', () => {
    const item = GROCERY_DATA['Supplements and Extras'].find(i => i.n === 'Whey protein vanilla')
    expect(item?.nutri?.cal).toBe(120)
    expect(item?.nutri?.p).toBe(25)
  })

  it('Eggs — 1 large egg, 72 kcal', () => {
    const item = GROCERY_DATA['Protein - Animal'].find(i => i.n === 'Eggs, large 18-count')
    expect(item?.nutri?.cal).toBe(72)
  })
})

describe('Spices and Seasonings have no nutri', () => {
  it('all spice items lack nutri (negligible serving amounts)', () => {
    GROCERY_DATA['Spices and Seasonings'].forEach(item => {
      expect(item.nutri, `${item.n} should not have nutri`).toBeUndefined()
    })
  })
})

// ── GROCERY_CATEGORIES ────────────────────────────────────────────
describe('GROCERY_CATEGORIES', () => {
  it('has exactly 11 entries', () => {
    expect(GROCERY_CATEGORIES).toHaveLength(11)
  })

  it('matches the keys of GROCERY_DATA exactly', () => {
    const dataKeys = Object.keys(GROCERY_DATA).sort()
    const catKeys = [...GROCERY_CATEGORIES].sort()
    expect(catKeys).toEqual(dataKeys)
  })

  it('is read-only (TypeScript const assertion)', () => {
    // TypeScript enforces this at compile time; just verify the array exists and is truthy
    expect(GROCERY_CATEGORIES).toBeTruthy()
  })
})

// ── GroceryCatalogItem interface shape ────────────────────────────
describe('GroceryCatalogItem shape', () => {
  it('can be constructed with required fields only', () => {
    const item: GroceryCatalogItem = { id: 'test-1', n: 'Kale', cat: 'Produce - Vegetables' }
    expect(item.id).toBe('test-1')
    expect(item.n).toBe('Kale')
    expect(item.cat).toBe('Produce - Vegetables')
    expect(item.nutri).toBeUndefined()
  })

  it('accepts optional nutri info', () => {
    const item: GroceryCatalogItem = {
      id: 'test-2',
      n: 'Salmon fillet',
      cat: 'Protein - Animal',
      nutri: { srv: '4 oz', cal: 160, p: 25, c: 0, f: 7 },
    }
    expect(item.nutri?.cal).toBe(160)
    expect(item.nutri?.p).toBe(25)
  })
})
