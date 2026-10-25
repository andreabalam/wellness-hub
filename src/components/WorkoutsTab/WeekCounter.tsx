import type { WorkoutWeekStats } from '../../lib/workoutWeeks'
import { weekStart } from '../../lib/workoutWeeks'

function lastWeeks(today: Date, n: number): string[] {
  const out: string[] = []
  const d = new Date(weekStart(today) + 'T12:00:00')
  for (let i = 0; i < n; i++) {
    out.unshift(weekStart(d))
    d.setDate(d.getDate() - 7)
  }
  return out
}

/** Streak · total weeks · this week, with a 12-week history grid underneath. */
export default function WeekCounter({ stats, today }: { stats: WorkoutWeekStats; today: Date }) {
  const weeks = lastWeeks(today, 12)
  const tiles = [
    { value: stats.currentStreak, label: 'week streak', icon: '🔥' },
    { value: stats.totalWeeks, label: stats.totalWeeks === 1 ? 'week total' : 'weeks total' },
    {
      value: stats.thisWeek,
      label: stats.thisWeek === 1 ? 'workout this week' : 'workouts this week',
    },
  ]
  return (
    <div className="week-counter">
      <div className="week-counter__tiles">
        {tiles.map(t => (
          <div key={t.label} className="week-counter__tile">
            <div className="week-counter__value">
              {t.icon && <span aria-hidden="true">{t.icon} </span>}
              {t.value}
            </div>
            <div className="week-counter__label">{t.label}</div>
          </div>
        ))}
      </div>
      <details className="week-counter__history">
        <summary>
          Last 12 weeks{stats.longestStreak > 1 && ` · best streak ${stats.longestStreak} weeks`}
        </summary>
        <div className="week-counter__grid" role="list">
          {weeks.map(w => {
            const n = stats.byWeek[w] ?? 0
            const label = new Date(w + 'T12:00:00').toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
            return (
              <div
                key={w}
                role="listitem"
                className={`week-counter__cell${n ? ' week-counter__cell--on' : ''}`}
                title={`Week of ${label}: ${n} workout${n === 1 ? '' : 's'}`}
                aria-label={`Week of ${label}: ${n} workout${n === 1 ? '' : 's'}`}
              >
                {n || ''}
              </div>
            )
          })}
        </div>
      </details>
    </div>
  )
}
