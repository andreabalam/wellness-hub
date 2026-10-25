/**
 * src/lib/insights.ts
 *
 * Pure roll-ups for the Insights tab: per-week averages from tracker days and
 * the cycle history (period starts + lengths). Callers pass tracker data.
 */
import type { DayData } from '../data/tracker'
import { dayMedSessions, dayWorkoutSessions, medTotals } from '../data/tracker'
import { anchorsFromTags, anchorsFromTracker, cycleLength } from './cyclePhase'
import { countsAsWorkout, weekStart } from './workoutWeeks'

// ── Weekly summaries ─────────────────────────────────────────────

export interface WeekSummary {
  week: string // Monday YYYY-MM-DD
  /** Days with any food logged */
  foodDays: number
  /** Averages over days that have data; null when none */
  kcalAvg: number | null
  protAvg: number | null
  workouts: number
  medMin: number
  energyAvg: number | null
  sleepAvg: number | null
  moodAvg: number | null
  stressAvg: number | null
}

function shiftWeek(monday: string, weeks: number): string {
  const d = new Date(monday + 'T12:00:00')
  d.setDate(d.getDate() + weeks * 7)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const avg = (xs: number[]) =>
  xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null

/** The last `n` Mon–Sun weeks ending with the current one, newest first. */
export function weeklySummaries(days: Record<string, DayData>, today: Date, n = 8): WeekSummary[] {
  const current = weekStart(today)
  const weeks = Array.from({ length: n }, (_, i) => shiftWeek(current, -i))
  const bucket = new Map<string, DayData[]>(weeks.map(w => [w, []]))
  for (const [date, day] of Object.entries(days)) bucket.get(weekStart(date))?.push(day)

  return weeks.map(week => {
    const ds = bucket.get(week)!
    const fed = ds.filter(d => d.foods.length > 0)
    const rated = (k: 'energy' | 'sleep' | 'mood' | 'stress') =>
      avg(ds.map(d => d[k]).filter(v => v > 0))
    return {
      week,
      foodDays: fed.length,
      kcalAvg: avg(fed.map(d => d.foods.reduce((s, f) => s + f.k, 0))),
      protAvg: avg(fed.map(d => d.foods.reduce((s, f) => s + f.p, 0))),
      workouts: ds.reduce((s, d) => s + dayWorkoutSessions(d).filter(countsAsWorkout).length, 0),
      medMin: ds.reduce((s, d) => s + medTotals(dayMedSessions(d)).min, 0),
      energyAvg: rated('energy'),
      sleepAvg: rated('sleep'),
      moodAvg: rated('mood'),
      stressAvg: rated('stress'),
    }
  })
}

// ── Cycle history ────────────────────────────────────────────────

export interface CyclePeriod {
  start: string
  source: 'oura-tag' | 'manual'
  /** Days until the next period started; null for the current cycle */
  length: number | null
}

/** Same period logged in Oura and marked by hand counts once (Oura wins). */
const SAME_PERIOD_DAYS = 5

function daysBetween(a: string, b: string): number {
  return Math.round(
    (new Date(b + 'T12:00:00').getTime() - new Date(a + 'T12:00:00').getTime()) / 86_400_000,
  )
}

/** Period starts newest first, with each cycle's length, plus the average length. */
export function cycleHistory(
  tagDays: string[],
  trackerDays: Record<string, DayData>,
): { periods: CyclePeriod[]; avgLength: number } {
  const all = [...anchorsFromTags(tagDays), ...anchorsFromTracker(trackerDays)].sort((a, b) =>
    a.date === b.date ? (a.source === 'oura-tag' ? -1 : 1) : a.date < b.date ? -1 : 1,
  )
  const starts: Omit<CyclePeriod, 'length'>[] = []
  for (const a of all) {
    const prev = starts[starts.length - 1]
    if (prev && daysBetween(prev.start, a.date) < SAME_PERIOD_DAYS) {
      if (a.source === 'oura-tag' && prev.source === 'manual')
        starts[starts.length - 1] = { start: prev.start, source: 'oura-tag' }
      continue
    }
    starts.push({ start: a.date, source: a.source })
  }
  const periods = starts.map((p, i) => ({
    ...p,
    length: i + 1 < starts.length ? daysBetween(p.start, starts[i + 1].start) : null,
  }))
  return {
    periods: periods.reverse(),
    avgLength: cycleLength(starts.map(p => ({ date: p.start, source: p.source }))),
  }
}
