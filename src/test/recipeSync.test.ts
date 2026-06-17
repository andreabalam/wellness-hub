import { describe, it, expect } from 'vitest'
import { mergeRecipes, applyIdMap, isPlaceholderId, PLACEHOLDER_ID_MIN } from '../lib/recipeSync'
import type { Recipe } from '../data/recipes'

function rec(id: number, name = `r${id}`, custom = true): Recipe {
  return {
    id, name, cat: 'meal', type: 'Meal', color: '', sc: '', tag: '',
    prepL: '', prepC: '', hk: 0, hp: '', hc: '', hf: '',
    mk: 0, mp: '', mc: '', mf: '', ings: [], steps: [], tip: '',
    custom, source: custom ? 'user' : 'builtin',
  } as Recipe
}

const PLACEHOLDER = PLACEHOLDER_ID_MIN + 123  // a Date.now()-style id

describe('isPlaceholderId', () => {
  it('treats large (Date.now) ids as placeholders and small ids as real', () => {
    expect(isPlaceholderId(PLACEHOLDER)).toBe(true)
    expect(isPlaceholderId(42)).toBe(false)
    expect(isPlaceholderId(undefined)).toBe(false)
    expect(isPlaceholderId(null)).toBe(false)
  })
})

describe('mergeRecipes', () => {
  it('pushes a never-synced local recipe (placeholder id) and keeps it', () => {
    const { merged, toPush, prunedIds } = mergeRecipes([rec(PLACEHOLDER, 'New')], [])
    expect(toPush.map(r => r.name)).toEqual(['New'])
    expect(merged.map(r => r.name)).toContain('New')
    expect(prunedIds).toEqual([])
  })

  it('prunes a synced recipe (real id) that is absent from the DB — deleted elsewhere', () => {
    const { merged, toPush, prunedIds } = mergeRecipes([rec(7, 'Deleted')], [])
    expect(prunedIds).toEqual([7])
    expect(merged).toHaveLength(0)   // dropped, not resurrected
    expect(toPush).toHaveLength(0)   // and never re-pushed
  })

  it('lets the DB row win for an id present in both', () => {
    const local = [{ ...rec(7), name: 'Old' }]
    const db    = [{ ...rec(7), name: 'New' }]
    const { merged, toPush, prunedIds } = mergeRecipes(local, db)
    expect(merged).toHaveLength(1)
    expect(merged[0].name).toBe('New')
    expect(toPush).toHaveLength(0)
    expect(prunedIds).toEqual([])
  })

  it('keeps DB-only recipes', () => {
    const { merged } = mergeRecipes([], [rec(1), rec(2)])
    expect(merged.map(r => r.id)).toEqual([1, 2])
  })

  it('combines DB rows, a deleted-elsewhere prune, and a new local push', () => {
    const local = [rec(1, 'KeptFromDb'), rec(9, 'DeletedElsewhere'), rec(PLACEHOLDER, 'BrandNew')]
    const db    = [rec(1, 'KeptFromDb')]
    const { merged, toPush, prunedIds } = mergeRecipes(local, db)
    expect(prunedIds).toEqual([9])
    expect(toPush.map(r => r.name)).toEqual(['BrandNew'])
    expect(merged.map(r => r.name).sort()).toEqual(['BrandNew', 'KeptFromDb'])
  })

  it('does not push a non-custom local-only recipe', () => {
    const { toPush } = mergeRecipes([rec(PLACEHOLDER, 'Builtinish', false)], [])
    expect(toPush).toHaveLength(0)
  })
})

describe('applyIdMap', () => {
  it('swaps mapped ids and leaves others untouched', () => {
    const out = applyIdMap([rec(PLACEHOLDER, 'A'), rec(5, 'B')], new Map([[PLACEHOLDER, 12]]))
    expect(out.find(r => r.name === 'A')!.id).toBe(12)
    expect(out.find(r => r.name === 'B')!.id).toBe(5)
  })

  it('returns the same list when the map is empty', () => {
    const input = [rec(1)]
    expect(applyIdMap(input, new Map())).toBe(input)
  })
})
