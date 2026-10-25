/**
 * Lightweight runtime type guards for data that crosses a trust boundary —
 * values read back from `localStorage` and rows returned by Supabase. Both can
 * be stale, hand-edited, or schema-drifted; without a guard a bad shape is cast
 * with `as` and blows up deep in the UI. These guards are intentionally
 * pragmatic (shape + field types, not exhaustive) and dependency-free.
 */
import type {
  DayData,
  FoodEntry,
  LoggedExercise,
  LoggedSet,
  MedSession,
  QuickFood,
  WorkoutSession,
} from '../data/tracker'
import type { Recipe } from '../data/recipes'
import type { WorkoutDraft } from './workoutLog'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const isNum = (v: unknown): v is number => typeof v === 'number' && !Number.isNaN(v)
const isStr = (v: unknown): v is string => typeof v === 'string'
/** A field that is either absent/undefined or matches the guard. */
const opt = (v: unknown, guard: (x: unknown) => boolean): boolean => v === undefined || guard(v)

/** Narrow an unknown to T[] when every element passes `guard`. */
export function isArrayOf<T>(v: unknown, guard: (x: unknown) => x is T): v is T[] {
  return Array.isArray(v) && v.every(guard)
}

export function isQuickFood(v: unknown): v is QuickFood {
  return (
    isObject(v) && isStr(v.n) && isNum(v.k) && isNum(v.p) && isNum(v.c) && isNum(v.f) && isNum(v.fi)
  )
}

export function isFoodEntry(v: unknown): v is FoodEntry {
  return (
    isObject(v) &&
    isStr(v.n) &&
    isNum(v.k) &&
    isNum(v.p) &&
    isNum(v.c) &&
    isNum(v.f) &&
    isNum(v.fi) &&
    opt(v.s, isNum) &&
    opt(v.r, isNum) &&
    opt(v.sat, isNum) &&
    opt(v.hunger, isStr)
  )
}

export function isLoggedSet(v: unknown): v is LoggedSet {
  return (
    isObject(v) &&
    typeof v.done === 'boolean' &&
    opt(v.reps, isNum) &&
    opt(v.kg, isNum) &&
    opt(v.sec, isNum)
  )
}

export function isLoggedExercise(v: unknown): v is LoggedExercise {
  return isObject(v) && isStr(v.name) && isArrayOf(v.sets, isLoggedSet)
}

export function isWorkoutSession(v: unknown): v is WorkoutSession {
  return (
    isObject(v) &&
    isStr(v.id) &&
    (v.src === 'oura' || v.src === 'manual') &&
    isStr(v.type) &&
    isNum(v.min) &&
    opt(v.label, isStr) &&
    opt(v.kcal, isNum) &&
    opt(v.avgHr, isNum) &&
    opt(v.maxHr, isNum) &&
    opt(v.note, isStr) &&
    opt(v.exercises, x => isArrayOf(x, isLoggedExercise)) &&
    opt(v.planRef, x => isObject(x) && isNum(x.week) && isStr(x.slot))
  )
}

export function isMedSession(v: unknown): v is MedSession {
  return (
    isObject(v) &&
    isStr(v.id) &&
    (v.src === 'oura' || v.src === 'manual') &&
    isNum(v.min) &&
    isStr(v.style) &&
    opt(v.hrv, isNum) &&
    opt(v.hr, isNum) &&
    opt(v.mood, isStr)
  )
}

export function isDayData(v: unknown): v is DayData {
  return (
    isObject(v) &&
    isArrayOf(v.foods, isFoodEntry) &&
    (v.workout === null || isStr(v.workout)) &&
    isStr(v.wkNotes) &&
    isNum(v.energy) &&
    isNum(v.mood) &&
    isNum(v.sleep) &&
    isNum(v.stress) &&
    isNum(v.water) &&
    isStr(v.phase) &&
    isStr(v.notes) &&
    isNum(v.medMin) &&
    isStr(v.medStyle) &&
    opt(v.wkSessions, x => isArrayOf(x, isWorkoutSession)) &&
    opt(v.medSessions, x => isArrayOf(x, isMedSession))
  )
}

/** The in-progress workout saved in localStorage by the Workouts tab logger. */
export function isWorkoutDraft(v: unknown): v is WorkoutDraft {
  return (
    isObject(v) &&
    isStr(v.date) &&
    isNum(v.startedAt) &&
    isStr(v.title) &&
    isStr(v.type) &&
    isArrayOf(v.exercises, isLoggedExercise)
  )
}

/** Record<YYYY-MM-DD, DayData> — every value must be a valid DayData. */
export function isDayDataMap(v: unknown): v is Record<string, DayData> {
  return isObject(v) && Object.values(v).every(isDayData)
}

export function isRecipe(v: unknown): v is Recipe {
  return (
    isObject(v) &&
    opt(v.id, isNum) &&
    isStr(v.cat) &&
    isStr(v.type) &&
    isStr(v.color) &&
    isStr(v.sc) &&
    isStr(v.name) &&
    isStr(v.tag) &&
    isStr(v.prepL) &&
    isStr(v.prepC) &&
    isNum(v.hk) &&
    isStr(v.hp) &&
    isStr(v.hc) &&
    isStr(v.hf) &&
    isNum(v.mk) &&
    isStr(v.mp) &&
    isStr(v.mc) &&
    isStr(v.mf) &&
    Array.isArray(v.ings) &&
    isArrayOf(v.steps, isStr) &&
    isStr(v.tip)
  )
}
