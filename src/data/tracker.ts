export interface QuickFood {
  n: string
  k: number
  p: number
  c: number
  f: number
  fi: number
}

export interface SessionOption {
  id: string
  label: string
  color: string
}

export const KCAL_TARGET = 1380
export const PROT_TARGET = 110
export const CARB_TARGET = 130
export const FAT_TARGET = 52
export const FIBER_TARGET = 25

export const QUICK_FOODS: QuickFood[] = [
  { n: 'Berry Oats', k: 350, p: 18, c: 42, f: 12, fi: 9 },
  { n: 'Matcha Oats', k: 355, p: 20, c: 44, f: 11, fi: 9 },
  { n: 'Egg Scramble', k: 310, p: 26, c: 8, f: 18, fi: 2 },
  { n: 'Yogurt Bowl', k: 320, p: 28, c: 32, f: 8, fi: 4 },
  { n: 'Green Smoothie', k: 390, p: 35, c: 56, f: 9, fi: 8 },
  { n: 'Tropical Smoothie', k: 415, p: 31, c: 58, f: 7, fi: 7 },
  { n: 'Matcha Smoothie', k: 395, p: 29, c: 60, f: 6, fi: 7 },
  { n: 'Jamaica Smoothie', k: 250, p: 11, c: 44, f: 4, fi: 6 },
  { n: 'Chickpea Wraps', k: 345, p: 16, c: 38, f: 14, fi: 9 },
  { n: 'Lentil Soup', k: 330, p: 20, c: 48, f: 8, fi: 12 },
  { n: "Za'atar Bowl", k: 390, p: 38, c: 22, f: 16, fi: 4 },
  { n: 'Quinoa Bowl', k: 400, p: 38, c: 32, f: 12, fi: 6 },
  { n: 'Guajillo Chicken', k: 410, p: 42, c: 12, f: 20, fi: 2 },
  { n: "Za'atar Salmon", k: 440, p: 42, c: 24, f: 20, fi: 5 },
  { n: 'Soy-Ginger Salmon', k: 430, p: 40, c: 18, f: 22, fi: 4 },
  { n: 'Shakshuka', k: 380, p: 24, c: 30, f: 17, fi: 5 },
  { n: 'Shrimp + Rice', k: 390, p: 34, c: 35, f: 12, fi: 3 },
  { n: 'Tuscan Chicken', k: 440, p: 42, c: 28, f: 16, fi: 6 },
]

export const SESSION_OPTS: SessionOption[] = [
  { id: 'pilates', label: 'Pilates', color: 'var(--purple)' },
  { id: 'glute-build', label: 'Glute Build', color: 'var(--green)' },
  { id: 'glute-shred', label: 'Glute Shred', color: 'var(--coral)' },
  { id: 'full-body', label: 'Full Body', color: 'var(--amber)' },
  { id: 'strength-upper', label: 'Strength — Upper', color: 'var(--blue)' },
  { id: 'strength-core', label: 'Strength — Core', color: 'var(--blue)' },
  { id: 'strength-lower', label: 'Strength — Lower', color: 'var(--blue)' },
  { id: 'zone2', label: 'Zone 2 Walk', color: 'var(--teal)' },
  { id: 'rest', label: 'Rest Day', color: 'var(--muted2)' },
  { id: 'dog-walk', label: 'Dog Walk', color: 'var(--green2)' },
]

export const MED_MINS = [5, 10, 13, 15, 20]
export const MED_STYLES = [
  'Breath focus',
  'Box breathing',
  'Long exhale',
  'Body scan',
  'Visualization',
  'Guided',
  'Silent',
]

export const PHASE_NOTES: Record<string, string> = {
  Menstrual: 'Week 1: Low intensity. Pilates + gentle activation. Be kind to yourself.',
  Follicular: 'Week 2: Strongest phase. Push heavier in Solin glute build sessions.',
  Ovulatory: 'Early Week 3: Still strong. Great for PRs.',
  Luteal: 'Late Week 3: Moderate load. Allow ~1,500 kcal on workout days.',
  Unsure: 'Cycle unknown - follow 3-week rotating plan from last period start.',
  '': 'Select your cycle phase above to see recommended workout intensity.',
}

export interface FoodEntry {
  n: string
  k: number
  p: number
  c: number
  f: number
  fi: number
  s?: number // servings logged (stored so edit can reverse-calculate per-serving values)
  r?: number // recipe id when logged from a recipe hit (ids can go stale after first sync — resolve by id, fall back to name match)
  sat?: number // Noom satiety after this meal (1–7, optional; "Ravenous" → "Out of commission")
  hunger?: string // Noom hunger type when logging (see HUNGER_TYPES), optional
}

/** Noom hunger types — "feed what's actually hungry". `id` is stored on the entry. */
export const HUNGER_TYPES = [
  { id: 'stomach', label: 'Stomach', icon: '🍽' },
  { id: 'mouth', label: 'Mouth', icon: '👄' },
  { id: 'emotional', label: 'Emotional', icon: '💭' },
  { id: 'learned', label: 'Learned', icon: '⏰' },
  { id: 'social', label: 'Social', icon: '👥' },
] as const

