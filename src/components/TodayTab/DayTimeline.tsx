import { useState } from 'react'
import { colorDef, sortByTime, timeToMinutes } from '../../data/schedule'
import type { CustomBlock, DayKey } from '../../data/schedule'
import { scheduleStore } from '../../hooks/useStore'

const DAY_BY_INDEX: DayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
const COLLAPSED_ROWS = 4

export function dayKeyOf(date: Date): DayKey {
  return DAY_BY_INDEX[date.getDay()]
}

function fmtTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const hour12 = h % 12 || 12
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** Index of the block in progress at `nowMin` (last block that has started), or -1. */
export function currentBlockIndex(blocks: CustomBlock[], nowMin: number): number {
  let idx = -1
  blocks.forEach((b, i) => {
    if (timeToMinutes(b.time) <= nowMin) idx = i
  })
  return idx
}

/**
 * The day's Schedule as a compact timeline. On today it starts at the block in
 * progress ("Now"); "Open schedule" opens the full Schedule (editing, export).
 */
export default function DayTimeline({
  date,
  isToday,
  onOpenSchedule,
}: {
  date: Date
  isToday: boolean
  onOpenSchedule: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const blocks = sortByTime(scheduleStore.getWeek()[dayKeyOf(date)] ?? [])
  const now = new Date()
  const current = isToday ? currentBlockIndex(blocks, now.getHours() * 60 + now.getMinutes()) : -1
  const start = expanded ? 0 : Math.max(0, current)
  const shown = expanded ? blocks : blocks.slice(start, start + COLLAPSED_ROWS)

  return (
    <div className="tcard today-timeline">
      <div className="flex-between mb-8">
        <div className="tlabel text-muted2" style={{ marginBottom: 0 }}>
          {isToday ? 'Your day' : 'Schedule'}
        </div>
        <button type="button" className="link-btn text-sm" onClick={onOpenSchedule}>
          Open schedule →
        </button>
      </div>
      {blocks.length === 0 ? (
        <div className="train-plan-hint">No schedule for this day yet.</div>
      ) : (
        <ol className="today-timeline__list">
          {shown.map((b, i) => {
            const isNow = start + i === current
            return (
              <li key={b.id} className={`today-timeline__row${isNow ? ' is-now' : ''}`}>
                <span className="today-timeline__time">{fmtTime(b.time)}</span>
                <span className={`tdot ${colorDef(b.color).dot}`} aria-hidden="true" />
                <span className="today-timeline__title">
                  {b.title}
                  {b.dur && <span className="today-timeline__dur"> · {b.dur}</span>}
                </span>
                {isNow && <span className="today-timeline__now">Now</span>}
              </li>
            )
          })}
        </ol>
      )}
      {blocks.length > COLLAPSED_ROWS && (
        <button type="button" className="link-btn text-sm" onClick={() => setExpanded(e => !e)}>
          {expanded ? 'Show less' : `Show full day (${blocks.length})`}
        </button>
      )}
    </div>
  )
}
