/**
 * src/lib/workoutLog.ts
 *
 * Pure helpers for logging sets in the Workouts tab: prefill from the plan's
 * dose text and from the last time an exercise was done, format sets for
 * display, and fold a logged workout into the day's sessions without
 * double-counting a matching Oura workout.
 */
import type { Exercise, WorkoutDay } from '../data/workouts'
import type { DayData, LoggedExercise, LoggedSet, WorkoutSession } from '../data/tracker'
import { dayWorkoutSessions } from '../data/tracker'

// ── Plan dose parsing ────────────────────────────────────────────

/** Sets plus a starting rep count or hold time, read from plan text like "3×8-10". */
export interface PlanDose {
  sets: number
  reps?: number
  sec?: number
}

const toSec = (n: number, unit: string) => (/^m/i.test(unit) ? n * 60 : n)

/**
 * "4×8-10" → 4 sets of 8 (ranges start at the bottom), "3×30-45 sec" → 3 × 30 s,
 * "45s per side" / "1 min" → 1 timed set, "3 rounds, 30s on" → 3 × 30 s,
 * "8 reps" / "10 per side" → 1 set of reps, "2×max" / "4×AMRAP" → sets, reps blank.
 */
export function parsePlanDose(d: string): PlanDose {
  const text = d.toLowerCase()
  const sxr = text.match(/(\d+)\s*[×x]\s*(\d+)(?:\s*[-–]\s*\d+)?\s*(sec|s\b|min)?/)
  if (sxr) {
    const sets = Number(sxr[1])
    const n = Number(sxr[2])
    return sxr[3] ? { sets, sec: toSec(n, sxr[3]) } : { sets, reps: n }
  }
  const setsOnly = text.match(/(\d+)\s*[×x]\s*(?:max|amrap)/)
  if (setsOnly) return { sets: Number(setsOnly[1]) }
  // "5 reps, 3s hold" — explicit reps beat a hold time mentioned later
  const repsWord = text.match(/^(\d+)\s*reps?\b/)
  if (repsWord) return { sets: 1, reps: Number(repsWord[1]) }
  const rounds = text.match(/(\d+)\s*rounds?/)
  const timed = text.match(/(\d+)(?:\s*[-–]\s*\d+)?\s*(sec|s\b|min)/)
  if (timed) return { sets: rounds ? Number(rounds[1]) : 1, sec: toSec(Number(timed[1]), timed[2]) }
  const reps = text.match(/^(\d+)/)
  if (reps) return { sets: 1, reps: Number(reps[1]) }
  return { sets: 1 }
}

// ── History ──────────────────────────────────────────────────────

export function normalizeName(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim()
}

/** Most recent completed sets for an exercise, logged before `beforeDate`. */
export function lastPerformance(
  name: string,
  days: Record<string, DayData>,
  beforeDate: string,
): { date: string; sets: LoggedSet[] } | null {
  const key = normalizeName(name)
  if (!key) return null
  const dates = Object.keys(days)
    .filter(d => d < beforeDate)
    .sort()
    .reverse()
  for (const date of dates) {
    for (const s of dayWorkoutSessions(days[date])) {
      const ex = s.exercises?.find(e => normalizeName(e.name) === key)
      const done = ex?.sets.filter(set => set.done) ?? []
      if (done.length) return { date, sets: done }
    }
  }
  return null
}

/**
 * Starting sets for one plan exercise: the plan's set count, filled with last
 * time's numbers when there are any (so the user just repeats or bumps them),
 * else the plan's reps / hold time.
 */
export function prefillSets(ex: Exercise, last: LoggedSet[] | null): LoggedSet[] {
  const dose = parsePlanDose(ex.d)
  const count = Math.max(dose.sets, last?.length ?? 0)
  return Array.from({ length: count }, (_, i) => {
    const prev = last?.[Math.min(i, last.length - 1)]
    if (prev) return { reps: prev.reps, kg: prev.kg, sec: prev.sec, done: false }
    return dose.sec != null ? { sec: dose.sec, done: false } : { reps: dose.reps, done: false }
  })
}

// ── Draft (the workout in progress) ──────────────────────────────

export interface WorkoutDraft {
  date: string // YYYY-MM-DD the workout is logged on
  startedAt: number
  title: string
  type: string // SESSION_OPTS id
  planRef?: { week: number; slot: string }
  exercises: LoggedExercise[]
}

/** SESSION_OPTS id for a plan day — keeps week-strip colours and totals meaningful. */
function sessionTypeFor(day: WorkoutDay): string {
  if (day.type === 'Pilates') return 'pilates'
  if (day.type === 'Recovery') return 'zone2'
  return 'full-body'
}

