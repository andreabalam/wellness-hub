/**
 * Covers errorLog's persistence path with supabase + sync mocked, so we verify
 * the actual "write a log row to the DB" behavior (which is null-guarded out of
 * the plain errorLog.test.ts environment).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

const { getUser, pushErrorLog } = vi.hoisted(() => ({
  getUser: vi.fn(),
  pushErrorLog: vi.fn(),
}))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser } },
  isConfigured: true,
}))
vi.mock('../lib/sync', () => ({ pushErrorLog }))

import { reportError, _resetErrorLogDedupe } from '../lib/errorLog'

/** Let queued microtasks (the fire-and-forget persist) settle. */
const flushPromises = () => new Promise(r => setTimeout(r, 0))

describe('reportError persistence', () => {
  beforeEach(() => {
    _resetErrorLogDedupe()
    getUser.mockReset()
    pushErrorLog.mockReset()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('persists a log row with the signed-in user id and metadata', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'uid-9' } } })
    pushErrorLog.mockResolvedValue(undefined)

    reportError('syncAll:push', new Error('boom'))
    await flushPromises()

    expect(pushErrorLog).toHaveBeenCalledTimes(1)
    expect(pushErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'uid-9',
        context: 'syncAll:push',
        message: 'boom',
        severity: 'error',
      }),
    )
  })

  it('logs anonymously (user_id null) when getUser fails', async () => {
    getUser.mockRejectedValue(new Error('signed out'))
    pushErrorLog.mockResolvedValue(undefined)

    reportError('ctx', new Error('x'))
    await flushPromises()

    expect(pushErrorLog).toHaveBeenCalledWith(expect.objectContaining({ userId: null }))
  })

  it('swallows a persistence failure without throwing', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    pushErrorLog.mockRejectedValue(new Error('db down'))

    expect(() => reportError('ctx', new Error('x'))).not.toThrow()
    await flushPromises()
    expect(pushErrorLog).toHaveBeenCalled()
  })
})
