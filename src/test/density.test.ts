import { describe, it, expect } from 'vitest'
import {
  densityTier, densityTierFor, isDrinkCategory,
  DENSITY_COLORS, DENSITY_LABELS,
} from '../lib/density'

describe('densityTierFor (solids)', () => {
  it('green below 1.0 cal/g', () => {
    expect(densityTierFor(0.5)).toBe('green')
    expect(densityTierFor(0.99)).toBe('green')
  })
  it('yellow from 1.0 to 2.4', () => {
    expect(densityTierFor(1.0)).toBe('yellow')
    expect(densityTierFor(2.4)).toBe('yellow')
  })
  it('orange above 2.4', () => {
    expect(densityTierFor(2.41)).toBe('orange')
    expect(densityTierFor(9)).toBe('orange')
  })
})

describe('densityTierFor (drinks)', () => {
  it('uses the lower drink cutoffs', () => {
    expect(densityTierFor(0.3, true)).toBe('green')
    expect(densityTierFor(0.45, true)).toBe('yellow')
    expect(densityTierFor(0.6, true)).toBe('orange')
    // a value that is green as a solid is orange as a drink
    expect(densityTierFor(0.6, false)).toBe('green')
  })
})

describe('densityTier (kcal + grams)', () => {
  it('computes tier from kcal and grams', () => {
    expect(densityTier(150, 300)).toBe('green')   // 0.5 cal/g
    expect(densityTier(400, 200)).toBe('yellow')  // 2.0 cal/g
    expect(densityTier(500, 100)).toBe('orange')  // 5.0 cal/g
  })
  it('returns null when grams is missing or zero', () => {
    expect(densityTier(300, 0)).toBeNull()
    expect(densityTier(300, -5)).toBeNull()
  })
})

describe('isDrinkCategory', () => {
  it('is true for smoothie and drinks only', () => {
    expect(isDrinkCategory('smoothie')).toBe(true)
    expect(isDrinkCategory('drinks')).toBe(true)
    expect(isDrinkCategory('meal')).toBe(false)
    expect(isDrinkCategory('breakfast')).toBe(false)
  })
})

describe('density maps', () => {
  it('have a color and label for every tier', () => {
    for (const t of ['green', 'yellow', 'orange'] as const) {
      expect(DENSITY_COLORS[t]).toBeTruthy()
      expect(DENSITY_LABELS[t]).toBeTruthy()
    }
  })
})
