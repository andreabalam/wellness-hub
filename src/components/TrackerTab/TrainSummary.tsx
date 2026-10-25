import type { WorkoutSession } from '../../data/tracker'
import { fmtMin, workoutSessionLabel, workoutTotals } from '../../data/tracker'
import { loggedSummary } from '../../lib/workoutLog'

/** One-line read-only view of the day's workouts; logging lives in the Train tab. */
export default function TrainSummary({
  sessions,
  onOpenTrain,
}: {
  sessions: WorkoutSession[]
  onOpenTrain: () => void
}) {
  const t = workoutTotals(sessions)
  const sets = sessions.reduce((n, s) => n + loggedSummary(s.exercises ?? []).sets, 0)
  return (
    <div className="tcard train-summary">
      <div className="flex-1" style={{ minWidth: 0 }}>
        <div className="tlabel" style={{ color: 'var(--coral)', marginBottom: 2 }}>
          Workout
        </div>
        <div className="text-base text-default">
          {sessions.length ? sessions.map(workoutSessionLabel).join(' · ') : 'Nothing logged'}
        </div>
        {sessions.length > 0 && (
          <div className="food-log-meta">
            {fmtMin(t.min)}
            {t.kcal > 0 && ` · ${t.kcal} kcal`}
            {sets > 0 && ` · ${sets} sets`}
          </div>
        )}
      </div>
      <button type="button" className="btn btn--sm btn--ghost" onClick={onOpenTrain}>
        Open Train →
      </button>
    </div>
  )
}
