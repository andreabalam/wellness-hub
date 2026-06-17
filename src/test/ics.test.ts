import { describe, it, expect, vi, afterEach } from 'vitest'
import { parseDuration, generateIcs, generateWeekIcs, downloadIcs } from '../lib/ics'
import type { ScheduleBlock } from '../data/schedule'
import type { DayKey } from '../data/schedule'

afterEach(() => vi.restoreAllMocks())

// ── parseDuration ─────────────────────────────────────────────────

describe('parseDuration', () => {
  it('returns PT30M for empty string', () => {
    expect(parseDuration('')).toBe('PT30M')
  })

  it('returns PT30M for "—"', () => {
    expect(parseDuration('—')).toBe('PT30M')
  })

  it('parses "30 min"', () => {
    expect(parseDuration('30 min')).toBe('PT30M')
  })

  it('parses "5 min"', () => {
    expect(parseDuration('5 min')).toBe('PT5M')
  })

  it('parses "15 min"', () => {
    expect(parseDuration('15 min')).toBe('PT15M')
  })

  it('parses "1 hr"', () => {
    expect(parseDuration('1 hr')).toBe('PT1H')
  })

  it('parses "2 hour"', () => {
    expect(parseDuration('2 hour')).toBe('PT2H')
  })

  it('parses "1 hr 30 min"', () => {
    expect(parseDuration('1 hr 30 min')).toBe('PT1H30M')
  })

  it('parses "1 hour 15 min"', () => {
    expect(parseDuration('1 hour 15 min')).toBe('PT1H15M')
  })

  it('parses range "90-120 min" → first number', () => {
    expect(parseDuration('90-120 min')).toBe('PT90M')
  })

  it('parses range "10-15 min" → first number', () => {
    expect(parseDuration('10-15 min')).toBe('PT10M')
  })

  it('returns PT30M for string with no digits', () => {
    expect(parseDuration('some time')).toBe('PT30M')
  })
})

// ── generateIcs ───────────────────────────────────────────────────

const SINGLE_BLOCK: ScheduleBlock[] = [
  {
    phase: 'Morning',
    time: '09:00',
    title: 'Deep Work',
    dur: '90 min',
    dot: 'cg',
    why: 'wg',
    whyTxt: 'focus',
    desc: 'Focus session',
    bridge: null,
  },
]