export function newDraft(
  day: WorkoutDay,
  week: number,
  date: string,
  history: Record<string, DayData>,
  now = Date.now(),
): WorkoutDraft {
  return {
    date,
    startedAt: now,
    title: `${day.slot} · ${day.label}`,
    type: sessionTypeFor(day),
    planRef: { week, slot: day.slot },
    exercises: day.exs.map(ex => ({
      name: ex.t,
      sets: prefillSets(ex, lastPerformance(ex.t, history, date)?.sets ?? null),
    })),
  }
}

/** Elapsed minutes for the session, capped so a draft left open overnight stays sane. */
export function draftMinutes(draft: WorkoutDraft, now = Date.now()): number {
  return Math.min(180, Math.max(1, Math.round((now - draft.startedAt) / 60000)))
}

/** Completed sets only, empty exercises dropped. */
export function completedExercises(draft: WorkoutDraft): LoggedExercise[] {
  return draft.exercises
    .map(e => ({ name: e.name.trim(), sets: e.sets.filter(s => s.done) }))
    .filter(e => e.name && e.sets.length)
}

// ── Display ──────────────────────────────────────────────────────

const fmtKg = (kg: number) => `${Number.isInteger(kg) ? kg : kg.toFixed(1)}`

/** "10 × 20 kg" / "10 reps" / "45 s" / "45 s × 5 kg" */
export function fmtSet(s: LoggedSet): string {
  const base = s.sec != null ? `${s.sec} s` : `${s.reps ?? '?'}${s.kg != null ? '' : ' reps'}`
  return s.kg != null ? `${base} × ${fmtKg(s.kg)} kg` : base
}

/** "3×10 @ 20 kg" when every set matches, else "10×20, 8×22.5 kg". */
export function fmtSets(sets: LoggedSet[]): string {
  if (!sets.length) return ''
  const same = sets.every(
    s => s.reps === sets[0].reps && s.kg === sets[0].kg && s.sec === sets[0].sec,
  )
  if (same) {
    const s = sets[0]
    const what = s.sec != null ? `${s.sec} s` : `${s.reps ?? '?'}`
    return `${sets.length}×${what}${s.kg != null ? ` @ ${fmtKg(s.kg)} kg` : ''}`
  }
  const anyKg = sets.some(s => s.kg != null)
  const parts = sets.map(s => {
    const what = s.sec != null ? `${s.sec}s` : `${s.reps ?? '?'}`
    return s.kg != null ? `${what}×${fmtKg(s.kg)}` : what
  })
  return parts.join(', ') + (anyKg ? ' kg' : '')
}

export interface LoggedSummary {
  exercises: number
  sets: number
  /** Σ reps × kg over weighted sets */
  volumeKg: number
}

export function loggedSummary(exercises: LoggedExercise[]): LoggedSummary {
  let sets = 0
  let volumeKg = 0
  for (const e of exercises)
    for (const s of e.sets) {
      sets++
      if (s.kg != null && s.reps != null) volumeKg += s.kg * s.reps
    }
  return { exercises: exercises.length, sets, volumeKg: Math.round(volumeKg) }
}

// ── Merging with Oura workouts ───────────────────────────────────

/** Oura activities that are the same workout as a logged plan session. */
const STRENGTH_ACTIVITY = /weight|strength|functional|hiit|cross|core|pilates/i

function isOuraStrength(s: WorkoutSession): boolean {
  return s.src === 'oura' && !s.exercises?.length && STRENGTH_ACTIVITY.test(s.label ?? s.type)
}

/**
 * Add a logged workout to the day. When Oura already recorded a matching
 * strength workout, the sets attach to it instead (keeps Oura's HR and kcal,
 * avoids counting the workout twice); otherwise it's a new manual session.
 */
export function attachLoggedWorkout(
  sessions: WorkoutSession[],
  logged: WorkoutSession,
): WorkoutSession[] {
  const i = sessions.findIndex(isOuraStrength)
  if (i === -1) return [...sessions, logged]
  return sessions.map((s, j) =>
    j === i ? { ...s, exercises: logged.exercises, planRef: logged.planRef } : s,
  )
}

/**
 * After an Oura re-import (which replaces the day's Oura sessions wholesale):
 * carry logged sets over to the re-imported copies of the same Oura sessions,
 * then move a logged manual workout onto a newly arrived matching Oura one.
 */
export function keepLoggedSets(
  before: WorkoutSession[],
  merged: WorkoutSession[],
): WorkoutSession[] {
  let out = merged.map(s => {
    const prev = before.find(b => b.id === s.id && b.exercises?.length)
    return prev && !s.exercises ? { ...s, exercises: prev.exercises, planRef: prev.planRef } : s
  })
  for (const manual of out.filter(s => s.src === 'manual' && s.exercises?.length)) {
    const target = out.findIndex(isOuraStrength)
    if (target === -1) break
    out = out
      .map((s, j) =>
        j === target ? { ...s, exercises: manual.exercises, planRef: manual.planRef } : s,
      )
      .filter(s => s !== manual)
  }
  return out
}