export type HungerType = (typeof HUNGER_TYPES)[number]['id']

/** The icon for a hunger-type id, or '' if unknown. */
export function hungerIcon(id: string | undefined): string {
  return HUNGER_TYPES.find(h => h.id === id)?.icon ?? ''
}

/** The display label for a hunger-type id, or '' if unknown. */
export function hungerLabel(id: string | undefined): string {
  return HUNGER_TYPES.find(h => h.id === id)?.label ?? ''
}

/** One workout session — structured, multiple per day, Oura-imported or manual. */
export interface WorkoutSession {
  id: string // `oura-${OuraWorkout.id}` | `manual-${timestamp}`
  src: 'oura' | 'manual'
  type: string // SESSION_OPTS id (manual) or mapped id (oura)
  label?: string // raw Oura activity for display, e.g. "weight training"
  min: number
  kcal?: number
  avgHr?: number
  maxHr?: number
  note?: string
}

/** One meditation session — structured, multiple per day, Oura-imported or manual. */
export interface MedSession {
  id: string // `oura-${OuraSession.id}` | `manual-${timestamp}`
  src: 'oura' | 'manual'
  min: number // actual minutes (oura entries are NOT rounded to MED_MINS)
  style: string
  hrv?: number
  hr?: number
  mood?: string // Oura mood tag, e.g. "good", "relieved"
}

export interface DayData {
  foods: FoodEntry[]
  workout: string | null
  wkNotes: string
  energy: number
  mood: number
  sleep: number
  stress: number // 1–5; auto-filled from Oura daily_stress when connected, else manual
  water: number // glasses of water (0–12)
  phase: string
  notes: string
  medMin: number
  medStyle: string
  // Structured session lists. The legacy single-slot fields above stay populated
  // (first session mirrors into them) so old app versions and consumers keep working.
  wkSessions?: WorkoutSession[]
  medSessions?: MedSession[]
  // Weekly check-in (Tier 2 #6) — populated only on a week's Monday anchor day.
  weekGoal?: string
  weekGoalKind?: WeekGoalKind // 'goal' (SMART) or 'experiment' (CMA "if X then Y")
  weekGoalResult?: WeekGoalResult
  weekGoalNote?: string
}

export type WeekGoalKind = 'goal' | 'experiment'
export type WeekGoalResult = 'yes' | 'partial' | 'no'

/** Seed suggestions for a weekly goal (from the Noom doc). */
export const WEEK_GOAL_SUGGESTIONS = [
  '1–2 fermented foods this week',
  'Protein at every meal',
  'One new movement type',
]

export const EMPTY_DAY: DayData = {
  foods: [],
  workout: null,
  wkNotes: '',
  energy: 0,
  mood: 0,
  sleep: 0,
  stress: 0,
  water: 0,
  phase: '',
  notes: '',
  medMin: 0,
  medStyle: '',
}

/** Max glasses the hydration counter allows. */
export const WATER_MAX = 12

// ── Session helpers (legacy synthesis + totals) ──────────────────

/**
 * The day's workout sessions. A day that predates `wkSessions` but has the
 * legacy single-slot `workout` set synthesizes one session so it still renders
 * in the list — no migration pass needed.
 */
export function dayWorkoutSessions(day: DayData): WorkoutSession[] {
  if (day.wkSessions?.length) return day.wkSessions
  if (day.workout) return [{ id: 'legacy-wk', src: 'manual', type: day.workout, min: 0 }]
  return []
}

/** The day's meditation sessions, synthesizing one from legacy medMin/medStyle. */
export function dayMedSessions(day: DayData): MedSession[] {
  if (day.medSessions?.length) return day.medSessions
  if (day.medMin > 0)
    return [{ id: 'legacy-med', src: 'manual', min: day.medMin, style: day.medStyle }]
  return []
}

/** Display label for a workout session: manual types use SESSION_OPTS, oura keeps its raw label. */
export function workoutSessionLabel(s: WorkoutSession): string {
  return SESSION_OPTS.find(o => o.id === s.type)?.label ?? s.label ?? s.type
}

export interface WorkoutTotals {
  sessions: number
  min: number
  kcal: number
}

export function workoutTotals(sessions: WorkoutSession[]): WorkoutTotals {
  return {
    sessions: sessions.length,
    min: sessions.reduce((s, w) => s + w.min, 0),
    kcal: sessions.reduce((s, w) => s + (w.kcal ?? 0), 0),
  }
}

export interface MedTotals {
  sessions: number
  min: number
}

export function medTotals(sessions: MedSession[]): MedTotals {
  return {
    sessions: sessions.length,
    min: sessions.reduce((s, m) => s + m.min, 0),
  }
}

/** "1 h 05 m" / "45 min" style duration for totals lines. */
export function fmtMin(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')} m`
}
