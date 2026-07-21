/**
 * src/lib/cyclePhase.ts
 *
 * Cycle-phase estimation. Oura's public API does not expose Cycle Insights
 * (verified against openapi-1.35 — no cycle endpoint), so the phase is derived:
 *
 * 1. anchor on the most recent period start — an Oura period tag
 *    (enhanced_tag) when available, else the user's last manual "Menstrual"
 *    selection in tracker history;
 * 2. cycle-day arithmetic (1–5 menstrual, 6–13 follicular, 14–16 ovulatory,
 *    17+ luteal), using the observed average cycle length when ≥2 anchors
 *    exist;
 * 3. a sustained temperature elevation (daily_readiness.temperature_deviation)
 *    nudges follicular→luteal near the boundary, never overriding a fresh
 *    period anchor.
 *
 * Everything here is pure — callers fetch tags/temps and pass them in.
 */
import type { DayData } from '../data/tracker'

export interface CycleAnchor {
  date: string // YYYY-MM-DD period start
  source: 'oura-tag' | 'manual'
}

export interface PhaseSuggestion {
  phase: 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal'
  source: 'oura-tag' | 'manual'
  cycleDay: number
}

const DAY_MS = 86_400_000
const DEFAULT_CYCLE_LEN = 28
const MIN_CYCLE_LEN = 21
const MAX_CYCLE_LEN = 40

function toDate(key: string): Date {
  return new Date(key + 'T12:00:00')
}

function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY_MS)
}

/**
 * Period-start anchors from Oura period tags. Consecutive tagged days collapse
 * to one anchor (the first day). `tagDays` are the start_day values of tags
 * whose tag_type_code matches a period code, any order.
 */
export function anchorsFromTags(tagDays: string[]): CycleAnchor[] {
  const sorted = [...new Set(tagDays)].sort()
  const anchors: CycleAnchor[] = []
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0 || daysBetween(sorted[i - 1], sorted[i]) > 1)
      anchors.push({ date: sorted[i], source: 'oura-tag' })
  }
  return anchors
}

/**
 * Period-start anchors from manual tracker history: days with
 * phase === 'Menstrual' whose previous calendar day isn't.
 */
export function anchorsFromTracker(days: Record<string, DayData>): CycleAnchor[] {
  const menstrual = Object.keys(days)
    .filter(k => days[k].phase === 'Menstrual')
    .sort()
  const set = new Set(menstrual)
  return menstrual
    .filter(k => {
      const prev = new Date(toDate(k).getTime() - DAY_MS)
      const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
      return !set.has(prevKey)
    })
    .map(date => ({ date, source: 'manual' as const }))
}

/** Observed average cycle length from consecutive anchors; 28 when <2 usable gaps. */
export function cycleLength(anchors: CycleAnchor[]): number {
  const dates = [...new Set(anchors.map(a => a.date))].sort()
  const gaps: number[] = []
  for (let i = 1; i < dates.length; i++) {
    const gap = daysBetween(dates[i - 1], dates[i])
    if (gap >= MIN_CYCLE_LEN && gap <= MAX_CYCLE_LEN) gaps.push(gap)
  }
  if (!gaps.length) return DEFAULT_CYCLE_LEN
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length)
}

export function phaseForCycleDay(day: number): PhaseSuggestion['phase'] {
  if (day <= 5) return 'Menstrual'
  if (day <= 13) return 'Follicular'
  if (day <= 16) return 'Ovulatory'
  return 'Luteal'
}

/**
 * Estimate the phase for `date`.
 *
 * `tempDeviations` — recent temperature_deviation values (°C, most recent
 * last, ideally the 5 days up to `date`). A sustained elevation (≥3 of the
 * last 5 readings ≥ +0.2 °C) marks the luteal rise: it pulls a late-follicular
 * /ovulatory estimate (day ≥ 12) forward to Luteal. It never overrides
 * Menstrual — a fresh period anchor is stronger evidence.
 */
export function estimatePhase(
  date: string,
  ouraTagDays: string[],
  trackerDays: Record<string, DayData>,
  tempDeviations: number[] = [],
): PhaseSuggestion | null {
  const anchors = [...anchorsFromTags(ouraTagDays), ...anchorsFromTracker(trackerDays)]
  const past = anchors.filter(a => daysBetween(a.date, date) >= 0)
  if (!past.length) return null
  // Prefer the most recent anchor; on the same date an oura tag wins.
  past.sort((a, b) =>
    a.date === b.date ? (a.source === 'oura-tag' ? 1 : -1) : a.date < b.date ? -1 : 1,
  )
  const anchor = past[past.length - 1]

  const len = cycleLength(anchors)
  const cycleDay = (daysBetween(anchor.date, date) % len) + 1

  let phase = phaseForCycleDay(cycleDay)
  const recent = tempDeviations.slice(-5)
  const elevated = recent.filter(t => t >= 0.2).length >= 3
  if (elevated && phase !== 'Menstrual' && cycleDay >= 12) phase = 'Luteal'

  return { phase, source: anchor.source, cycleDay }
}
