import { describe, expect, it, vi } from 'vitest'
import {
  checkDailyQuota,
  dailyLimit,
  QUOTA_MESSAGE,
  type CountClient,
} from '../../supabase/functions/_shared/quota.ts'
import { functionErrorMessage } from '../lib/functionError'

function client(result: { count: number | null; error: unknown }) {
  const calls: unknown[][] = []
  const q = {
    eq: (...a: unknown[]) => (calls.push(['eq', ...a]), q),
    gte: (...a: unknown[]) => (calls.push(['gte', ...a]), Promise.resolve(result)),
  }
  const sb = {
    from: (t: string) => (calls.push(['from', t]), { select: () => q }),
  } as unknown as CountClient
  return { sb, calls }
}

describe('checkDailyQuota', () => {
  const now = new Date('2026-11-18T20:00:00Z')

  it('allows under the limit and counts the last 24 h of the user’s rows', async () => {
    const { sb, calls } = client({ count: 4, error: null })
    expect(await checkDailyQuota(sb, 'recipe_import_log', 'u1', 5, { now })).toEqual({
      ok: true,
      used: 4,
      limit: 5,
    })
    expect(calls).toEqual([
      ['from', 'recipe_import_log'],
      ['eq', 'user_id', 'u1'],
      ['gte', 'created_at', '2026-11-17T20:00:00.000Z'],
    ])
  })

  it('blocks at the limit', async () => {
    const { sb } = client({ count: 5, error: null })
    expect((await checkDailyQuota(sb, 't', 'u1', 5)).ok).toBe(false)
  })

  it('applies extra filters', async () => {
    const { sb, calls } = client({ count: 0, error: null })
    await checkDailyQuota(sb, 'photo_analysis_log', 'u1', 5, { where: { mode: 'photo' } })
    expect(calls).toContainEqual(['eq', 'mode', 'photo'])
  })

  it('fails open when the count errors', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { sb } = client({ count: null, error: new Error('no table') })
    expect((await checkDailyQuota(sb, 't', 'u1', 5)).ok).toBe(true)
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('dailyLimit', () => {
  it('reads a positive integer from env, else the default', () => {
    expect(dailyLimit('X', 20, () => '7')).toBe(7)
    expect(dailyLimit('X', 20, () => undefined)).toBe(20)
    expect(dailyLimit('X', 20, () => '0')).toBe(20)
    expect(dailyLimit('X', 20, () => 'lots')).toBe(20)
  })
  it('message names the limit', () => expect(QUOTA_MESSAGE(20)).toContain('20'))
})

describe('functionErrorMessage', () => {
  it("surfaces the server's error from the response body", async () => {
    const error = { context: new Response(JSON.stringify({ error: 'Daily limit reached' })) }
    expect(await functionErrorMessage(error, 'fallback')).toBe('Daily limit reached')
  })
  it('falls back when there is no JSON body', async () => {
    expect(await functionErrorMessage({ context: new Response('oops') }, 'fallback')).toBe(
      'fallback',
    )
    expect(await functionErrorMessage(new Error('x'), 'fallback')).toBe('fallback')
  })
})
