/**
 * estimateFoodMacros with NO Supabase client — the same-origin fallback used
 * by E2E (env disabled) and unconfigured dev. Companion to foodSearch.test.ts,
 * which mocks a configured client.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: null }))

import { estimateFoodMacros } from '../lib/foodSearch'

const ESTIMATE = {
  name: 'Pozole Rojo',
  kcal: 320,
  protein: 22,
  carbs: 28,
  fat: 14,
  fiber: 5,
  confidence: 'medium',
  notes: 'Assumes 1 bowl (~400 g)',
}

beforeEach(() => vi.unstubAllGlobals())

describe('estimateFoodMacros — no supabase client (same-origin fallback)', () => {
  it('POSTs to the same-origin function path and returns the estimate', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ estimate: ESTIMATE }),
    })
    vi.stubGlobal('fetch', mockFetch)
    expect(await estimateFoodMacros('pozole')).toEqual(ESTIMATE)
    expect(mockFetch).toHaveBeenCalledWith(
      '/functions/v1/estimate-food-macros',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'pozole' }) }),
    )
  })

  it('returns null on a non-ok response (nothing listening / unconfigured)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))
    expect(await estimateFoodMacros('pozole')).toBeNull()
  })

  it('returns null when fetch rejects (offline)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network')))
    expect(await estimateFoodMacros('pozole')).toBeNull()
  })

  it('returns null when the response has no estimate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    expect(await estimateFoodMacros('pozole')).toBeNull()
  })
})
