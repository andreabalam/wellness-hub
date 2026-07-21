import { describe, it, expect } from 'vitest'
import {
  anchorsFromTags,
  anchorsFromTracker,
  cycleLength,
  phaseForCycleDay,
  estimatePhase,
} from '../lib/cyclePhase'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData } from '../data/tracker'

const day = (phase: string): DayData => ({ ...EMPTY_DAY, phase })

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
    expect(s).toEqual({ phase: 'Follicular', source: 'oura-tag', cycleDay: 12 })
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
    const elevated = estimatePhase('2026-07-01', ['2026-06-20'], {}, [0.25, 0.3, 0.1, 0.28, 0.31])
    expect(elevated?.phase).toBe('Luteal')
  })

  it('temperature never overrides a fresh period anchor', () => {
    const s = estimatePhase('2026-07-01', ['2026-06-29'], {}, [0.3, 0.3, 0.3, 0.3, 0.3])
    expect(s?.phase).toBe('Menstrual')
  })

  it('a short elevation (fewer than 3 of 5 readings) does not nudge', () => {
    const s = estimatePhase('2026-07-01', ['2026-06-20'], {}, [0.25, 0.1, 0.0, 0.05, 0.3])
    expect(s?.phase).toBe('Follicular')
  })

  it('an oura tag anchor wins over a manual anchor on the same date', () => {
    const days: Record<string, DayData> = { '2026-06-20': day('Menstrual') }
    const s = estimatePhase('2026-07-01', ['2026-06-20'], days)
    expect(s?.source).toBe('oura-tag')
  })
})
