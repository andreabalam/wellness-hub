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
import { EMPTY_DAY } from '../data/tracker'
import type { DayData } from '../data/tracker'

const day = (phase: string): DayData => ({ ...EMPTY_DAY, phase })

/** Consecutive nightly readings ending on `end` (inclusive), oldest first. */
function series(end: string, devs: number[]): TempReading[] {
  const endMs = new Date(end + 'T12:00:00').getTime()
  return devs.map((dev, i) => {
    const d = new Date(endMs - (devs.length - 1 - i) * 86_400_000)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
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
