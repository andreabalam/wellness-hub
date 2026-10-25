import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { bodyStatsStore, trackerStore } from '../../hooks/useStore'
import { macroTargets } from '../../hooks/macroTargets'
import { CYCLE_CACHE_KEY } from '../../hooks/useCyclePhase'
import { cycleHistory, weeklySummaries } from '../../lib/insights'
import type { WeekSummary } from '../../lib/insights'
import { isOuraConnected } from '../../lib/oura'
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

/** 8-week line, oldest → newest; weeks without data leave a gap. */
function Sparkline({ values }: { values: (number | null)[] }) {
  const nums = values.filter((v): v is number => v != null)
  if (nums.length < 2) return <svg className="trend-row__spark" aria-hidden="true" />
  const W = 64
  const H = 20
  const lo = Math.min(...nums)
  const span = Math.max(...nums) - lo || 1
  const x = (i: number) => (i / (values.length - 1)) * W
  const y = (v: number) => H - 2 - ((v - lo) / span) * (H - 4)
  let d = ''
  values.forEach((v, i) => {
    if (v == null) return
    d += `${i > 0 && values[i - 1] != null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`
  })
  const last = values[values.length - 1]
  return (
    <svg className="trend-row__spark" viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={d} />
      {last != null && <circle cx={x(values.length - 1)} cy={y(last)} r={2} />}
    </svg>
  )
}

/** One metric: this week's value, the change vs last week and the 8-week line. */
function TrendRow({
  label,
  sub,
  values,
  unit = '',
  digits = 0,
  direction,
}: {
  label: string
  sub?: string
  /** Newest week first, as weeklySummaries returns them */
  values: (number | null)[]
  unit?: string
  digits?: number
  direction: Direction
}) {
  const [value, prev] = values
  let delta: { text: string; tone: 'good' | 'bad' | 'flat' } = {
    text: value == null ? 'No data yet' : 'No data last week',
    tone: 'flat',
  }
  if (value != null && prev != null) {
    const d = Math.round((value - prev) * 10 ** digits) / 10 ** digits
    if (d === 0) delta = { text: '= last week', tone: 'flat' }
    else {
      const up = d > 0
      delta = {
        text: `${up ? '▲ +' : '▼ −'}${fmtNum(Math.abs(d), digits)}${unit}`,
        tone: direction === 'neutral' ? 'flat' : up === (direction === 'up-good') ? 'good' : 'bad',
      }
    }
  }
  return (
    <li className="trend-row">
      <div className="trend-row__label">
        {label}
        {sub && <span className="trend-row__sub">{sub}</span>}
      </div>
      <Sparkline values={[...values].reverse()} />
      <div className="trend-row__value">
        {value == null ? '—' : `${fmtNum(value, digits)}${unit}`}
        <span className={`trend-row__delta trend-row__delta--${delta.tone}`}>{delta.text}</span>
      </div>
    </li>
  )
}

/**
 * Trends across weeks: one row per metric (this week, change vs last week,
 * 8-week line), workout weeks, cycle history and Oura's own metrics.
 */
export default function InsightsTab({ user }: { user: User | null }) {
  const [today] = useState(() => new Date())
  // Not connected → the Oura section opens on the connect screen
  const [ouraConnected, setOuraConnected] = useState<boolean | null>(null)

  useEffect(() => {
    if (!user) return
    isOuraConnected()
      .then(setOuraConnected)
      .catch(() => {})
  }, [user])

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
  const [thisWeek] = weeks as [WeekSummary]
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
          This week vs last · 8-week trend
        </h2>
        <ul className="trend-list">
          <TrendRow
            label="Calories / day"
            sub={`target ${fmtNum(targets.kcal)}`}
            values={weeks.map(w => w.kcalAvg)}
            direction="neutral"
          />
          <TrendRow
            label="Protein / day"
            sub={`target ${fmtNum(targets.prot)} g`}
            values={weeks.map(w => w.protAvg)}
            unit=" g"
            direction="up-good"
          />
          <TrendRow label="Workouts" values={weeks.map(w => w.workouts)} direction="up-good" />
          <TrendRow
            label="Sleep"
            sub="check-in, of 5"
            values={weeks.map(w => w.sleepAvg)}
            digits={1}
            direction="up-good"
          />
          <TrendRow
            label="Energy"
            sub="check-in, of 5"
            values={weeks.map(w => w.energyAvg)}
            digits={1}
            direction="up-good"
          />
          <TrendRow
            label="Meditation"
            values={weeks.map(w => w.medMin)}
            unit=" min"
            direction="up-good"
          />
        </ul>
        <div className="train-plan-hint">
          Food, sleep and energy average the days you logged them
          {thisWeek.foodDays > 0 &&
            ` — food was logged on ${thisWeek.foodDays} day${thisWeek.foodDays === 1 ? '' : 's'} this week`}
          .
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

      {/* Oura's own metrics (readiness, workouts and meditation already show on Today/Train) */}
      <details className="insights-section insights-oura" open={ouraConnected === false}>
        <summary className="insights-h insights-oura__summary">
          Oura · sleep, activity, stress &amp; more
        </summary>
        <OuraTab user={user} />
      </details>
    </>
  )
}
