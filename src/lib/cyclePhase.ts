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
 * 2b. a phase set by hand (Follicular / Ovulatory / Luteal) after the last
 *    period re-anchors the count when it disagrees with the estimate, so the
 *    correction carries forward instead of applying to that one day;
 * 3. a confirmed post-ovulation temperature shift in the current cycle
 *    (daily_readiness.temperature_deviation, "3 over 6" rule) marks Luteal;
 *    without one, a sustained recent elevation still nudges follicular→luteal
 *    near the boundary. Temperature never overrides a fresh period anchor.
 *
 * Everything here is pure — callers fetch tags/temps and pass them in.
 */
import type { DayData } from '../data/tracker'
import { addDaysToKey, daysBetweenKeys } from './dateKey'

export interface CycleAnchor {
  date: string // YYYY-MM-DD period start
  source: 'oura-tag' | 'manual'
}

export interface PhaseSuggestion {
  phase: 'Menstrual' | 'Follicular' | 'Ovulatory' | 'Luteal'
  source: 'oura-tag' | 'manual'
  cycleDay: number
  /** Start date (YYYY-MM-DD) of the period this cycle is counted from */
  anchorDate: string
  /** True when no period was logged for this cycle — anchorDate is projected
   *  forward from an older period by the average cycle length */
  anchorEstimated?: boolean
  /** First day of the confirmed temperature rise in this cycle, when detected */
  tempShift?: string
}

/** One nightly temperature_deviation reading (°C from the user's baseline). */
export interface TempReading {
  date: string // YYYY-MM-DD
  dev: number
}

const DEFAULT_CYCLE_LEN = 28
const MIN_CYCLE_LEN = 21
const MAX_CYCLE_LEN = 40

const daysBetween = daysBetweenKeys
const addDaysKey = addDaysToKey

/** Marks within this many days of a period's first day belong to that same
 *  period — a cycle can't be shorter than MIN_CYCLE_LEN, so a second
 *  "period started" tap (or Oura tag) a few days in isn't a new cycle. */
const SAME_PERIOD_DAYS = 10

/** First cycle day of each phase — where a by-hand phase pins the count. */
const PHASE_START_DAY: Record<Exclude<PhaseSuggestion['phase'], 'Menstrual'>, number> = {
  Follicular: 6,
  Ovulatory: 14,
  Luteal: 17,
}

/** Earliest cycle day a temperature shift is accepted (earlier rises are noise). */
const MIN_SHIFT_CYCLE_DAY = 10
/** How far the third high reading must clear the baseline (°C). */
const SHIFT_MARGIN = 0.1

/**
 * Period-start anchors from Oura period tags. Consecutive tagged days collapse
 * to one anchor (the first day). `tagDays` are the start_day values of tags
 * whose tag_type_code matches a period code, any order.
 */
export function anchorsFromTags(tagDays: string[]): CycleAnchor[] {
  return periodStarts(tagDays).map(date => ({ date, source: 'oura-tag' as const }))
}

/** First day of each period in a set of period-marked days (any order). */
function periodStarts(markedDays: string[]): string[] {
  const sorted = [...new Set(markedDays)].sort()
  const starts: string[] = []
  for (const d of sorted) {
    const start = starts[starts.length - 1]
    if (!start || daysBetween(start, d) > SAME_PERIOD_DAYS) starts.push(d)
  }
  return starts
}

/**
 * Period-start anchors from manual tracker history: the first of each run of
 * phase === 'Menstrual' days (gaps up to SAME_PERIOD_DAYS stay one period).
 */
export function anchorsFromTracker(days: Record<string, DayData>): CycleAnchor[] {
  return periodStarts(Object.keys(days).filter(k => days[k].phase === 'Menstrual')).map(date => ({
    date,
    source: 'manual' as const,
  }))
}

/** Non-menstrual phases the user set by hand, oldest first. */
function phaseHints(days: Record<string, DayData>): { date: string; startDay: number }[] {
  return Object.keys(days)
    .filter(k => days[k].phase in PHASE_START_DAY)
    .sort()
    .map(date => ({
      date,
      startDay: PHASE_START_DAY[days[date].phase as keyof typeof PHASE_START_DAY],
    }))
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
 * Post-ovulation temperature shift ("3 over 6" rule): the first of three
 * consecutive readings that are all above the highest of the six readings
 * before them, with the third clearing that baseline by SHIFT_MARGIN.
 * Returns that first high reading's date, or null. Missing nights are
 * skipped — the rule runs over consecutive readings, not calendar days.
 */
export function detectTempShift(readings: TempReading[]): string | null {
  const byDate = new Map(readings.map(r => [r.date, r.dev]))
  const sorted = [...byDate.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  for (let i = 6; i + 2 < sorted.length; i++) {
    const base = Math.max(...sorted.slice(i - 6, i).map(([, dev]) => dev))
    const [a, b, c] = [sorted[i][1], sorted[i + 1][1], sorted[i + 2][1]]
    if (a > base && b > base && c >= base + SHIFT_MARGIN) return sorted[i][0]
  }
  return null
}

/**
 * Estimate the phase for `date`.
 *
 * `temps` — nightly temperature_deviation readings, any order; readings
 * after `date` are ignored. A temperature shift detected within the current
 * cycle (on or after cycle day 10) marks Luteal. Without one, a sustained
 * elevation (≥3 of the last 5 readings ≥ +0.2 °C) pulls a late-follicular
 * /ovulatory estimate (day ≥ 12) forward to Luteal. Neither overrides
 * Menstrual — a fresh period anchor is stronger evidence.
 */
export function estimatePhase(
  date: string,
  ouraTagDays: string[],
  trackerDays: Record<string, DayData>,
  temps: TempReading[] = [],
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
  const dayOf = (from: string, d: string) => (daysBetween(from, d) % len) + 1

  // The latest by-hand phase since that period, up to `date`, wins when it
  // disagrees with the count: re-anchor so it falls on its phase's first day.
  let countFrom = anchor.date
  const hint = phaseHints(trackerDays)
    .filter(h => h.date > anchor.date && h.date <= date)
    .pop()
  if (hint) {
    const hintDay = dayOf(anchor.date, hint.date)
    const hinted = phaseForCycleDay(hint.startDay)
    if (phaseForCycleDay(hintDay) !== hinted)
      countFrom = addDaysKey(hint.date, -(hint.startDay - 1))
  }
  const cycleDay = dayOf(countFrom, date)

  let phase = phaseForCycleDay(cycleDay)

  const cycleStart = addDaysKey(date, -(cycleDay - 1))
  const known = temps.filter(t => t.date <= date).sort((a, b) => (a.date < b.date ? -1 : 1))
  const shift = detectTempShift(known.filter(t => t.date >= cycleStart))
  const tempShift =
    shift && daysBetween(cycleStart, shift) + 1 >= MIN_SHIFT_CYCLE_DAY ? shift : undefined

  const recent = known.slice(-5).map(t => t.dev)
  const elevated = recent.filter(t => t >= 0.2).length >= 3
  if (phase !== 'Menstrual' && (tempShift || (elevated && cycleDay >= 12))) phase = 'Luteal'

  return {
    phase,
    source: anchor.source,
    cycleDay,
    anchorDate: cycleStart,
    ...(cycleStart !== anchor.date && { anchorEstimated: true }),
    ...(tempShift && { tempShift }),
  }
}
