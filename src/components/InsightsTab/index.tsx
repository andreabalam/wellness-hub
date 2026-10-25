import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { bodyStatsStore, trackerStore } from '../../hooks/useStore'
import { macroTargets } from '../../hooks/macroTargets'
import { CYCLE_CACHE_KEY } from '../../hooks/useCyclePhase'
import { cycleHistory, weeklySummaries } from '../../lib/insights'
import type { WeekSummary } from '../../lib/insights'
import { safeGet } from '../../lib/storage'
import { workoutWeekStats } from '../../lib/workoutWeeks'
import OuraTab from '../OuraTab'
import WeekCounter from '../WorkoutsTab/WeekCounter'

type Direction = 'up-good' | 'down-good' | 'neutral'

function fmtNum(v: number, digits = 0): string {
  return v.toLocaleString('en-US', { maximumFractionDigits: digits })
}

function fmtDay(
  key: string,
  opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
) {
  return new Date(key + 'T12:00:00').toLocaleDateString('en-US', opts)
}

/** One headline number for this week, with the change vs last week. */
function StatTile({
  label,
  value,
  prev,
  unit = '',
  digits = 0,
  direction,
}: {
  label: string
  value: number | null
  prev: number | null
  unit?: string
  digits?: number
  direction: Direction
}) {
  let delta: { text: string; tone: 'good' | 'bad' | 'flat' } | null = null
  if (value != null && prev != null) {
    const d = Math.round((value - prev) * 10 ** digits) / 10 ** digits
    if (d === 0) delta = { text: '= same as last week', tone: 'flat' }
    else {
      const up = d > 0
      const tone =
        direction === 'neutral' ? 'flat' : up === (direction === 'up-good') ? 'good' : 'bad'
      delta = {
        text: `${up ? '▲ +' : '▼ −'}${fmtNum(Math.abs(d), digits)}${unit} vs last week`,
        tone,
      }
    }
  }
  return (
    <div className="kpi-tile">
      <div className="kpi-tile__label">{label}</div>
      <div className="kpi-tile__value">
        {value == null ? '—' : `${fmtNum(value, digits)}${unit}`}
      </div>
      <div className={`kpi-tile__delta kpi-tile__delta--${delta?.tone ?? 'flat'}`}>
        {value == null ? 'No data yet' : (delta?.text ?? 'No data last week')}
      </div>
    </div>
  )
}

const cell = (v: number | null, digits = 0) => (v == null ? '—' : fmtNum(v, digits))

/**
 * Trends across days and weeks: this week's headline numbers, an 8-week
 * table, workout weeks, cycle history and the Oura dashboard.
 */
export default function InsightsTab({ user }: { user: User | null }) {
  const [today] = useState(() => new Date())

  if (!user) {
    return (
      <div className="guest-gate-cta">
        <div className="guest-gate-cta__icon">📈</div>
        <div className="section-title mb-8">
          Sign in to see <em className="text-teal">Insights</em>
        </div>
        <div className="guest-gate-cta__body">
          Weekly trends for food, workouts, sleep and energy, your workout streak and cycle history,
          plus your Oura dashboard.
        </div>
      </div>
    )
  }

  const days = trackerStore.getAll()
  const weeks = weeklySummaries(days, today, 8)
  const [thisWeek, lastWeek] = weeks as [WeekSummary, WeekSummary]
  const targets = macroTargets()
  const stats = bodyStatsStore.get()
  const cycleOn = stats.cycleType !== 'none'
  const cycle = cycleOn
    ? cycleHistory(safeGet<{ tagDays?: string[] }>(CYCLE_CACHE_KEY, {}).tagDays ?? [], days)
    : null

  return (
    <>
      <div className="page-title mb-16">
        My <em className="italic text-teal">Insights</em>
      </div>

      <section className="insights-section" aria-labelledby="ins-week">
        <h2 id="ins-week" className="insights-h">
          This week
        </h2>
        <div className="kpi-tiles">
          <StatTile
            label={`Calories / day · target ${fmtNum(targets.kcal)}`}
            value={thisWeek.kcalAvg}
            prev={lastWeek.kcalAvg}
            direction="neutral"
          />
          <StatTile
            label={`Protein / day · target ${fmtNum(targets.prot)} g`}
            value={thisWeek.protAvg}
            prev={lastWeek.protAvg}
            unit=" g"
            direction="up-good"
          />
          <StatTile
            label="Workouts"
            value={thisWeek.workouts}
            prev={lastWeek.workouts}
            direction="up-good"
          />
          <StatTile
            label="Sleep (check-in, of 5)"
            value={thisWeek.sleepAvg}
            prev={lastWeek.sleepAvg}
            digits={1}
            direction="up-good"
          />
          <StatTile
            label="Energy (check-in, of 5)"
            value={thisWeek.energyAvg}
            prev={lastWeek.energyAvg}
            digits={1}
            direction="up-good"
          />
          <StatTile
            label="Meditation"
            value={thisWeek.medMin}
            prev={lastWeek.medMin}
            unit=" min"
            direction="up-good"
          />
        </div>
      </section>

      <section className="insights-section" aria-labelledby="ins-weeks">
        <h2 id="ins-weeks" className="insights-h">
          Last 8 weeks
        </h2>
        <div className="insights-table-wrap">
          <table className="insights-table">
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">kcal / day</th>
                <th scope="col">Protein</th>
                <th scope="col">Workouts</th>
                <th scope="col">Sleep</th>
                <th scope="col">Energy</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map(w => (
                <tr key={w.week}>
                  <th scope="row">{fmtDay(w.week)}</th>
                  <td>
                    {cell(w.kcalAvg)}
                    {w.foodDays > 0 && <span className="insights-table__n"> ({w.foodDays}d)</span>}
                  </td>
                  <td>{w.protAvg == null ? '—' : `${fmtNum(w.protAvg)} g`}</td>
                  <td>{w.workouts}</td>
                  <td>{cell(w.sleepAvg, 1)}</td>
                  <td>{cell(w.energyAvg, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="train-plan-hint">
          Averages cover days with data — (5d) means food was logged on 5 days that week.
        </div>
      </section>

      <section className="insights-section" aria-labelledby="ins-train">
        <h2 id="ins-train" className="insights-h">
          Workout weeks
        </h2>
        <WeekCounter stats={workoutWeekStats(days, today)} today={today} />
      </section>

      {cycle && (
        <section className="insights-section" aria-labelledby="ins-cycle">
          <h2 id="ins-cycle" className="insights-h">
            Cycle history
          </h2>
          {cycle.periods.length === 0 ? (
            <div className="train-plan-hint">
              No periods logged yet — log them in the Oura app or mark one on the Train tab.
            </div>
          ) : (
            <>
              <div className="train-plan-hint">
                Average cycle: <strong className="text-default">{cycle.avgLength} days</strong>
                {cycle.periods.length < 3 && ' (needs a few more cycles to be reliable)'}
              </div>
              <ul className="cycle-history">
                {cycle.periods.slice(0, 8).map(p => (
                  <li key={p.start} className="cycle-history__row">
                    <span>
                      {fmtDay(p.start, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <span className="text-muted">
                      {p.length == null ? 'current cycle' : `${p.length} days`}
                    </span>
                    <span className="text-muted2">
                      {p.source === 'oura-tag' ? '◎ Oura' : '✎ marked'}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      <section className="insights-section" aria-labelledby="ins-oura">
        <h2 id="ins-oura" className="insights-h">
          Oura
        </h2>
        <OuraTab user={user} />
      </section>
    </>
  )
}
