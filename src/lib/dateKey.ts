/**
 * Day keys — the single source of truth for 'YYYY-MM-DD' strings.
 *
 * Every day key in the app is a LOCAL calendar date (what the user sees on
 * their clock). Never build one from `toISOString()` — that is UTC, which in
 * the Americas rolls over to tomorrow every evening, and in Asia/Oceania
 * puts local midnight on yesterday.
 *
 * Keys are parsed back to local NOON so that ±1-day arithmetic is immune to
 * DST transitions (a 23- or 25-hour day can't push noon across midnight).
 */

const pad = (n: number) => String(n).padStart(2, '0')

/** Date → local 'YYYY-MM-DD'. */
export function dkey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Today's local key. */
export function todayKey(): string {
  return dkey(new Date())
}

/** 'YYYY-MM-DD' → Date at local noon of that day. */
export function fromKey(key: string): Date {
  return new Date(key + 'T12:00:00')
}

/** Shift a day key by n calendar days. */
export function addDaysToKey(key: string, n: number): string {
  const d = fromKey(key)
  d.setDate(d.getDate() + n)
  return dkey(d)
}

/** Shift a Date by n calendar days (time of day preserved). */
export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

/** Local midnight of the Monday that starts d's week. */
export function mondayOf(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

/** Whole calendar days from key a to key b (b − a). */
export function daysBetweenKeys(a: string, b: string): number {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000)
}
