import { describe, expect, it, vi } from 'vitest'
import {
  isPrivateIPv4,
  isPrivateIPv6,
  isSafePublicUrl,
  safeFetchText,
} from '../../supabase/functions/_shared/safeFetch.ts'

const OPTS = { maxBytes: 1000, timeoutMs: 1000 }

function res(status: number, body = '', headers: Record<string, string> = {}): Response {
  return new Response(status >= 300 && status < 400 ? null : body, { status, headers })
}

describe('isSafePublicUrl', () => {
  it.each([
    'https://www.example.com/recipe',
    'http://cooking.example.org/a?b=1',
    'https://93.184.216.34/recipe',
  ])('allows %s', url => expect(isSafePublicUrl(url)).toBe(true))

  it.each([
    'ftp://example.com/x',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://localhost/',
    'http://api.localhost/',
    'http://127.0.0.1/',
    'http://2130706433/', // decimal 127.0.0.1
    'http://0x7f.1/', // hex short form
    'http://10.0.0.5/',
    'http://172.20.1.1/',
    'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/', // cloud metadata
    'http://100.100.100.200/', // CGNAT / Alibaba metadata
    'http://0.0.0.0/',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://metadata.google.internal/',
    'http://printer.local/',
    'http://intranet/',
    'https://example.com:8443/',
    'http://user:pass@example.com/',
    'not a url',
  ])('blocks %s', url => expect(isSafePublicUrl(url)).toBe(false))
})

describe('private address ranges', () => {
  it('classifies IPv4', () => {
    expect(isPrivateIPv4('8.8.8.8')).toBe(false)
    expect(isPrivateIPv4('100.63.255.255')).toBe(false)
    expect(isPrivateIPv4('100.64.0.1')).toBe(true)
    expect(isPrivateIPv4('224.0.0.1')).toBe(true)
  })
  it('classifies IPv6', () => {
    expect(isPrivateIPv6('2606:4700::1111')).toBe(false)
    expect(isPrivateIPv6('::1')).toBe(true)
    expect(isPrivateIPv6('fe80::1')).toBe(true)
    expect(isPrivateIPv6('fc00::1')).toBe(true)
    expect(isPrivateIPv6('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateIPv6('::ffff:7f00:1')).toBe(true)
    expect(isPrivateIPv6('::ffff:8.8.8.8')).toBe(false)
  })
})

describe('safeFetchText', () => {
  it('returns the body of a public page', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, '<h1>Soup</h1>'))
    await expect(safeFetchText('https://example.com/soup', { ...OPTS, fetchImpl })).resolves.toBe(
      '<h1>Soup</h1>',
    )
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' })
  })

  it('follows a redirect to another public URL', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(301, '', { location: '/moved' }))
      .mockResolvedValueOnce(res(200, 'ok'))
    await expect(safeFetchText('https://example.com/a', { ...OPTS, fetchImpl })).resolves.toBe('ok')
    expect(fetchImpl.mock.calls[1][0]).toBe('https://example.com/moved')
  })

  it('refuses a redirect into a private address (the SSRF hole)', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(res(302, '', { location: 'http://169.254.169.254/latest/' }))
    await expect(
      safeFetchText('https://evil.example.com/', { ...OPTS, fetchImpl }),
    ).rejects.toThrow('Invalid or disallowed URL')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('stops after too many redirects', async () => {
    const fetchImpl = vi.fn().mockImplementation(async () => res(302, '', { location: '/again' }))
    await expect(
      safeFetchText('https://example.com/', { ...OPTS, fetchImpl, maxRedirects: 2 }),
    ).rejects.toThrow('Too many redirects')
    expect(fetchImpl).toHaveBeenCalledTimes(3)
  })

  it('refuses a hostname that resolves to a private address', async () => {
    const fetchImpl = vi.fn()
    const resolve = vi.fn().mockResolvedValue(['127.0.0.1'])
    await expect(
      safeFetchText('https://127.0.0.1.nip.io/', { ...OPTS, fetchImpl, resolve }),
    ).rejects.toThrow('Invalid or disallowed URL')
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('refuses an unresolvable host, allows when resolution is unavailable', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(res(200, 'ok'))
    await expect(
      safeFetchText('https://nope.example/', { ...OPTS, fetchImpl, resolve: async () => [] }),
    ).rejects.toThrow('Could not resolve host')
    await expect(
      safeFetchText('https://example.com/', { ...OPTS, fetchImpl, resolve: async () => null }),
    ).resolves.toBe('ok')
  })

  it('caps the body while streaming and by declared length', async () => {
    const big = 'x'.repeat(2000)
    await expect(
      safeFetchText('https://example.com/', {
        ...OPTS,
        fetchImpl: vi.fn().mockResolvedValue(res(200, big)),
      }),
    ).rejects.toThrow('Page too large')
    await expect(
      safeFetchText('https://example.com/', {
        ...OPTS,
        fetchImpl: vi.fn().mockResolvedValue(res(200, 'small', { 'content-length': '5000' })),
      }),
    ).rejects.toThrow('Page too large')
  })

  it('surfaces HTTP errors and timeouts', async () => {
    await expect(
      safeFetchText('https://example.com/', {
        ...OPTS,
        fetchImpl: vi.fn().mockResolvedValue(res(404)),
      }),
    ).rejects.toThrow('Could not fetch page (404)')
    const hang = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal!.addEventListener('abort', () =>
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
          ),
        ),
    )
    await expect(
      safeFetchText('https://example.com/', { ...OPTS, timeoutMs: 10, fetchImpl: hang as never }),
    ).rejects.toThrow('URL fetch timed out')
  })
})
