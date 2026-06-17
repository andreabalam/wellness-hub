/**
 * Pure computation helpers shared across TrackerTab, WorkoutsTab, and ProfileStatsCard.
 * No side effects, no imports from other project files.
 */

export type MacroSplit = 'balanced' | 'high_protein' | 'low_carb' | 'custom'

export interface MacroTargets {
  kcal: number
  prot: number
  carb: number
  fat: number
  fiber: number
}

/** Daily calorie deficit from a weekly fat-loss rate (7,700 kcal ≈ 1 kg of fat). */
export function deficitFromRate(kgPerWeek: number): number {
  return Math.round((kgPerWeek * 7_700) / 7)
}

/** Calorie target = TDEE − daily deficit, floored at 1,200 kcal. */
export function kcalFromTdee(tdeeKcal: number, fatLossKgPerWeek: number): number {
  if (tdeeKcal <= 0) return 0
  return Math.max(1_200, tdeeKcal - deficitFromRate(fatLossKgPerWeek))
}

/** Macro gram targets from a calorie total + split. Returns null for custom / zero kcal. */
export function macrosFromKcal(kcal: number, split: MacroSplit): MacroTargets | null {
  if (split === 'custom' || kcal <= 0) return null
  if (split === 'balanced')
    return {
      kcal,
      prot: Math.round((kcal * 0.3) / 4),
      carb: Math.round((kcal * 0.4) / 4),
      fat: Math.round((kcal * 0.3) / 9),
      fiber: 25,
    }
  if (split === 'high_protein')
    return {
      kcal,
      prot: Math.round((kcal * 0.35) / 4),
      carb: Math.round((kcal * 0.35) / 4),
      fat: Math.round((kcal * 0.3) / 9),
      fiber: 25,
    }
  if (split === 'low_carb')
    return {
      kcal,
      prot: Math.round((kcal * 0.35) / 4),
      carb: Math.round((kcal * 0.2) / 4),
      fat: Math.round((kcal * 0.45) / 9),
      fiber: 25,
    }
  return null
}

/** Human-readable protein range string for WorkoutsTab stats strip. */
export function protRangeStr(prot: number): string {
  if (!prot) return ''
  return `${prot}–${Math.round(prot * 1.1)}g/day`
}

/** Human-readable fat-loss goal string for WorkoutsTab stats strip. */
export function fatLossGoalStr(kgPerWeek: number): string {
  if (kgPerWeek === 0) return 'Maintenance'
  return `−${kgPerWeek} kg/wk · −${deficitFromRate(kgPerWeek)} kcal/day`
}

/** Normalise legacy chronotype values ('early'→'lion', 'intermediate'→'bear', 'late'→'wolf'). */
export function normaliseChronotype(v: string): string {
  if (v === 'early') return 'lion'
  if (v === 'intermediate') return 'bear'
  if (v === 'late') return 'wolf'
  return v
}
