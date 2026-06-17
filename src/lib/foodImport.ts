/**
 * Client-side helpers for the tracker's "paste to log" flow.
 *
 * `parseFoodLog` sends a pasted text block to the parse-food-log Edge Function,
 * which uses Claude to split it into foods and estimate per-serving macros.
 *
 * `parseFoodLogLocal` is an offline / signed-out fallback: it parses only the
 * lines it can read without AI — explicit "Name k p c f fi" rows and bare names
 * that match the user's food library. It never guesses macros.
 */

import type { QuickFood } from '../data/tracker'
import { supabase } from './supabase'

// Keep in sync with MAX_TEXT_CHARS in the edge function.
const MAX_TEXT_CHARS = 8_000

// ── AI-backed parse ────────────────────────────────────────────────

/**
 * Parse a pasted food log into entries via the parse-food-log edge function
 * (Claude estimates per-serving macros). `supabase.functions.invoke` attaches
 * the signed-in user's JWT automatically. Throws on empty input, when the
 * client is unavailable, or when nothing parseable comes back.
 */
export async function parseFoodLog(text: string): Promise<QuickFood[]> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Paste some food text first.')
  if (!supabase) throw new Error('Sign in to parse pasted text with AI.')

  const { data, error } = await supabase.functions.invoke('parse-food-log', {
    body: { text: trimmed.slice(0, MAX_TEXT_CHARS) },
  })
  if (error) throw new Error(error.message || 'Parse failed — please try again.')

  const entries = (data as { entries?: QuickFood[] } | null)?.entries
  if (!entries?.length) throw new Error('No foods found in that text')
  return entries
}

// ── Local fallback ─────────────────────────────────────────────────

/** Strip a leading bullet or "1." / "1)" marker from a line. */
function stripMarker(line: string): string {
  return line
    .replace(/^[\s\-*•]+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .trim()
}

const round = (n: number) => (Number.isFinite(n) && n >= 0 ? Math.round(n) : 0)

/**
 * Parse what's possible without AI:
 *  - "Berry Oats 350 18 42 12 9"  → name + (k, p, c, f, fi) in order
 *  - a bare name matching a food-library entry (case-insensitive) → its macros
 * Lines it can't read are skipped. Used when signed out or offline.
 */
export function parseFoodLogLocal(text: string, library: QuickFood[]): QuickFood[] {
  const byName = new Map(library.map(f => [f.n.toLowerCase(), f]))
  const out: QuickFood[] = []

  for (const raw of text.split(/\r?\n/)) {
    const line = stripMarker(raw)
    if (!line) continue

    // 1) Explicit trailing macro numbers: name (ends in a non-digit) then 1–5 numbers.
    const m = line.match(/^(.*?\D)\s+(\d[\d.,\s]*)$/)
    if (m) {
      const name = m[1].trim()
      const nums = (m[2].match(/[\d.]+/g) ?? []).map(Number)
      if (name && nums.length && nums[0] > 0) {
        const [k = 0, p = 0, c = 0, f = 0, fi = 0] = nums
        out.push({ n: name, k: round(k), p: round(p), c: round(c), f: round(f), fi: round(fi) })
        continue
      }
    }

    // 2) Bare name that matches a remembered food.
    const hit = byName.get(line.toLowerCase())
    if (hit) out.push({ ...hit })
  }

  return out
}