describe('generateIcs', () => {
  const start = new Date('2026-06-01T00:00:00')
  const end = new Date('2026-07-01T00:00:00')

  it('returns a string starting with BEGIN:VCALENDAR', () => {
    const ics = generateIcs(SINGLE_BLOCK, start, end)
    expect(ics).toContain('BEGIN:VCALENDAR')
  })

  it('ends with END:VCALENDAR and CRLF', () => {
    const ics = generateIcs(SINGLE_BLOCK, start, end)
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/)
  })

  it('uses CRLF line endings', () => {
    const ics = generateIcs(SINGLE_BLOCK, start, end)
    expect(ics).toContain('\r\n')
  })

  it('includes VERSION:2.0', () => {
    expect(generateIcs(SINGLE_BLOCK, start, end)).toContain('VERSION:2.0')
  })

  it('includes CALSCALE:GREGORIAN', () => {
    expect(generateIcs(SINGLE_BLOCK, start, end)).toContain('CALSCALE:GREGORIAN')
  })

  it('includes one VEVENT per block', () => {
    const ics = generateIcs(SINGLE_BLOCK, start, end)
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1)
  })

  it('includes SUMMARY with the block title', () => {
    expect(generateIcs(SINGLE_BLOCK, start, end)).toContain('SUMMARY:Deep Work')
  })

  it('includes DURATION with parsed duration', () => {
    expect(generateIcs(SINGLE_BLOCK, start, end)).toContain('DURATION:PT90M')
  })

  it('RRULE targets weekdays only', () => {
    const ics = generateIcs(SINGLE_BLOCK, start, end)
    expect(ics).toContain('BYDAY=MO,TU,WE,TH,FR')
  })

  it('includes DESCRIPTION when block has desc', () => {
    expect(generateIcs(SINGLE_BLOCK, start, end)).toContain('DESCRIPTION:Focus session')
  })

  it('includes CATEGORIES when block has whyTxt', () => {
    expect(generateIcs(SINGLE_BLOCK, start, end)).toContain('CATEGORIES:focus')
  })

  it('omits DESCRIPTION when desc is empty', () => {
    const noDesc: ScheduleBlock[] = [{ ...SINGLE_BLOCK[0], desc: '' }]
    const ics = generateIcs(noDesc, start, end)
    expect(ics).not.toContain('DESCRIPTION:')
  })

  it('omits CATEGORIES when whyTxt is empty', () => {
    const noWhy: ScheduleBlock[] = [{ ...SINGLE_BLOCK[0], whyTxt: '' }]
    const ics = generateIcs(noWhy, start, end)
    expect(ics).not.toContain('CATEGORIES:')
  })

  it('handles multiple blocks — one VEVENT each', () => {
    const two: ScheduleBlock[] = [
      ...SINGLE_BLOCK,
      {
        phase: null,
        time: '11:00',
        title: 'Lunch Break',
        dur: '30 min',
        dot: 'ca',
        why: 'wa',
        whyTxt: '',
        desc: '',
        bridge: null,
      },
    ]
    const ics = generateIcs(two, start, end)
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)
    expect(ics).toContain('SUMMARY:Deep Work')
    expect(ics).toContain('SUMMARY:Lunch Break')
  })

  it('DTSTART uses startDate directly when it is a weekday (Monday)', () => {
    // 2026-06-01 is Monday → anchor stays 2026-06-01
    const ics = generateIcs(SINGLE_BLOCK, start, end)
    expect(ics).toContain('DTSTART:20260601T090000')
  })

  it('DTSTART uses startDate directly when it is mid-week (Wednesday)', () => {
    // 2026-06-03 is Wednesday → anchor stays 2026-06-03, not the next Monday
    const wed = new Date('2026-06-03T00:00:00')
    const ics = generateIcs(SINGLE_BLOCK, wed, end)
    expect(ics).toContain('DTSTART:20260603T090000')
  })

  it('DTSTART advances to next Monday when startDate is a Saturday', () => {
    // 2026-06-06 is Saturday → anchor is 2026-06-08 (Monday)
    const sat = new Date('2026-06-06T00:00:00')
    const ics = generateIcs(SINGLE_BLOCK, sat, end)
    expect(ics).toContain('DTSTART:20260608T090000')
  })

  it('DTSTART advances to next Monday when startDate is a Sunday', () => {
    // 2026-06-07 is Sunday → anchor is 2026-06-08 (Monday)
    const sun = new Date('2026-06-07T00:00:00')
    const ics = generateIcs(SINGLE_BLOCK, sun, end)
    expect(ics).toContain('DTSTART:20260608T090000')
  })

  it('UNTIL is in the RRULE with trailing Z', () => {
    const ics = generateIcs(SINGLE_BLOCK, start, end)
    expect(ics).toMatch(/UNTIL=\d{8}T\d{6}Z/)
  })

  it('handles a block with "—" dur (fallback PT30M)', () => {
    const dashBlk: ScheduleBlock[] = [{ ...SINGLE_BLOCK[0], dur: '—' }]
    expect(generateIcs(dashBlk, start, end)).toContain('DURATION:PT30M')
  })

  it('escapes special characters in SUMMARY', () => {
    const special: ScheduleBlock[] = [{ ...SINGLE_BLOCK[0], title: 'A, B; C' }]
    const ics = generateIcs(special, start, end)
    expect(ics).toContain('SUMMARY:A\\,')
  })
})

// ── downloadIcs ───────────────────────────────────────────────────

