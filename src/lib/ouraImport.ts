/**
 * src/lib/ouraImport.ts
 *
 * Silent import of Oura workouts / meditation sessions into the tracker's
 * structured session lists. Pure mapping + merge logic lives here so it is
 * unit-testable; network calls go through the typed helpers in oura.ts.
 *
 * Policy:
 * - oura-sourced sessions are keyed `oura-<id>`; re-import replaces the whole
 *   oura subset for the date (Oura-side edits propagate), manual entries are
 *   never touched.
 * - a removed oura session is remembered in a per-date tombstone list so the
 *   next import doesn't resurrect it.
 * - past days are effectively immutable in Oura: import once. Today/yesterday
 *   re-import when the last attempt is older than IMPORT_TTL_MS.
 */
import type { MedSession, WorkoutSession } from '../data/tracker'
import type { OuraSession, OuraWorkout } from './oura'
import { fetchOuraSessions, fetchOuraWorkouts, OURA_ACTIVITY_MAP, OURA_SESSION_MAP } from './oura'
import { safeGet, safeSet } from './storage'

const IMPORT_STAMP_KEY = 'whub_oura_import_v1' // Record<date, { wk?: number; med?: number }>
const TOMBSTONE_KEY = 'whub_oura_dismissed_v1' // Record<date, string[]>
const IMPORT_TTL_MS = 30 * 60 * 1000

// ── Mapping ──────────────────────────────────────────────────────

export function mapOuraWorkout(w: OuraWorkout): WorkoutSession {
  const min = Math.max(
    1,
    Math.round((new Date(w.end_datetime).getTime() - new Date(w.start_datetime).getTime()) / 60000),
  )
  return {
    id: `oura-${w.id}`,
    src: 'oura',
    type: OURA_ACTIVITY_MAP[w.activity] ?? w.activity,
    label: w.activity.replace(/_/g, ' '),
    min,
    ...(w.calories > 0 && { kcal: Math.round(w.calories) }),
    ...(w.average_heart_rate != null && { avgHr: Math.round(w.average_heart_rate) }),
    ...(w.max_heart_rate != null && { maxHr: Math.round(w.max_heart_rate) }),
  }
}

/** Naps are not meditation — returns null for them. */
export function mapOuraMedSession(s: OuraSession): MedSession | null {
  if (s.type === 'nap') return null
  const min = Math.max(
    1,
    Math.round((new Date(s.end_datetime).getTime() - new Date(s.start_datetime).getTime()) / 60000),
  )
  return {
    id: `oura-${s.id}`,
    src: 'oura',
    min,
    style: OURA_SESSION_MAP[s.type] ?? 'Guided',
    ...(s.average_hrv != null && { hrv: Math.round(s.average_hrv) }),
    ...(s.average_heart_rate != null && { hr: Math.round(s.average_heart_rate) }),
    ...(s.mood != null && { mood: s.mood }),
  }
}

// ── Merge ────────────────────────────────────────────────────────

/**
 * Replace the oura-sourced subset of `existing` with `imported` (minus
 * tombstoned ids); manual entries keep their positions after the oura block.
 */
export function mergeSessions<T extends { id: string; src: 'oura' | 'manual' }>(
  existing: T[],
  imported: T[],
  dismissed: string[],
): T[] {
  const keep = imported.filter(s => !dismissed.includes(s.id))
  return [...keep, ...existing.filter(s => s.src === 'manual')]
}

/** True when the merge would actually change the stored list. */
export function sessionsChanged<T extends { id: string }>(before: T[], after: T[]): boolean {
  return (
    before.length !== after.length ||
    before.some((s, i) => s.id !== after[i].id) ||
    JSON.stringify(before) !== JSON.stringify(after)
  )
}

// ── Tombstones ───────────────────────────────────────────────────

export function dismissedIds(date: string): string[] {
  return safeGet<Record<string, string[]>>(TOMBSTONE_KEY, {})[date] ?? []
}

/** Remember a removed oura session so auto-import doesn't resurrect it. */
export function dismissOuraSession(date: string, id: string): void {
  const all = safeGet<Record<string, string[]>>(TOMBSTONE_KEY, {})
  all[date] = [...(all[date] ?? []).filter(x => x !== id), id]
  safeSet(TOMBSTONE_KEY, all)
}

// ── Fetch policy ─────────────────────────────────────────────────

type ImportKind = 'wk' | 'med'

function isRecentDate(date: string, now: number): boolean {
  const d = new Date(date + 'T12:00:00')
  const ageDays = (now - d.getTime()) / 86_400_000
  return ageDays < 2 // today or yesterday — Oura may still add data
}

export function shouldImport(date: string, kind: ImportKind, now = Date.now()): boolean {
  const stamp = safeGet<Record<string, Partial<Record<ImportKind, number>>>>(IMPORT_STAMP_KEY, {})[
    date
  ]?.[kind]
  if (stamp === undefined) return true
  return isRecentDate(date, now) && now - stamp > IMPORT_TTL_MS
}

export function markImported(date: string, kind: ImportKind, now = Date.now()): void {
  const all = safeGet<Record<string, Partial<Record<ImportKind, number>>>>(IMPORT_STAMP_KEY, {})
  all[date] = { ...all[date], [kind]: now }
  safeSet(IMPORT_STAMP_KEY, all)
}

// ── High-level importers ─────────────────────────────────────────

/**
 * Fetch + merge Oura workouts for a date. Returns the merged list when it
 * differs from `existing`, or null when there is nothing new (or the fetch
 * policy says skip). `force` bypasses the policy (manual sync button).
 */
export async function importOuraWorkouts(
  date: string,
  existing: WorkoutSession[],
  force = false,
): Promise<WorkoutSession[] | null> {
  if (!force && !shouldImport(date, 'wk')) return null
  const workouts = await fetchOuraWorkouts(date)
  markImported(date, 'wk')
  const merged = mergeSessions(existing, workouts.map(mapOuraWorkout), dismissedIds(date))
  return sessionsChanged(existing, merged) ? merged : null
}

/** Same as importOuraWorkouts for meditation sessions. */
export async function importOuraMeditations(
  date: string,
  existing: MedSession[],
  force = false,
): Promise<MedSession[] | null> {
  if (!force && !shouldImport(date, 'med')) return null
  const sessions = await fetchOuraSessions(date)
  markImported(date, 'med')
  const mapped = sessions.map(mapOuraMedSession).filter((s): s is MedSession => s !== null)
  const merged = mergeSessions(existing, mapped, dismissedIds(date))
  return sessionsChanged(existing, merged) ? merged : null
}
