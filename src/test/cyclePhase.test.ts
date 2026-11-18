import { describe, it, expect } from 'vitest'
import {
  anchorsFromTags,
  anchorsFromTracker,
  cycleLength,
  phaseForCycleDay,
  estimatePhase,
  detectTempShift,
} from '../lib/cyclePhase'
import type { TempReading } from '../lib/cyclePhase'
import { addDaysToKey, dkey } from '../lib/dateKey'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData } from '../data/tracker'

const day = (phase: string): DayData => ({ ...EMPTY_DAY, phase })

/** Consecutive nightly readings ending on `end` (inclusive), oldest first. */
function series(end: string, devs: number[]): TempReading[] {
  const endMs = new Date(end + 'T12:00:00').getTime()
  return devs.map((dev, i) => {
    const d = new Date(endMs - (devs.length - 1 - i) * 86_400_000)
    const date = dkey(d)
    return { date, dev }
  })
}

describe('anchorsFromTags', () => {
  it('collapses consecutive tagged days to one anchor (period start)', () => {
    expect(
      anchorsFromTags(['2026-06-03', '2026-06-01', '2026-06-02', '2026-06-29']).map(a => a.date),
    ).toEqual(['2026-06-01', '2026-06-29'])
  })

  it('deduplicates and handles empty input', () => {
    expect(anchorsFromTags([])).toEqual([])
    expect(anchorsFromTags(['2026-06-01', '2026-06-01']).length).toBe(1)
  })
})

describe('anchorsFromTracker', () => {
  it('finds streak starts of manual Menstrual days', () => {
    const days: Record<string, DayData> = {
      '2026-06-01': day('Menstrual'),
      '2026-06-02': day('Menstrual'),
      '2026-06-03': day('Follicular'),
      '2026-06-29': day('Menstrual'),
    }
    expect(anchorsFromTracker(days).map(a => a.date)).toEqual(['2026-06-01', '2026-06-29'])
  })

  it('ignores days with other phases', () => {
    expect(anchorsFromTracker({ '2026-06-01': day('Luteal') })).toEqual([])
  })
})

describe('cycleLength', () => {
  const a = (date: string) => ({ date, source: 'manual' as const })

  it('defaults to 28 with fewer than two anchors', () => {
    expect(cycleLength([])).toBe(28)
    expect(cycleLength([a('2026-06-01')])).toBe(28)
  })

  it('averages observed gaps', () => {
    expect(cycleLength([a('2026-05-01'), a('2026-05-31'), a('2026-06-28')])).toBe(29)
  })

  it('ignores implausible gaps (<21 or >40 days)', () => {
    // 5-day gap (re-tagged mid-period) and 90-day gap (missed cycles) are noise
    expect(cycleLength([a('2026-01-01'), a('2026-01-06'), a('2026-04-06')])).toBe(28)
  })
})

describe('phaseForCycleDay', () => {
  it('maps the standard ranges', () => {
    expect(phaseForCycleDay(1)).toBe('Menstrual')
    expect(phaseForCycleDay(5)).toBe('Menstrual')
    expect(phaseForCycleDay(6)).toBe('Follicular')
    expect(phaseForCycleDay(13)).toBe('Follicular')
    expect(phaseForCycleDay(14)).toBe('Ovulatory')
    expect(phaseForCycleDay(16)).toBe('Ovulatory')
    expect(phaseForCycleDay(17)).toBe('Luteal')
    expect(phaseForCycleDay(28)).toBe('Luteal')
  })
})

