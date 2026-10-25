/**
 * src/lib/workoutProgress.ts
 *
 * Train tab History & Progress: past weeks with their workouts, and a
 * per-exercise trend from the logged sets. Pure — callers pass tracker days.
 */
import type { DayData, LoggedSet, WorkoutSession } from '../data/tracker'
import { dayWorkoutSessions } from '../data/tracker'
import { normalizeName } from './workoutLog'
import { weekStart } from './workoutWeeks'

// ── History ──────────────────────────────────────────────────────

export interface HistoryDay {
  date: string
  sessions: WorkoutSession[]
}

export interface HistoryWeek {
  week: string // Monday YYYY-MM-DD
  days: HistoryDay[] // newest first, only days with sessions
}

/** Weeks with any logged or imported workout, newest first. */
export function workoutHistory(days: Record<string, DayData>): HistoryWeek[] {
  const byWeek = new Map<string, HistoryDay[]>()
  for (const date of Object.keys(days).sort().reverse()) {
    const sessions = dayWorkoutSessions(days[date])
    if (!sessions.length) continue
    const w = weekStart(date)
    if (!byWeek.has(w)) byWeek.set(w, [])
    byWeek.get(w)!.push({ date, sessions })
  }
  return [...byWeek.entries()].map(([week, d]) => ({ week, days: d }))
}

// ── Progress ─────────────────────────────────────────────────────

export type ProgressUnit = 'kg' | 'reps' | 's'

export interface ProgressPoint {
  date: string
  /** Top weight, most reps, or longest hold — depending on the exercise's unit */
  value: number
  /** The set that produced the value, e.g. "10 × 25 kg" */
  set: string
}

export interface ExerciseProgress {
  name: string
  unit: ProgressUnit
  points: ProgressPoint[] // oldest first
  first: ProgressPoint
  latest: ProgressPoint
  best: ProgressPoint
  /** latest − first */
  change: number
}

const fmtKg = (kg: number) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1))

function topSet(sets: LoggedSet[], unit: ProgressUnit): { value: number; set: string } | null {
  let best: LoggedSet | null = null
  let value = -Infinity
  for (const s of sets) {
    // Weighted: heaviest set, more reps breaking a tie
    const v =
      unit === 'kg'
        ? (s.kg ?? -Infinity) + (s.reps ?? 0) / 1000
        : unit === 'reps'
          ? (s.reps ?? -Infinity)
          : (s.sec ?? -Infinity)
    if (v > value) {
      value = v
      best = s
    }
  }
  if (!best || value === -Infinity) return null
  if (unit === 'kg') return { value: best.kg!, set: `${best.reps ?? '?'} × ${fmtKg(best.kg!)} kg` }
  if (unit === 'reps') return { value: best.reps!, set: `${best.reps} reps` }
  return { value: best.sec!, set: `${best.sec} s` }
}

/**
 * One entry per exercise logged on or after `since`, most recently done first.
 * The unit is kg when any set had a weight, else reps, else seconds; each
 * workout contributes its top set in that unit.
 */
export function exerciseProgress(days: Record<string, DayData>, since = ''): ExerciseProgress[] {
  const logs = new Map<string, { name: string; date: string; sets: LoggedSet[] }[]>()
  for (const date of Object.keys(days).sort()) {
    if (date < since) continue
    for (const s of dayWorkoutSessions(days[date]))
      for (const ex of s.exercises ?? []) {
        const key = normalizeName(ex.name)
        const done = ex.sets.filter(x => x.done)
        if (!key || !done.length) continue
        if (!logs.has(key)) logs.set(key, [])
        logs.get(key)!.push({ name: ex.name.trim(), date, sets: done })
      }
  }

  const out: ExerciseProgress[] = []
  for (const entries of logs.values()) {
    const all = entries.flatMap(e => e.sets)
    const unit: ProgressUnit = all.some(s => s.kg != null)
      ? 'kg'
      : all.some(s => s.reps != null)
        ? 'reps'
        : 's'
    const points: ProgressPoint[] = []
    for (const e of entries) {
      const top = topSet(e.sets, unit)
      if (top) points.push({ date: e.date, ...top })
    }
    if (!points.length) continue
    const first = points[0]
    const latest = points[points.length - 1]
    const best = points.reduce((a, b) => (b.value >= a.value ? b : a))
    out.push({
      name: entries[entries.length - 1].name,
      unit,
      points,
      first,
      latest,
      best,
      change: Math.round((latest.value - first.value) * 10) / 10,
    })
  }
  return out.sort((a, b) => (a.latest.date < b.latest.date ? 1 : -1))
}
