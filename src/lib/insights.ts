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
import { exerciseProgress, progressionHint } from './workoutProgress'
import type { ExerciseProgress } from './workoutProgress'
import { addDaysToKey, daysBetweenKeys } from './dateKey'

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
  /** Σ reps × kg over completed weighted sets; null when nothing weighted was logged */
  volumeKg: number | null
}

/** Σ reps × kg over the day's completed weighted sets. */
export function dayVolumeKg(day: DayData): number {
  let v = 0
  for (const s of dayWorkoutSessions(day))
    for (const ex of s.exercises ?? [])
      for (const set of ex.sets)
        if (set.done && set.kg != null && set.reps != null) v += set.kg * set.reps
  return v
}

const shiftWeek = (monday: string, weeks: number) => addDaysToKey(monday, weeks * 7)

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
    const volume = Math.round(ds.reduce((sum, d) => sum + dayVolumeKg(d), 0))
    return {
      week,
      foodDays: fed.length,
      kcalAvg: avg(fed.map(d => d.foods.reduce((s, f) => s + f.k, 0))),
      protAvg: avg(fed.map(d => d.foods.reduce((s, f) => s + f.p, 0))),
      workouts: ds.reduce((s, d) => s + dayWorkoutSessions(d).filter(countsAsWorkout).length, 0),
      medMin: ds.reduce((s, d) => s + medTotals(dayMedSessions(d)).min, 0),
      volumeKg: volume > 0 ? volume : null,
    }
  })
}

// ── This week's wins ─────────────────────────────────────────────

export interface Win {
  kind: 'pr' | 'workouts' | 'protein' | 'meditation' | 'progress'
  icon: string
  text: string
  sub?: string
}

const MAX_PRS = 2

const fmtKgN = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 1 })

function prValue(p: ExerciseProgress, v: number): string {
  return p.unit === 'kg' ? `${fmtKgN(v)} kg` : p.unit === 'reps' ? `${v} reps` : `${v} s`
}

/**
 * Highlights of the current Mon–Sun week, only for things that happened:
 * new personal bests, workouts with weight lifted (vs last week), days that
 * hit the protein target, meditation minutes and exercises ready to progress.
 * An empty week returns [].
 */
export function weekWins(
  days: Record<string, DayData>,
  today: Date,
  opts: { protTarget: number; repTops: Map<string, number> },
): Win[] {
  const [week, last] = weeklySummaries(days, today, 2)
  const wins: Win[] = []

  // New bests: this week's top beats every earlier workout of that exercise
  const progress = exerciseProgress(days)
  const prs: { p: ExerciseProgress; value: number; set: string; was: number; gain: number }[] = []
  for (const p of progress) {
    const before = p.points.filter(x => x.date < week.week)
    const now = p.points.filter(x => x.date >= week.week)
    if (!before.length || !now.length) continue
    const was = Math.max(...before.map(x => x.value))
    const top = now.reduce((a, b) => (b.value > a.value ? b : a))
    if (top.value > was) prs.push({ p, ...top, was, gain: (top.value - was) / (was || 1) })
  }
  prs.sort((a, b) => b.gain - a.gain)
  for (const r of prs.slice(0, MAX_PRS))
    wins.push({
      kind: 'pr',
      icon: '🏆',
      text: `New best: ${r.p.name} ${r.set}`,
      sub: `was ${prValue(r.p, r.was)}`,
    })
  if (prs.length > MAX_PRS)
    wins[wins.length - 1].sub +=
      ` · +${prs.length - MAX_PRS} more new best${prs.length - MAX_PRS === 1 ? '' : 's'}`

  if (week.workouts > 0) {
    const vol = week.volumeKg
    let sub: string | undefined
    if (vol != null && last.volumeKg != null) {
      const pct = Math.round(((vol - last.volumeKg) / last.volumeKg) * 100)
      sub =
        pct === 0
          ? 'same weight lifted as last week'
          : `${pct > 0 ? '+' : '−'}${Math.abs(pct)}% weight lifted vs last week`
    }
    wins.push({
      kind: 'workouts',
      icon: '💪',
      text: `${week.workouts} workout${week.workouts === 1 ? '' : 's'}${vol != null ? ` · ${vol.toLocaleString('en-US')} kg lifted` : ''}`,
      sub,
    })
  }

  if (opts.protTarget > 0) {
    const monday = week.week
    const fed = Object.entries(days).filter(
      ([date, d]) => date >= monday && weekStart(date) === monday && d.foods.length > 0,
    )
    const hit = fed.filter(([, d]) => d.foods.reduce((s, f) => s + f.p, 0) >= opts.protTarget)
    if (hit.length)
      wins.push({
        kind: 'protein',
        icon: '🥩',
        text: `Protein target hit ${hit.length} of ${fed.length} day${fed.length === 1 ? '' : 's'}`,
        sub: `${Math.round(opts.protTarget)} g a day`,
      })
  }

  if (week.medMin > 0)
    wins.push({ kind: 'meditation', icon: '🧘', text: `${week.medMin} min of meditation` })

  const ready = progress.filter(p => progressionHint(p, opts.repTops)).length
  if (ready)
    wins.push({
      kind: 'progress',
      icon: '⬆',
      text: `${ready} exercise${ready === 1 ? '' : 's'} ready to progress`,
      sub: 'see Train → History → Progress',
    })

  return wins
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

const daysBetween = daysBetweenKeys

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
