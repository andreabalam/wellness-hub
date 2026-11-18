import { describe, expect, it } from 'vitest'
import { allowedOrigins, DEFAULT_ORIGINS, withCors } from '../../supabase/functions/_shared/cors.ts'

const handler = (req: Request) =>
  req.method === 'OPTIONS'
    ? new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      })
    : new Response('{"ok":true}', {
        status: 201,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      })

const call = (origin: string | null, method = 'POST') =>
  withCors(handler, ['https://app.example', 'http://localhost:5173'])(
    new Request('https://fn.example/x', {
      method,
      headers: origin ? { origin } : {},
    }),
  )

describe('withCors', () => {
  it('echoes an allowed origin and keeps the response intact', async () => {
    const res = await call('http://localhost:5173')
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(res.headers.get('vary')).toContain('Origin')
    expect(res.status).toBe(201)
    expect(res.headers.get('content-type')).toBe('application/json')
    expect(await res.json()).toEqual({ ok: true })
  })

  it('never returns * and refuses other origins', async () => {
    const res = await call('https://evil.example')
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect((await call(null)).headers.get('access-control-allow-origin')).toBe(
      'https://app.example',
    )
  })

  it("rewrites the handler's own preflight reply", async () => {
    const res = await call('https://app.example', 'OPTIONS')
    expect(res.headers.get('access-control-allow-origin')).toBe('https://app.example')
    expect(res.headers.get('access-control-allow-methods')).toBe('POST, OPTIONS')
  })
})

describe('allowedOrigins', () => {
  it('parses the secret, trimming spaces and trailing slashes', () => {
    expect(allowedOrigins(' https://a.example/ , http://localhost:5173')).toEqual([
      'https://a.example',
      'http://localhost:5173',
    ])
  })
  it('falls back to the GitHub Pages + local origins', () => {
    expect(allowedOrigins(undefined)).toBe(DEFAULT_ORIGINS)
    expect(allowedOrigins(' , ')).toBe(DEFAULT_ORIGINS)
  })
})
