import type { ScheduleBlock } from '../data/schedule'

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

/** "08:00" or "8:00" → "080000" */
function timeToIcs(time: string): string {
  const [h, m] = time.split(':')
  return `${h.padStart(2, '0')}${(m ?? '00').padStart(2, '0')}00`
}

/** date + "HH:MM" → "YYYYMMDDTHHMMSS" (floating / local time, no Z) */
function dtStart(date: Date, time: string): string {
  const y  = date.getFullYear()
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  const d  = String(date.getDate()).padStart(2, '0')
  return `${y}${mo}${d}T${timeToIcs(time)}`
}

/** Return first Monday on or after the given date */
function firstMonday(from: Date): Date {
  const d = new Date(from)
  d.setHours(0, 0, 0, 0)
  // getDay(): 0=Sun,1=Mon,…,6=Sat  →  shift so Mon=0
  const dow = (d.getDay() + 6) % 7   // Mon=0 … Sun=6
  if (dow !== 0) d.setDate(d.getDate() + (7 - dow))
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
  const anchor = firstMonday(startDate)

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
