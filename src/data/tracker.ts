export interface QuickFood {
  n: string; k: number; p: number; c: number; f: number; fi: number
}

export interface SessionOption {
  id: string; label: string; color: string
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
  { id: 'zone2', label: 'Zone 2 Walk', color: 'var(--teal)' },
  { id: 'rest', label: 'Rest Day', color: 'var(--muted2)' },
  { id: 'dog-walk', label: 'Dog Walk', color: 'var(--green2)' },
]

export const MED_MINS = [5, 10, 13, 15, 20]
export const MED_STYLES = ['Breath focus', 'Box breathing', 'Long exhale', 'Body scan', 'Visualization', 'Guided', 'Silent']

export const PHASE_NOTES: Record<string, string> = {
  Menstrual: 'Week 1: Low intensity. Pilates + gentle activation. Be kind to yourself.',
  Follicular: 'Week 2: Strongest phase. Push heavier in Solin glute build sessions.',
  Ovulatory: 'Early Week 3: Still strong. Great for PRs.',
  Luteal: 'Late Week 3: Moderate load. Allow ~1,500 kcal on workout days.',
  Unsure: 'Cycle unknown - follow 3-week rotating plan from last period start.',
  '': 'Select your cycle phase above to see recommended workout intensity.',
}

export interface FoodEntry {
  n: string; k: number; p: number; c: number; f: number; fi: number
  s?: number  // servings logged (stored so edit can reverse-calculate per-serving values)
  r?: number  // recipe id when logged from a recipe hit (ids can go stale after first sync — resolve by id, fall back to name match)
  sat?: number  // Noom satiety after this meal (1–7, optional; "Ravenous" → "Out of commission")
}

export interface DayData {
  foods: FoodEntry[]
  workout: string | null
  wkNotes: string
  energy: number
  mood: number
  sleep: number
  stress: number  // 1–5; auto-filled from Oura daily_stress when connected, else manual
  water: number   // glasses of water (0–12)
  phase: string
  notes: string
  medMin: number
  medStyle: string
}

export const EMPTY_DAY: DayData = {
  foods: [], workout: null, wkNotes: '', energy: 0, mood: 0,
  sleep: 0, stress: 0, water: 0, phase: '', notes: '', medMin: 0, medStyle: '',
}

/** Max glasses the hydration counter allows. */
export const WATER_MAX = 12
