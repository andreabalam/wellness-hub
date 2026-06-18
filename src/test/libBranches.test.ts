/**
 * Branch top-ups for small pure helpers: recipeShare decode edges, category
 * normalisation, schedule block conversion and time parsing.
 */
import { describe, it, expect } from 'vitest'
import { encodeRecipe, decodeRecipe, parseShareRoute, buildShareUrl } from '../lib/recipeShare'
import { normalizeCat, catLabel } from '../data/recipes'
import { defaultToCustomBlock, timeToMinutes } from '../data/schedule'
import type { ScheduleBlock } from '../data/schedule'
import type { Recipe } from '../data/recipes'

const recipe: Recipe = {
  id: 1,
  cat: 'meal',
  type: 'Meal',
  color: '',
  sc: '',
  name: 'Round Trip',
  tag: 't',
  prepL: '',
  prepC: '',
  hk: 100,
  hp: '1g',
  hc: '2g',
  hf: '3g',
  mk: 100,
  mp: '1g',
  mc: '2g',
  mf: '3g',
  ings: [['Egg', '2']],
  steps: ['Cook'],
  tip: '',
  custom: true,
}

describe('recipeShare decode edges', () => {
  it('round-trips a recipe through encode/decode', async () => {
    const token = await encodeRecipe(recipe)
    const decoded = await decodeRecipe(token)
    expect(decoded?.name).toBe('Round Trip')
  })

  it('returns null for a malformed token', async () => {
    expect(await decodeRecipe('not-a-real-token!!')).toBeNull()
  })

  it('returns null for a valid token with the wrong shape', async () => {
    // gzip of a JSON object missing name/ings
    const token = await encodeRecipe({
      ...recipe,
      name: undefined as never,
      ings: undefined as never,
    })
    expect(await decodeRecipe(token)).toBeNull()
  })

  it('parses and rejects share routes', () => {
    expect(parseShareRoute('#/r/abc')).toBe('abc')
    expect(parseShareRoute('#/other')).toBeNull()
  })

  it('builds a share URL with the app base path', async () => {
    const url = await buildShareUrl(recipe)
    expect(url).toMatch(/#\/r\/.+/)
  })
})

describe('normalizeCat', () => {
  it('folds removed/empty categories into "meal"', () => {
    expect(normalizeCat('lunch')).toBe('meal')
    expect(normalizeCat('dinner')).toBe('meal')
    expect(normalizeCat('')).toBe('meal')
    expect(normalizeCat(null)).toBe('meal')
    expect(normalizeCat('snack')).toBe('snack')
  })

  it('labels a category', () => {
    expect(catLabel('meal')).toBe('Meal')
  })
})

describe('schedule helpers', () => {
  it('converts a default block, dropping the em-dash duration', () => {
    const block: ScheduleBlock = {
      id: 'b1',
      time: '7:00 AM',
      title: 'Wake',
      dur: '—',
      dot: 'cgo',
      whyTxt: 'why',
      desc: 'desc',
    } as ScheduleBlock
    const out = defaultToCustomBlock(block, 0)
    expect(out.dur).toBe('')
    expect(out.color).toBe('gold')
  })

  it('keeps a real duration and falls back to a generated id', () => {
    const block = {
      time: '8:00',
      title: 'X',
      dur: '30m',
      dot: 'unknown',
    } as unknown as ScheduleBlock
    const out = defaultToCustomBlock(block, 3)
    expect(out.dur).toBe('30m')
    expect(out.id).toBe('default-3')
    expect(out.color).toBe('green') // unknown dot → fallback
  })

  it('parses 12-hour and 24-hour times including midnight/noon', () => {
    expect(timeToMinutes('12:00 AM')).toBe(0)
    expect(timeToMinutes('12:00 PM')).toBe(720)
    expect(timeToMinutes('1:30 PM')).toBe(810)
    expect(timeToMinutes('09:15')).toBe(555)
    expect(timeToMinutes('garbage')).toBe(0)
  })
})
