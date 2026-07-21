import { describe, it, expect } from 'vitest'
import {
  deficitFromRate,
  kcalFromTdee,
  macrosFromKcal,
  protRangeStr,
  fatLossGoalStr,
  normaliseChronotype,
  significantBurnKcal,
} from '../lib/stats'

describe('significantBurnKcal', () => {
  it('falls back to a flat 300 without a TDEE', () => {
    expect(significantBurnKcal(0)).toBe(300)
    expect(significantBurnKcal(-100)).toBe(300)
  })

  it('scales to 15% of TDEE', () => {
    expect(significantBurnKcal(2000)).toBe(300)
    expect(significantBurnKcal(2600)).toBe(390)
  })

  it('clamps to a 250 kcal floor for low TDEEs', () => {
    expect(significantBurnKcal(1400)).toBe(250)
  })
})

describe('deficitFromRate', () => {
  it('returns 0 for 0 kg/week', () => {
    expect(deficitFromRate(0)).toBe(0)
  })

  it('computes correct deficit for 0.5 kg/week', () => {
    // 0.5 * 7700 / 7 = 550
    expect(deficitFromRate(0.5)).toBe(550)
  })

  it('computes correct deficit for 1 kg/week', () => {
    // 1 * 7700 / 7 = 1100
    expect(deficitFromRate(1)).toBe(1100)
  })
})

describe('kcalFromTdee', () => {
  it('returns 0 when TDEE is 0', () => {
    expect(kcalFromTdee(0, 0.5)).toBe(0)
  })

  it('returns 0 when TDEE is negative', () => {
    expect(kcalFromTdee(-100, 0)).toBe(0)
  })

  it('subtracts deficit from TDEE', () => {
    // TDEE 2000, 0 kg/week → 2000
    expect(kcalFromTdee(2000, 0)).toBe(2000)
  })

  it('floors at 1200 kcal for aggressive deficit', () => {
    // TDEE 1400, 1 kg/week → 1400 - 1100 = 300 → clamped to 1200
    expect(kcalFromTdee(1400, 1)).toBe(1200)
  })

  it('computes kcal for moderate deficit', () => {
    // TDEE 2000, 0.5 kg/week → 2000 - 550 = 1450
    expect(kcalFromTdee(2000, 0.5)).toBe(1450)
  })
})

describe('macrosFromKcal', () => {
  it('returns null for custom split', () => {
    expect(macrosFromKcal(2000, 'custom')).toBeNull()
  })

  it('returns null for 0 kcal', () => {
    expect(macrosFromKcal(0, 'balanced')).toBeNull()
  })

  it('balanced split: correct gram splits', () => {
    const m = macrosFromKcal(2000, 'balanced')!
    expect(m.kcal).toBe(2000)
    expect(m.prot).toBe(Math.round((2000 * 0.3) / 4)) // 150
    expect(m.carb).toBe(Math.round((2000 * 0.4) / 4)) // 200
    expect(m.fat).toBe(Math.round((2000 * 0.3) / 9)) // 67
    expect(m.fiber).toBe(25)
  })

  it('high_protein split: correct gram splits', () => {
    const m = macrosFromKcal(2000, 'high_protein')!
    expect(m.prot).toBe(Math.round((2000 * 0.35) / 4)) // 175
    expect(m.carb).toBe(Math.round((2000 * 0.35) / 4)) // 175
    expect(m.fat).toBe(Math.round((2000 * 0.3) / 9)) // 67
    expect(m.fiber).toBe(25)
  })

  it('low_carb split: correct gram splits', () => {
    const m = macrosFromKcal(2000, 'low_carb')!
    expect(m.prot).toBe(Math.round((2000 * 0.35) / 4)) // 175
    expect(m.carb).toBe(Math.round((2000 * 0.2) / 4)) // 100
    expect(m.fat).toBe(Math.round((2000 * 0.45) / 9)) // 100
    expect(m.fiber).toBe(25)
  })
})

describe('protRangeStr', () => {
  it('returns empty string for 0 protein', () => {
    expect(protRangeStr(0)).toBe('')
  })

  it('returns range string for non-zero protein', () => {
    expect(protRangeStr(150)).toBe('150–165g/day')
  })

  it('rounds the upper bound', () => {
    expect(protRangeStr(100)).toBe('100–110g/day')
  })
})

describe('fatLossGoalStr', () => {
  it('returns Maintenance for 0 kg/week', () => {
    expect(fatLossGoalStr(0)).toBe('Maintenance')
  })

  it('returns formatted string for non-zero rate', () => {
    const result = fatLossGoalStr(0.5)
    expect(result).toBe('−0.5 kg/wk · −550 kcal/day')
  })

  it('formats 1 kg/week correctly', () => {
    expect(fatLossGoalStr(1)).toBe('−1 kg/wk · −1100 kcal/day')
  })
})

describe('normaliseChronotype', () => {
  it('maps legacy early → lion', () => {
    expect(normaliseChronotype('early')).toBe('lion')
  })

  it('maps legacy intermediate → bear', () => {
    expect(normaliseChronotype('intermediate')).toBe('bear')
  })

  it('maps legacy late → wolf', () => {
    expect(normaliseChronotype('late')).toBe('wolf')
  })

  it('passes through current values unchanged', () => {
    expect(normaliseChronotype('lion')).toBe('lion')
    expect(normaliseChronotype('bear')).toBe('bear')
    expect(normaliseChronotype('wolf')).toBe('wolf')
    expect(normaliseChronotype('dolphin')).toBe('dolphin')
    expect(normaliseChronotype('')).toBe('')
  })
})
