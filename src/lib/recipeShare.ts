/**
 * Self-contained recipe sharing.
 *
 * A recipe is shared as a link to the hash route `#/r/<token>`. Today the token
 * IS the recipe — gzip-compressed JSON, base64url-encoded — so nothing is stored
 * on a server and the link works for anyone, offline.
 *
 * Forward-compatibility: the token and its resolution are isolated here. To move
 * to short DB-hosted links later, add a `fetchSharedRecipe(token)` and branch in
 * `resolveShareToken` on whether the token looks like an opaque id vs. an inline
 * payload — the route, viewer, and import UI stay untouched.
 */

import type { Recipe } from '../data/recipes'

/** Fields that are local/account-specific and must not travel in a shared link. */
const STRIP_FIELDS = ['id', 'defaultId', 'hidden', 'source', 'custom'] as const

// ── base64url helpers ─────────────────────────────────────────────

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function gzip(input: string): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  const out = new Response(cs.readable).arrayBuffer()
  // Float writes; the readable side surfaces any error. Swallow writer-side
  // rejections so malformed input doesn't produce an unhandled rejection.
  writer.write(new TextEncoder().encode(input)).catch(() => {})
  writer.close().catch(() => {})
  return new Uint8Array(await out)
}

async function gunzip(bytes: Uint8Array): Promise<string> {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  const out = new Response(ds.readable).text()
  writer.write(bytes as BufferSource).catch(() => {})
  writer.close().catch(() => {})
  return out
}

// ── Public API ────────────────────────────────────────────────────

/** Serialize a recipe into a compact, URL-safe share token. */
export async function encodeRecipe(recipe: Recipe): Promise<string> {
  const portable: Record<string, unknown> = { ...recipe }
  for (const f of STRIP_FIELDS) delete portable[f]
  const compressed = await gzip(JSON.stringify(portable))
  return bytesToBase64url(compressed)
}

/** Decode a share token back into a recipe. Returns null if the token is malformed. */
export async function decodeRecipe(token: string): Promise<Recipe | null> {
  try {
    const json = await gunzip(base64urlToBytes(token))
    const obj = JSON.parse(json) as Recipe
    if (!obj || typeof obj.name !== 'string' || !Array.isArray(obj.ings)) return null
    return obj
  } catch {
    return null
  }
}

/** Build a full shareable URL for a recipe (origin + app base + hash route). */
export async function buildShareUrl(recipe: Recipe): Promise<string> {
  const token = await encodeRecipe(recipe)
  const base = import.meta.env.BASE_URL || '/'          // e.g. "/wellness-hub/"
  const path = `${location.origin}${base}`.replace(/\/+$/, '/')
  return `${path}#/r/${token}`
}

/** Extract the share token from a location hash, or null if the hash isn't a share route. */
export function parseShareRoute(hash: string): string | null {
  const m = hash.match(/^#\/r\/(.+)$/)
  return m ? m[1] : null
}

/**
 * Resolve a share token to a recipe. Currently always inline-decodes; kept as the
 * single seam where future DB-hosted short tokens would branch in.
 */
export function resolveShareToken(token: string): Promise<Recipe | null> {
  return decodeRecipe(token)
}