describe('estimatePhase', () => {
  it('returns null with no anchors', () => {
    expect(estimatePhase('2026-07-01', [], {})).toBeNull()
  })

  it('estimates from an oura tag anchor', () => {
    // anchor 2026-06-20 → 2026-07-01 is cycle day 12 → Follicular
    const s = estimatePhase('2026-07-01', ['2026-06-20'], {})
    expect(s).toEqual({
      phase: 'Follicular',
      source: 'oura-tag',
      cycleDay: 12,
      anchorDate: '2026-06-20',
    })
  })

  it('falls back to manual tracker anchors', () => {
    const days: Record<string, DayData> = { '2026-06-20': day('Menstrual') }
    const s = estimatePhase('2026-07-01', [], days)
    expect(s?.source).toBe('manual')
    expect(s?.phase).toBe('Follicular')
  })

  it('uses the most recent anchor', () => {
    const days: Record<string, DayData> = { '2026-05-01': day('Menstrual') }
    const s = estimatePhase('2026-07-01', ['2026-06-29'], days)
    expect(s?.source).toBe('oura-tag')
    expect(s?.cycleDay).toBe(3)
    expect(s?.phase).toBe('Menstrual')
  })

  it('wraps past a full cycle with the modulo', () => {
    // anchor 2026-05-01, default 28-day length → 2026-06-01 is day 32 → day 4
    const s = estimatePhase('2026-06-01', ['2026-05-01'], {})
    expect(s?.cycleDay).toBe(4)
    expect(s?.phase).toBe('Menstrual')
  })

  it('sustained temperature elevation pulls late-follicular to Luteal', () => {
    // day 12 → Follicular normally
    const noTemp = estimatePhase('2026-07-01', ['2026-06-20'], {})
    expect(noTemp?.phase).toBe('Follicular')
    const elevated = estimatePhase(
      '2026-07-01',
      ['2026-06-20'],
      {},
      series('2026-07-01', [0.25, 0.3, 0.1, 0.28, 0.31]),
    )
    expect(elevated?.phase).toBe('Luteal')
  })

  it('temperature never overrides a fresh period anchor', () => {
    const s = estimatePhase(
      '2026-07-01',
      ['2026-06-29'],
      {},
      series('2026-07-01', [0.3, 0.3, 0.3, 0.3, 0.3]),
    )
    expect(s?.phase).toBe('Menstrual')
  })

  it('a short elevation (fewer than 3 of 5 readings) does not nudge', () => {
    const s = estimatePhase(
      '2026-07-01',
      ['2026-06-20'],
      {},
      series('2026-07-01', [0.25, 0.1, 0.0, 0.05, 0.3]),
    )
    expect(s?.phase).toBe('Follicular')
  })

  it('an oura tag anchor wins over a manual anchor on the same date', () => {
    const days: Record<string, DayData> = { '2026-06-20': day('Menstrual') }
    const s = estimatePhase('2026-07-01', ['2026-06-20'], days)
    expect(s?.source).toBe('oura-tag')
  })
})

describe('detectTempShift', () => {
  it('finds the first of three readings above the previous six', () => {
    const r = series('2026-07-10', [-0.1, 0, -0.05, 0.05, 0, -0.1, 0.1, 0.12, 0.2, 0.25])
    expect(detectTempShift(r)).toBe('2026-07-07')
  })

  it('needs the third high reading to clear the baseline by 0.1 °C', () => {
    const r = series('2026-07-09', [0, 0, 0, 0, 0, 0.05, 0.06, 0.07, 0.08])
    expect(detectTempShift(r)).toBeNull()
  })

  it('ignores an isolated spike and needs six baseline readings', () => {
    expect(detectTempShift(series('2026-07-09', [0, 0, 0, 0, 0, 0, 0.4, 0, 0]))).toBeNull()
    expect(detectTempShift(series('2026-07-05', [0, 0, 0.3, 0.3, 0.3]))).toBeNull()
  })

  it('accepts unsorted input and skips missing nights', () => {
    const r = series('2026-07-12', [...Array(8).fill(0), 0.2, 0.2, 0.2, 0.2])
    const gappy = [...r.slice(0, 4), ...r.slice(5)].reverse() // no reading on 07-05
    expect(detectTempShift(gappy)).toBe('2026-07-09')
  })
})

