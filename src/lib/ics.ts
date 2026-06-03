import type { ScheduleBlock } from '../data/schedule'
import { DAY_KEYS } from '../data/schedule'
import type { DayKey } from '../data/schedule'

// ── Duration parser ───────────────────────────────────────────────
// Converts strings like "30 min", "1 hr 30 min", "90-120 min", "—"
// into ISO 8601 duration strings like "PT30M", "PT1H30M", "PT90M"

export function parseDuration(dur: string): string {
  if (!dur || dur === '—') return 'PT30M'

  const hasHr  = /hr|hour/i.test(dur)
  const hasMin = /min/i.test(dur)
  const nums   = (dur.match(/\d+/g) ?? []).map(Number)

  if (nums.length === 0) return 'PT30M'

  if (hasHr && hasMin && nums.length >= 2) return `PT${nums[0]}H${nums[1]}M`
  if (hasHr)  return `PT${nums[0]}H`
  // Ranges like "90-120 min" → take the first number
  return `PT${nums[0]}M`
}

// ── Time helpers ─────────────────────────────────────────────────

/** "08:00", "8:00", "4:00 PM" → "080000" / "160000" */
function timeToIcs(time: string): string {
  const m = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i)
  if (!m) return '000000'
  let h = parseInt(m[1], 10)
  const min = m[2]
  const period = m[3]?.toUpperCase()
  if (period === 'PM' && h !== 12) h += 12
  if (period === 'AM' && h === 12) h = 0
  return `${String(h).padStart(2, '0')}${min}00`
}

/** date + "HH:MM" → "YYYYMMDDTHHMMSS" (floating / local time, no Z) */
function dtStart(date: Date, time: string): string {
  const y  = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d  = String(date.getDate()).padStart(2, '0')
  return `${y}${mo}${d}T${timeToIcs(time)}`
}

/** Return the given date if it is Mon–Fri, otherwise advance to the next Monday */
function firstWeekday(from: Date): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay()   // 0=Sun … 6=Sat
  if (dow === 0) d.setDate(d.getDate() + 1)       // Sun → Mon
  else if (dow === 6) d.setDate(d.getDate() + 2)  // Sat → Mon
  return d
}

/** Escape ICS text values */
function escapeIcs(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

/** Fold long lines per RFC 5545 (max 75 octets, continuation with CRLF + space) */
function foldLine(line: string): string {
  const out: string[] = []
  let remaining = line
  while (remaining.length > 75) {
    out.push(remaining.slice(0, 75))
    remaining = ' ' + remaining.slice(75)
  }
  out.push(remaining)
  return out.join('\r\n')
}

// ── Main export ──────────────────────────────────────────────────

/**
 * Generate an .ics file string from a list of schedule blocks.
 * Each block becomes a recurring VEVENT (Mon–Fri) between startDate and endDate.
 */
export function generateIcs(
  blocks: ScheduleBlock[],
  startDate: Date,
  endDate: Date,
): string {
  const anchor = firstWeekday(startDate)

  // UNTIL must be UTC, end of the last day
  const until = new Date(endDate)
  until.setHours(23, 59, 59, 0)
  const untilStr =
    until.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '').replace('Z', '') + 'Z'

  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Wellness Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Wellness Hub Schedule',
  ]

  blocks.forEach((b, i) => {
    const uid      = `whub-${i}-${Date.now()}@wellness-hub`
    const start    = dtStart(anchor, b.time)
    const duration = parseDuration(b.dur)
    const rrule    = `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=${untilStr}`

    const event: string[] = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DURATION:${duration}`,
      `RRULE:${rrule}`,
      `SUMMARY:${escapeIcs(b.title)}`,
    ]

    if (b.desc) {
      event.push(`DESCRIPTION:${escapeIcs(b.desc)}`)
    }
    if (b.whyTxt) {
      event.push(`CATEGORIES:${escapeIcs(b.whyTxt)}`)
    }
    event.push('END:VEVENT')

    lines.push(...event)
  })

  lines.push('END:VCALENDAR')

  return lines.map(foldLine).join('\r\n') + '\r\n'
}

// ── Week schedule ICS export ──────────────────────────────────────

const DOW_MAP: Record<DayKey, number> = {
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
}
const BYDAY_MAP: Record<DayKey, string> = {
  mon: 'MO', tue: 'TU', wed: 'WE', thu: 'TH', fri: 'FR', sat: 'SA', sun: 'SU',
}

function firstOccurrenceOfDay(from: Date, day: DayKey): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const diff = (DOW_MAP[day] - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Generate an .ics file string from a per-day WeekSchedule.
 * Each day's blocks become recurring VEVENTs on that specific weekday.
 */
export function generateWeekIcs(
  week: Record<DayKey, ScheduleBlock[]>,
  startDate: Date,
  endDate: Date,
): string {
  const until = new Date(endDate)
  until.setHours(23, 59, 59, 0)
  const untilStr = until.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '').replace('Z', '') + 'Z'
  const now = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//My Wellness Hub//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Wellness Hub Schedule',
  ]

  let idx = 0
  for (const day of DAY_KEYS) {
    const blocks = week[day]
    if (!blocks?.length) continue
    const anchor = firstOccurrenceOfDay(startDate, day)
    const byday  = BYDAY_MAP[day]
    for (const b of blocks) {
      const uid      = `whub-${day}-${idx++}@wellness-hub`
      const start    = dtStart(anchor, b.time)
      const duration = parseDuration(b.dur)
      const rrule    = `FREQ=WEEKLY;BYDAY=${byday};UNTIL=${untilStr}`
      const event: string[] = [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${now}`,
        `DTSTART:${start}`,
        `DURATION:${duration}`,
        `RRULE:${rrule}`,
        `SUMMARY:${escapeIcs(b.title)}`,
      ]
      if (b.desc)    event.push(`DESCRIPTION:${escapeIcs(b.desc)}`)
      if (b.whyTxt)  event.push(`CATEGORIES:${escapeIcs(b.whyTxt)}`)
      event.push('END:VEVENT')
      lines.push(...event)
    }
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Trigger a .ics file download in the browser */
export function downloadIcs(content: string, filename = 'wellness-schedule.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
