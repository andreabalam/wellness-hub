import { useMemo, useState } from 'react'
import type { DayData } from '../../data/tracker'
import { fmtMin, workoutSessionLabel, workoutTotals } from '../../data/tracker'
import { loggedSummary } from '../../lib/workoutLog'
import { countsAsWorkout } from '../../lib/workoutWeeks'
import { exerciseProgress, workoutHistory } from '../../lib/workoutProgress'
import type { ExerciseProgress } from '../../lib/workoutProgress'

const WEEKS_PAGE = 4
const PROGRESS_PAGE = 8

function fmtDate(key: string, opts: Intl.DateTimeFormatOptions): string {
  return new Date(key + 'T12:00:00').toLocaleDateString('en-US', opts)
}

function fmtValue(p: ExerciseProgress, v: number): string {
  const n = Number.isInteger(v) ? String(v) : v.toFixed(1)
  return p.unit === 'kg' ? `${n} kg` : p.unit === 'reps' ? `${n} reps` : `${n} s`
}

function Trend({ p }: { p: ExerciseProgress }) {
  if (p.points.length < 2) return <span className="trend trend--flat">new</span>
  if (p.change > 0) return <span className="trend trend--up">▲ {fmtValue(p, p.change)}</span>
  if (p.change < 0)
    return <span className="trend trend--down">▼ {fmtValue(p, Math.abs(p.change))}</span>
  return <span className="trend trend--flat">= same</span>
}

/** Past weeks of workouts (tap a day to open it) and per-exercise progress. */
export default function TrainHistory({
  days,
  onOpenDay,
}: {
  days: Record<string, DayData>
  /** Show a past day in the day card (to review, back-fill or edit sets) */
  onOpenDay: (date: string) => void
}) {
  const [view, setView] = useState<'history' | 'progress'>('history')
  const [weeksShown, setWeeksShown] = useState(WEEKS_PAGE)
  const [allProgress, setAllProgress] = useState(false)

  const history = useMemo(() => workoutHistory(days), [days])
  const progress = useMemo(() => exerciseProgress(days), [days])

  return (
    <section className="train-history" aria-label="History and progress">
      <div className="segmented" role="tablist" aria-label="History or progress">
        {(['history', 'progress'] as const).map(v => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            className={`segmented__btn${view === v ? ' active' : ''}`}
            onClick={() => setView(v)}
          >
            {v === 'history' ? 'History' : 'Progress'}
          </button>
        ))}
      </div>

      {view === 'history' &&
        (history.length === 0 ? (
          <div className="train-plan-hint">No workouts logged yet.</div>
        ) : (
          <>
            {history.slice(0, weeksShown).map(w => {
              const n = w.days.reduce(
                (sum, d) => sum + d.sessions.filter(countsAsWorkout).length,
                0,
              )
              return (
                <div key={w.week} className="history-week">
                  <div className="history-week__hdr">
                    Week of {fmtDate(w.week, { month: 'short', day: 'numeric' })}
                    <span className="text-muted">
                      {' '}
                      · {n} workout{n === 1 ? '' : 's'}
                    </span>
                  </div>
                  {w.days.map(d => {
                    const t = workoutTotals(d.sessions)
                    const sets = d.sessions.reduce(
                      (sum, s) => sum + loggedSummary(s.exercises ?? []).sets,
                      0,
                    )
                    return (
                      <button
                        key={d.date}
                        type="button"
                        className="history-day"
                        onClick={() => onOpenDay(d.date)}
                      >
                        <span className="history-day__date">
                          {fmtDate(d.date, { weekday: 'short' })} {Number(d.date.slice(8))}
                        </span>
                        <span className="history-day__what">
                          {d.sessions.map(workoutSessionLabel).join(' · ')}
                          <span className="history-day__meta">
                            {fmtMin(t.min)}
                            {t.kcal > 0 && ` · ${t.kcal} kcal`}
                            {sets > 0 && ` · ${sets} sets`}
                          </span>
                        </span>
                        <span className="history-day__go" aria-hidden="true">
                          ›
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })}
            {history.length > weeksShown && (
              <button
                type="button"
                className="ex-add-btn w-full"
                onClick={() => setWeeksShown(n => n + WEEKS_PAGE)}
              >
                Show {Math.min(WEEKS_PAGE, history.length - weeksShown)} more weeks
              </button>
            )}
          </>
        ))}

      {view === 'progress' &&
        (progress.length === 0 ? (
          <div className="train-plan-hint">
            Log sets with ▶ Start workout and each exercise's progress shows up here.
          </div>
        ) : (
          <>
            {(allProgress ? progress : progress.slice(0, PROGRESS_PAGE)).map(p => (
              <div key={p.name} className="progress-row">
                <div className="progress-row__main">
                  <span className="text-default font-500">{p.name}</span>
                  <span className="progress-row__range">
                    {p.points.length > 1
                      ? `${fmtValue(p, p.first.value)} → ${fmtValue(p, p.latest.value)}`
                      : fmtValue(p, p.latest.value)}
                  </span>
                  <Trend p={p} />
                </div>
                <div className="history-day__meta">
                  {p.points.length} workout{p.points.length === 1 ? '' : 's'} · best {p.best.set} ·
                  last {fmtDate(p.latest.date, { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
            {!allProgress && progress.length > PROGRESS_PAGE && (
              <button
                type="button"
                className="ex-add-btn w-full"
                onClick={() => setAllProgress(true)}
              >
                Show all {progress.length} exercises
              </button>
            )}
          </>
        ))}
    </section>
  )
}
