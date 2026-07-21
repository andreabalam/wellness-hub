import { memo } from 'react'
import type { DayData } from '../../data/tracker'
import { dayMedSessions, dayWorkoutSessions, workoutTotals } from '../../data/tracker'
import { dkey } from './dateKey'

const WeekStrip = memo(function WeekStrip({
  currentDate,
  onSelect,
  getDay,
  burnThreshold,
}: {
  currentDate: Date
  onSelect: (d: Date) => void
  getDay: (key: string) => DayData
  /** Burned kcal at/above which a day shows the 🔥 indicator instead of the plain W. */
  burnThreshold: number
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  // Build week around currentDate (not always today) so Prev/Next navigate the strip too
  const cur = new Date(currentDate)
  cur.setHours(0, 0, 0, 0)
  const dow = (cur.getDay() + 6) % 7
  const startW = new Date(cur)
  startW.setDate(cur.getDate() - dow)
  const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // Label: "This week" when showing the current calendar week, otherwise show the range
  const todayDow = (today.getDay() + 6) % 7
  const startOfThisWeek = new Date(today)
  startOfThisWeek.setDate(today.getDate() - todayDow)
  const isThisWeek = startW.getTime() === startOfThisWeek.getTime()
  const endW = new Date(startW)
  endW.setDate(startW.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weekLabel = isThisWeek ? 'This week' : `${fmt(startW)} – ${fmt(endW)}`

  return (
    <div className="tcard">
      <div className="week-strip-header">{weekLabel}</div>
      <div className="week-strip-grid">
        {DL.map((lbl, i) => {
          const d = new Date(startW)
          d.setDate(startW.getDate() + i)
          const k = dkey(d)
          const data = getDay(k)
          const kcal = data.foods.reduce((s, f) => s + f.k, 0)
          const wk = workoutTotals(dayWorkoutSessions(data))
          const hasW = wk.sessions > 0
          const bigBurn = wk.kcal >= burnThreshold
          const hasM = dayMedSessions(data).length > 0
          const isToday = d.getTime() === today.getTime()
          const isCur = d.getTime() === currentDate.getTime()
          return (
            <div
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`${lbl} ${d.getDate()}${isCur ? ', selected' : ''}`}
              aria-current={isCur ? 'date' : undefined}
              onClick={() => onSelect(new Date(d))}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSelect(new Date(d))
                }
              }}
              className={`week-strip-cell ${isCur ? 'week-strip-cell--cur' : isToday ? 'week-strip-cell--today' : ''}`}
            >
              <div
                className={`font-mono ${isToday ? 'text-teal' : 'text-muted2'}`}
                style={{ fontSize: 10, marginBottom: 2 }}
              >
                {lbl}
              </div>
              <div className="text-muted2" style={{ fontSize: 10, marginBottom: 3 }}>
                {d.getDate()}
              </div>
              <div
                className={`font-mono ${kcal > 0 ? 'text-green' : 'text-muted2'}`}
                style={{ fontSize: 10 }}
              >
                {kcal > 0 ? kcal : '-'}
              </div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                {bigBurn ? (
                  <span className="text-coral" title={`${wk.kcal} kcal burned`}>
                    🔥{wk.kcal}{' '}
                  </span>
                ) : (
                  hasW && <span className="text-coral">W</span>
                )}
                {hasM && <span className="text-gold">M</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="week-strip-legend">
        <span>
          <span className="text-green">●</span> kcal
        </span>
        <span>
          <span className="text-coral">W</span> workout
        </span>
        <span>
          <span className="text-coral">🔥</span> big burn
        </span>
        <span>
          <span className="text-gold">M</span> meditation
        </span>
      </div>
    </div>
  )
})

export default WeekStrip