describe('estimatePhase with a temperature shift', () => {
  // Cycle starts 2026-06-01; flat temps for 12 nights, then a rise from cycle day 13.
  const temps = series('2026-06-18', [...Array(12).fill(0), 0.25, 0.3, 0.3, 0.35, 0.3, 0.3])

  it('marks Luteal from the shift even before calendar day 17', () => {
    const s = estimatePhase('2026-06-15', ['2026-06-01'], {}, temps)
    expect(s?.cycleDay).toBe(15)
    expect(s?.phase).toBe('Luteal')
    expect(s?.tempShift).toBe('2026-06-13')
  })

  it('ignores readings after the date being estimated', () => {
    const s = estimatePhase('2026-06-14', ['2026-06-01'], {}, temps)
    expect(s?.phase).toBe('Ovulatory')
    expect(s?.tempShift).toBeUndefined()
  })

  it('ignores a shift before cycle day 10', () => {
    const early = series('2026-06-09', [0, 0, 0, 0, 0, 0, 0.3, 0.3, 0.3])
    const s = estimatePhase('2026-06-09', ['2026-06-01'], {}, early)
    expect(s?.tempShift).toBeUndefined()
    expect(s?.phase).toBe('Follicular')
  })

  it('anchorDate is the current cycle start after the modulo wraps', () => {
    const s = estimatePhase('2026-06-01', ['2026-05-01'], {})
    expect(s?.anchorDate).toBe('2026-05-29')
    expect(s?.anchorEstimated).toBe(true)
    expect(estimatePhase('2026-05-10', ['2026-05-01'], {})?.anchorEstimated).toBeUndefined()
  })
})

describe('daily progression from one logged period', () => {
  it('advances through every phase day by day with no further input', () => {
    const days = { '2026-11-01': day('Menstrual') }
    for (let i = 0; i < 60; i++) {
      const date = addDaysToKey('2026-11-01', i)
      const s = estimatePhase(date, [], days)!
      const expected = (i % 28) + 1
      expect(s.cycleDay, date).toBe(expected)
      expect(s.phase, date).toBe(phaseForCycleDay(expected))
    }
  })

  it('a second "period started" mark a few days in does not restart the cycle', () => {
    const days = { '2026-11-01': day('Menstrual'), '2026-11-03': day('Menstrual') }
    expect(anchorsFromTracker(days)).toEqual([{ date: '2026-11-01', source: 'manual' }])
    expect(estimatePhase('2026-11-06', [], days)).toMatchObject({
      phase: 'Follicular',
      cycleDay: 6,
      anchorDate: '2026-11-01',
    })
  })

  it('a mark more than 10 days after the period start is a new cycle', () => {
    const days = { '2026-11-01': day('Menstrual'), '2026-11-27': day('Menstrual') }
    expect(anchorsFromTracker(days).map(a => a.date)).toEqual(['2026-11-01', '2026-11-27'])
    expect(estimatePhase('2026-11-28', [], days)).toMatchObject({ cycleDay: 2 })
  })

  it('Oura period tags a few days apart collapse into one period', () => {
    expect(anchorsFromTags(['2026-11-01', '2026-11-02', '2026-11-04'])).toEqual([
      { date: '2026-11-01', source: 'oura-tag' },
    ])
  })
})

describe('by-hand phase corrections carry forward', () => {
  const period = { '2026-11-01': day('Menstrual') }

  it('a correction that disagrees re-anchors the following days', () => {
    // Estimate says day 10 = Follicular; user says Luteal → day 10 becomes day 17
    const days = { ...period, '2026-11-10': day('Luteal') }
    expect(estimatePhase('2026-11-11', [], days)).toMatchObject({
      phase: 'Luteal',
      cycleDay: 18,
      anchorEstimated: true,
    })
    expect(estimatePhase('2026-11-13', [], days)).toMatchObject({ phase: 'Luteal', cycleDay: 20 })
    // …and the next period is expected 28 days from the shifted start (Oct 25)
    expect(estimatePhase('2026-11-22', [], days)).toMatchObject({
      phase: 'Menstrual',
      cycleDay: 1,
    })
  })

  it('a correction that agrees with the estimate changes nothing', () => {
    const days = { ...period, '2026-11-08': day('Follicular') }
    expect(estimatePhase('2026-11-09', [], days)).toMatchObject({
      cycleDay: 9,
      anchorDate: '2026-11-01',
    })
    expect(estimatePhase('2026-11-09', [], days)?.anchorEstimated).toBeUndefined()
  })

  it('a newer logged period overrides an older correction', () => {
    const days = { ...period, '2026-11-10': day('Luteal'), '2026-11-25': day('Menstrual') }
    expect(estimatePhase('2026-11-27', [], days)).toMatchObject({
      phase: 'Menstrual',
      cycleDay: 3,
      anchorDate: '2026-11-25',
    })
  })

  it('a correction only affects days on or after it', () => {
    const days = { ...period, '2026-11-10': day('Luteal') }
    expect(estimatePhase('2026-11-09', [], days)).toMatchObject({ cycleDay: 9 })
  })
})
