import type { WorkoutSession } from '../../data/tracker'
import { fmtMin, workoutSessionLabel, workoutTotals } from '../../data/tracker'
import { loggedSummary } from '../../lib/workoutLog'

/** "10:42 AM" today, "Oct 24, 10:42 AM" otherwise. */
function fmtSynced(ms: number): string {
  const d = new Date(ms)
  const sameDay = d.toDateString() === new Date().toDateString()
  return d.toLocaleString('en-US', {
    ...(!sameDay && { month: 'short', day: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** One-line read-only view of the day's workouts; logging lives in the Train tab. */
export default function TrainSummary({
  sessions,
  onOpenTrain,
  oura,
}: {
  sessions: WorkoutSession[]
  onOpenTrain: () => void
  /** Present when Oura is connected: when this day last synced, and a manual sync */
  oura?: { lastSynced: number | null; syncing: boolean; onSync: () => void }
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
        {oura && (
          <div className="train-summary__oura">
            <span className="text-muted2">
              {oura.syncing
                ? 'Syncing Oura…'
                : oura.lastSynced
                  ? `Oura synced ${fmtSynced(oura.lastSynced)}`
                  : 'Not synced from Oura yet'}
            </span>
            <button
              type="button"
              className="train-summary__sync"
              onClick={oura.onSync}
              disabled={oura.syncing}
              aria-label="Sync workouts from Oura"
            >
              ⟳ Sync
            </button>
          </div>
        )}
      </div>
      <button type="button" className="btn btn--sm btn--ghost" onClick={onOpenTrain}>
        Open Train →
      </button>
    </div>
  )
}
