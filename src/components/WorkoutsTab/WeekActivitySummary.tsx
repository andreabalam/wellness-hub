import { memo } from 'react'
import type { DayData } from '../../data/tracker'
import { dayWorkoutSessions, fmtMin, workoutTotals } from '../../data/tracker'
import { dkey } from '../../lib/dateKey'

/** Compact week roll-up of workouts, shown at the top of Train → History (meditation has its own tab). */
const WeekActivitySummary = memo(function WeekActivitySummary({
  currentDate,
  getDay,
}: {
  currentDate: Date
  getDay: (key: string) => DayData
}) {
  const cur = new Date(currentDate)
  cur.setHours(0, 0, 0, 0)
  const dow = (cur.getDay() + 6) % 7
  const startW = new Date(cur)
  startW.setDate(cur.getDate() - dow)

  let wkSessions = 0
  let wkMin = 0
  let wkKcal = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(startW)
    d.setDate(startW.getDate() + i)
    const day = getDay(dkey(d))
    const wk = workoutTotals(dayWorkoutSessions(day))
    wkSessions += wk.sessions
    wkMin += wk.min
    wkKcal += wk.kcal
  }

  if (wkSessions === 0) return null

  return (
    <div className="week-activity-summary">
      <span>
        <span className="text-coral">Workouts:</span> {wkSessions} session
        {wkSessions === 1 ? '' : 's'}
        {wkMin > 0 ? ` · ${fmtMin(wkMin)}` : ''}
        {wkKcal > 0 ? ` · ${wkKcal.toLocaleString()} kcal` : ''}
      </span>
    </div>
  )
})

export default WeekActivitySummary
