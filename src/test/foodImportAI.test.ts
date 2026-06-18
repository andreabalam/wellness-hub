/**
 * parseFoodLog AI path — needs a mocked Supabase client (the unit env has none),
 * covering the edge-function error and empty-result branches.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const invoke = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}))

import { parseFoodLog } from '../lib/foodImport'

beforeEach(() => vi.clearAllMocks())

describe('parseFoodLog (AI, mocked supabase)', () => {
  it('throws the edge-function error message', async () => {
    invoke.mockResolvedValue({ data: null, error: { message: 'rate limited' } })
    await expect(parseFoodLog('eggs and toast')).rejects.toThrow('rate limited')
  })

  it('throws a generic message when the edge function errors without a message', async () => {
    invoke.mockResolvedValue({ data: null, error: {} })
    await expect(parseFoodLog('eggs')).rejects.toThrow(/Parse failed/)
  })

  it('throws when no entries come back', async () => {
    invoke.mockResolvedValue({ data: { entries: [] }, error: null })
    await expect(parseFoodLog('eggs')).rejects.toThrow('No foods found')
  })

  it('returns the parsed entries on success', async () => {
    invoke.mockResolvedValue({
      data: { entries: [{ n: 'Eggs', k: 140, p: 12, c: 1, f: 10, fi: 0 }] },
      error: null,
    })
    const rows = await parseFoodLog('2 eggs')
    expect(rows).toHaveLength(1)
    expect(rows[0].n).toBe('Eggs')
  })

  it('rejects empty input before calling the edge function', async () => {
    await expect(parseFoodLog('   ')).rejects.toThrow(/Paste some food/)
    expect(invoke).not.toHaveBeenCalled()
  })
})