describe('downloadIcs', () => {
  it('calls URL.createObjectURL and triggers a click', () => {
    const mockUrl = 'blob:test-url'
    const createObjectURL = vi.fn(() => mockUrl)
    const revokeObjectURL = vi.fn()
    const click = vi.fn()

    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    const spy = vi
      .spyOn(document, 'createElement')
      .mockReturnValue({ href: '', download: '', click } as unknown as HTMLAnchorElement)

    downloadIcs('BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n', 'test.ics')

    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith(mockUrl)

    spy.mockRestore()
  })

  it('uses default filename when not provided', () => {
    const createObjectURL = vi.fn(() => 'blob:x')
    const revokeObjectURL = vi.fn()
    let captured = ''
    const click = vi.fn()
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL })
    vi.spyOn(document, 'createElement').mockReturnValue({
      set download(v: string) {
        captured = v
      },
      href: '',
      click,
    } as unknown as HTMLAnchorElement)

    downloadIcs('content')
    expect(captured).toBe('wellness-schedule.ics')
  })
})

// ── generateWeekIcs ───────────────────────────────────────────────

const MON_BLOCK: ScheduleBlock = {
  phase: 'Morning',
  time: '09:00',
  title: 'Mon Deep Work',
  dur: '90 min',
  dot: 'cg',
  why: 'wg',
  whyTxt: 'focus',
  desc: 'Monday focus session',
  bridge: null,
}

const SAT_BLOCK: ScheduleBlock = {
  phase: null,
  time: '10:00',
  title: 'Sat Yoga',
  dur: '60 min',
  dot: 'ct',
  why: 'wt',
  whyTxt: 'flexibility',
  desc: 'Saturday yoga',
  bridge: null,
}

function makeWeekWith(mon: ScheduleBlock[], sat: ScheduleBlock[]): Record<DayKey, ScheduleBlock[]> {
  return {
    mon,
    tue: [],
    wed: [],
    thu: [],
    fri: [],
    sat,
    sun: [],
  }
}

describe('generateWeekIcs', () => {
  const start = new Date('2026-06-01T00:00:00') // Monday
  const end = new Date('2026-07-01T00:00:00')

  it('generates BEGIN:VCALENDAR', () => {
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], []), start, end)
    expect(ics).toContain('BEGIN:VCALENDAR')
  })

  it('ends with END:VCALENDAR and CRLF', () => {
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], []), start, end)
    expect(ics.trimEnd()).toMatch(/END:VCALENDAR$/)
  })

  it('Mon block gets BYDAY=MO in RRULE', () => {
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], []), start, end)
    expect(ics).toContain('BYDAY=MO')
  })

  it('Sat block gets BYDAY=SA in RRULE', () => {
    const ics = generateWeekIcs(makeWeekWith([], [SAT_BLOCK]), start, end)
    expect(ics).toContain('BYDAY=SA')
  })

  it('Mon block DTSTART is on a Monday', () => {
    // 2026-06-01 is Monday → anchor stays 2026-06-01
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], []), start, end)
    expect(ics).toContain('DTSTART:20260601T090000')
  })

  it('Sat block DTSTART is on the first Saturday on or after startDate', () => {
    // 2026-06-01 is Monday → first Saturday is 2026-06-06
    const ics = generateWeekIcs(makeWeekWith([], [SAT_BLOCK]), start, end)
    expect(ics).toContain('DTSTART:20260606T100000')
  })

  it('each day produces one VEVENT per block', () => {
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], [SAT_BLOCK]), start, end)
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)
  })

  it('empty day array generates no events for that day', () => {
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], []), start, end)
    expect(ics).not.toContain('BYDAY=SA')
    expect((ics.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1)
  })

  it('includes SUMMARY with the block title', () => {
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], [SAT_BLOCK]), start, end)
    expect(ics).toContain('SUMMARY:Mon Deep Work')
    expect(ics).toContain('SUMMARY:Sat Yoga')
  })

  it('includes UNTIL in the RRULE with trailing Z', () => {
    const ics = generateWeekIcs(makeWeekWith([MON_BLOCK], []), start, end)
    expect(ics).toMatch(/UNTIL=\d{8}T\d{6}Z/)
  })

  it('fully empty week produces no VEVENTs', () => {
    const emptyWeek: Record<DayKey, ScheduleBlock[]> = {
      mon: [],
      tue: [],
      wed: [],
      thu: [],
      fri: [],
      sat: [],
      sun: [],
    }
    const ics = generateWeekIcs(emptyWeek, start, end)
    expect(ics).not.toContain('BEGIN:VEVENT')
  })
})
