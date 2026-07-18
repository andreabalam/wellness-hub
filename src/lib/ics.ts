import type { ScheduleBlock } from '../data/schedule'
import { DAY_KEYS } from '../data/schedule'
import type { DayKey } from '../data/schedule'

// ── Duration parser ───────────────────────────────────────────────
// Converts strings like "30 min", "1 hr 30 min", "90-120 min", "—"
// into ISO 8601 duration strings like "PT30M", "PT1H30M", "PT90M"

export function parseDuration(dur: string): string {
  if (!dur || dur === '—') return 'PT30M'

  const hasHr = /hr|hour/i.test(dur)
  const hasMin = /min/i.test(dur)
  const nums = (dur.match(/\d+/g) ?? []).map(Number)

  if (nums.length === 0) return 'PT30M'

  if (hasHr && hasMin && nums.length >= 2) return `PT${nums[0]}H${nums[1]}M`
  if (hasHr) return `PT${nums[0]}H`
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
  const y = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${mo}${d}T${timeToIcs(time)}`
}

/** Return the given date if it is Mon–Fri, otherwise advance to the next Monday */
function firstWeekday(from: Date): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0=Sun … 6=Sat
  if (dow === 0)
    d.setDate(d.getDate() + 1) // Sun → Mon
  else if (dow === 6) d.setDate(d.getDate() + 2) // Sat → Mon
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

/**
 * IANA timezone of the browser, e.g. "America/Los_Angeles".
 * Returns null when unavailable — DTSTART then stays floating.
 */
export function localTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null
  } catch {
    return null
  }
}

/**
 * DTSTART property with the user's timezone attached. Floating times
 * (no TZID) are treated as UTC by Google Calendar on import, shifting
 * every event by the UTC offset. Google/Apple/Outlook all accept IANA
 * TZIDs without a VTIMEZONE component.
 */
function dtStartLine(anchor: Date, time: string, tz: string | null): string {
  const value = dtStart(anchor, time)
  return tz ? `DTSTART;TZID=${tz}:${value}` : `DTSTART:${value}`
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
  tz: string | null = localTimeZone(),
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
  if (tz) lines.push(`X-WR-TIMEZONE:${tz}`)

  blocks.forEach((b, i) => {
    const uid = `whub-${i}-${Date.now()}@wellness-hub`
    const duration = parseDuration(b.dur)
    const rrule = `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR;UNTIL=${untilStr}`

    const event: string[] = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      dtStartLine(anchor, b.time, tz),
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
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
}
const BYDAY_MAP: Record<DayKey, string> = {
  mon: 'MO',
  tue: 'TU',
  wed: 'WE',
  thu: 'TH',
  fri: 'FR',
  sat: 'SA',
  sun: 'SU',
}

function firstOccurrenceOfDay(from: Date, day: DayKey): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  const diff = (DOW_MAP[day] - d.getDay() + 7) % 7
  d.setDate(d.getDate() + diff)
  return d
}

/**
 * Fingerprint of the fields that end up in an exported VEVENT.
 * Ignores id/color, which differ between days even for identical schedules.
 */
function exportFingerprint(blocks: ScheduleBlock[]): string {
  return blocks.map(b => [b.time, b.title, b.dur, b.desc, b.whyTxt].join('|')).join('\n')
}

/** True when every day of the week has the same (non-empty) exported blocks */
function isUniformWeek(week: Record<DayKey, ScheduleBlock[]>): boolean {
  if (!week[DAY_KEYS[0]]?.length) return false
  const first = exportFingerprint(week[DAY_KEYS[0]])
  return DAY_KEYS.every(d => exportFingerprint(week[d] ?? []) === first)
}

/**
 * Generate an .ics file string from a per-day WeekSchedule.
 * Each day's blocks become recurring VEVENTs on that specific weekday.
 * When all 7 days are identical, each block becomes a single daily-recurring
 * VEVENT instead of 7 per-weekday ones.
 */
export function generateWeekIcs(
  week: Record<DayKey, ScheduleBlock[]>,
  startDate: Date,
  endDate: Date,
  tz: string | null = localTimeZone(),
): string {
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
  if (tz) lines.push(`X-WR-TIMEZONE:${tz}`)

  const pushEvent = (b: ScheduleBlock, uid: string, anchor: Date, rrule: string) => {
    const event: string[] = [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${now}`,
      dtStartLine(anchor, b.time, tz),
      `DURATION:${parseDuration(b.dur)}`,
      `RRULE:${rrule}`,
      `SUMMARY:${escapeIcs(b.title)}`,
    ]
    if (b.desc) event.push(`DESCRIPTION:${escapeIcs(b.desc)}`)
    if (b.whyTxt) event.push(`CATEGORIES:${escapeIcs(b.whyTxt)}`)
    event.push('END:VEVENT')
    lines.push(...event)
  }

  if (isUniformWeek(week)) {
    // Same blocks every day — one daily-recurring event per block
    const anchor = new Date(startDate)
    anchor.setHours(0, 0, 0, 0)
    let idx = 0
    for (const b of week[DAY_KEYS[0]]) {
      pushEvent(b, `whub-daily-${idx++}@wellness-hub`, anchor, `FREQ=DAILY;UNTIL=${untilStr}`)
    }
  } else {
    let idx = 0
    for (const day of DAY_KEYS) {
      const blocks = week[day]
      if (!blocks?.length) continue
      const anchor = firstOccurrenceOfDay(startDate, day)
      const byday = BYDAY_MAP[day]
      for (const b of blocks) {
        pushEvent(
          b,
          `whub-${day}-${idx++}@wellness-hub`,
          anchor,
          `FREQ=WEEKLY;BYDAY=${byday};UNTIL=${untilStr}`,
        )
      }
    }
  }

  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

/** Trigger a .ics file download in the browser */
export function downloadIcs(content: string, filename = 'wellness-schedule.ics') {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
