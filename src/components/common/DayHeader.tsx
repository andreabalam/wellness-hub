import { addDays, dkey } from '../../lib/dateKey'

/**
 * Day title with ‹ › navigation, shared by the day-based tabs (Today,
 * Meditate). Shows "Today" (or `todayTitle`) for the current day, else the weekday.
 */
export default function DayHeader({
  date,
  onDateChange,
  todayTitle = 'Today',
}: {
  date: Date
  onDateChange: (d: Date) => void
  todayTitle?: string
}) {
  const isToday = dkey(date) === dkey(new Date())
  return (
    <div className="today-hdr">
      <button
        type="button"
        onClick={() => onDateChange(addDays(date, -1))}
        className="date-nav-btn"
        aria-label="Previous day"
      >
        ‹
      </button>
      <div className="today-hdr__title">
        <div className="page-title">
          {isToday ? todayTitle : date.toLocaleDateString('en-US', { weekday: 'long' })}
        </div>
        <div className="date-display">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
      </div>
      <button
        type="button"
        onClick={() => onDateChange(addDays(date, 1))}
        className="date-nav-btn"
        aria-label="Next day"
      >
        ›
      </button>
    </div>
  )
}
