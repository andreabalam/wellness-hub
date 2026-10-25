import { macrosFromKcal } from '../lib/stats'
import type { MacroSplit } from '../lib/stats'
import { bodyStatsStore, userSettingsStore } from './useStore'

export interface MacroTargetSet {
  kcal: number
  prot: number
  carb: number
  fat: number
  fiber: number
}

/**
 * Daily macro targets: body stats (calorie target + macro split) win over the
 * legacy per-user settings. Shared by Today's food card and the Food log.
 */
export function macroTargets(): MacroTargetSet {
  const settings = userSettingsStore.get()
  const stats = bodyStatsStore.get()
  // `|| 0`: a missing target falls back to settings instead of NaN macros
  const macros = macrosFromKcal(
    stats.kcalTarget || 0,
    (stats.macroSplit as MacroSplit) || 'balanced',
  )
  return {
    kcal: stats.kcalTarget || settings.kcalTarget,
    prot: macros?.prot ?? settings.protTarget,
    carb: macros?.carb ?? settings.carbTarget,
    fat: macros?.fat ?? settings.fatTarget,
    fiber: macros?.fiber ?? settings.fiberTarget,
  }
}
