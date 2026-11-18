import { describe, expect, it } from 'vitest'
import { functionErrorMessage } from '../lib/functionError'

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
