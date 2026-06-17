/**
 * Unit tests for src/lib/recipeShare.ts — encode/decode round-trip,
 * route parsing, and stripping of local-only fields from shared links.
 */
import { describe, it, expect } from 'vitest'
import type { Recipe } from '../data/recipes'
import {
  encodeRecipe,
  decodeRecipe,
  buildShareUrl,
  parseShareRoute,
  resolveShareToken,
} from '../lib/recipeShare'

const RECIPE: Recipe = {
  id: 42,
  cat: 'breakfast',
  type: 'Breakfast',
  color: 'var(--green)',
  sc: 'sc-green',
  name: 'Avocado Toast',
  tag: 'Quick · high-protein',
  prepL: '10 min',
  prepC: 'var(--green)',
  prepTime: '10 min',
  hk: 320,
  hp: '8g',
  hc: '30g',
  hf: '18g',
  hfi: '6g',
  mk: 320,
  mp: '8g',
  mc: '30g',
  mf: '18g',
  ings: [
    ['Avocado', '1'],
    ['Sourdough', '2 slices'],
  ],
  steps: ['Mash avocado', 'Toast bread', 'Combine'],
  tip: 'Add chilli flakes',
  custom: true,
  source: 'user',
  defaultId: 7,
  hidden: true,
  dietTag: 'vegetarian',
}

describe('encodeRecipe / decodeRecipe', () => {
  it('round-trips a recipe through the share token', async () => {
    const token = await encodeRecipe(RECIPE)
    const back = await decodeRecipe(token)
    expect(back?.name).toBe('Avocado Toast')
    expect(back?.ings).toEqual(RECIPE.ings)
    expect(back?.steps).toEqual(RECIPE.steps)
    expect(back?.hk).toBe(320)
    expect(back?.dietTag).toBe('vegetarian')
  })

  it('strips local-only fields (id, source, defaultId, hidden, custom)', async () => {
    const token = await encodeRecipe(RECIPE)
    const back = await decodeRecipe(token)
    expect(back?.id).toBeUndefined()
    expect(back?.source).toBeUndefined()
    expect(back?.defaultId).toBeUndefined()
    expect(back?.hidden).toBeUndefined()
    expect(back?.custom).toBeUndefined()
  })

  it('produces a URL-safe token (no +, /, or = padding)', async () => {
    const token = await encodeRecipe(RECIPE)
    expect(token).not.toMatch(/[+/=]/)
  })

  it('returns null for a malformed token', async () => {
    expect(await decodeRecipe('not-a-valid-token')).toBeNull()
    expect(await decodeRecipe('')).toBeNull()
  })
})

describe('buildShareUrl', () => {
  it('builds a hash-route URL whose token decodes back to the recipe', async () => {
    const url = await buildShareUrl(RECIPE)
    expect(url).toContain('#/r/')
    expect(url.startsWith(location.origin)).toBe(true)
    const token = parseShareRoute('#' + url.split('#')[1])
    expect(token).toBeTruthy()
    const back = await decodeRecipe(token!)
    expect(back?.name).toBe('Avocado Toast')
  })
})

describe('parseShareRoute', () => {
  it('extracts the token from a share hash', () => {
    expect(parseShareRoute('#/r/abc123')).toBe('abc123')
  })

  it('returns null for non-share hashes', () => {
    expect(parseShareRoute('')).toBeNull()
    expect(parseShareRoute('#/recipes')).toBeNull()
    expect(parseShareRoute('#other')).toBeNull()
  })
})

describe('resolveShareToken', () => {
  it('resolves an inline token to a recipe', async () => {
    const token = await encodeRecipe(RECIPE)
    const back = await resolveShareToken(token)
    expect(back?.name).toBe('Avocado Toast')
  })
})
