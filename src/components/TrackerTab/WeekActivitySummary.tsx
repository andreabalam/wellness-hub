import { memo } from 'react'
import type { DayData } from '../../data/tracker'
import {
  dayMedSessions,
  dayWorkoutSessions,
  fmtMin,
  medTotals,
  workoutTotals,
} from '../../data/tracker'
import { dkey } from './dateKey'

/** Compact week roll-up of workouts + meditation, shown under the week strip. */
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
  let medDays = 0
  let medMin = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(startW)
    d.setDate(startW.getDate() + i)
    const day = getDay(dkey(d))
    const wk = workoutTotals(dayWorkoutSessions(day))
    wkSessions += wk.sessions
    wkMin += wk.min
    wkKcal += wk.kcal
    const med = medTotals(dayMedSessions(day))
    if (med.sessions > 0) medDays++
    medMin += med.min
  }

  if (wkSessions === 0 && medMin === 0) return null

  return (
    <div className="week-activity-summary">
      <span>
        <span className="text-coral">Workouts:</span> {wkSessions} session
        {wkSessions === 1 ? '' : 's'}
        {wkMin > 0 ? ` · ${fmtMin(wkMin)}` : ''}
        {wkKcal > 0 ? ` · ${wkKcal.toLocaleString()} kcal` : ''}
      </span>
      <span>
        <span className="text-gold">Meditation:</span> {medDays} day{medDays === 1 ? '' : 's'}
        {medMin > 0 ? ` · ${fmtMin(medMin)}` : ''}
      </span>
    </div>
  )
})

export default WeekActivitySummary
