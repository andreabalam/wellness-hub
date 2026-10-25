/**
 * src/lib/workoutWeeks.ts
 *
 * "Weeks worked out" counter for the Train tab. A week runs Mon–Sun (the same
 * anchor as the weekly goal) and counts when it has at least one workout.
 */
import type { DayData, WorkoutSession } from '../data/tracker'
import { dayWorkoutSessions } from '../data/tracker'

/** Oura auto-detects short walks; below this they don't count as a workout. */
const MIN_OURA_MIN = 10

/** Any logged workout counts except a "Rest Day" entry and brief Oura auto-detections. */
export function countsAsWorkout(s: WorkoutSession): boolean {
  if (s.type === 'rest') return false
  return s.src === 'manual' || s.min >= MIN_OURA_MIN
}

function keyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** YYYY-MM-DD of the Monday starting the week that contains `date` (YYYY-MM-DD or Date). */
export function weekStart(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return keyOf(d)
}

function shiftWeek(monday: string, weeks: number): string {
  const d = new Date(monday + 'T12:00:00')
  d.setDate(d.getDate() + weeks * 7)
  return keyOf(d)
}

export interface WorkoutWeekStats {
  /** Weeks (all time) with at least one workout */
  totalWeeks: number
  /** Consecutive active weeks up to now — the current week only breaks it once it's over */
  currentStreak: number
  longestStreak: number
  /** Workouts so far this week */
  thisWeek: number
  /** Workout count per active week, keyed by Monday */
  byWeek: Record<string, number>
}

export function workoutWeekStats(days: Record<string, DayData>, today: Date): WorkoutWeekStats {
  const byWeek: Record<string, number> = {}
  for (const [date, day] of Object.entries(days)) {
    const n = dayWorkoutSessions(day).filter(countsAsWorkout).length
    if (n) byWeek[weekStart(date)] = (byWeek[weekStart(date)] ?? 0) + n
  }

  const current = weekStart(today)
  let week = byWeek[current] ? current : shiftWeek(current, -1)
  let currentStreak = 0
  while (byWeek[week]) {
    currentStreak++
    week = shiftWeek(week, -1)
  }

  let longestStreak = 0
  let run = 0
  let prev: string | null = null
  for (const w of Object.keys(byWeek).sort()) {
    run = prev && shiftWeek(prev, 1) === w ? run + 1 : 1
    longestStreak = Math.max(longestStreak, run)
    prev = w
  }

  return {
    totalWeeks: Object.keys(byWeek).length,
    currentStreak,
    longestStreak,
    thisWeek: byWeek[current] ?? 0,
    byWeek,
  }
}
