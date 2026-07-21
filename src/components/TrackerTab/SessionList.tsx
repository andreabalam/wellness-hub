import type { MedSession, WorkoutSession } from '../../data/tracker'
import { fmtMin, medTotals, workoutSessionLabel, workoutTotals } from '../../data/tracker'

/** Source chip: Oura ring vs manual entry. */
function SrcChip({ src }: { src: 'oura' | 'manual' }) {
  return (
    <span
      className={`session-src-chip ${src === 'oura' ? 'session-src-chip--oura' : ''}`}
      title={src === 'oura' ? 'Imported from Oura' : 'Logged manually'}
    >
      {src === 'oura' ? '◎ Oura' : '✎ manual'}
    </span>
  )
}

/** The day's workout sessions with per-session meta + totals footer. */
export function WorkoutSessionList({
  sessions,
  onRemove,
}: {
  sessions: WorkoutSession[]
  onRemove: (s: WorkoutSession) => void
}) {
  if (sessions.length === 0) {
    return (
      <div className="text-base text-muted2 italic mb-10" style={{ padding: '3px 0' }}>
        No workouts yet today.
      </div>
    )
  }
  const t = workoutTotals(sessions)
  return (
    <div className="mb-10">
      {sessions.map(s => (
        <div key={s.id} className="food-log-item">
          <div className="flex-1">
            <div className="text-base text-default">
              {workoutSessionLabel(s)} <SrcChip src={s.src} />
            </div>
            <div className="food-log-meta">
              {s.min > 0 ? fmtMin(s.min) : '—'}
              {s.kcal ? ` · ${s.kcal} kcal` : ''}
              {s.avgHr ? ` · ${s.avgHr} bpm avg` : ''}
              {s.maxHr ? ` · ${s.maxHr} bpm max` : ''}
              {s.note ? ` · ${s.note}` : ''}
            </div>
          </div>
          <button onClick={() => onRemove(s)} className="food-remove-btn" title="Remove session">
            ×
          </button>
        </div>
      ))}
      <div className="session-totals text-coral">
        {t.sessions} session{t.sessions === 1 ? '' : 's'} · {fmtMin(t.min)}
        {t.kcal > 0 ? ` · ${t.kcal.toLocaleString()} kcal burned` : ''}
      </div>
    </div>
  )
}

/** The day's meditation sessions with persisted Oura chips + totals footer. */
export function MedSessionList({
  sessions,
  onRemove,
}: {
  sessions: MedSession[]
  onRemove: (s: MedSession) => void
}) {
  if (sessions.length === 0) {
    return (
      <div className="text-base text-muted2 italic mb-10" style={{ padding: '3px 0' }}>
        No meditation yet today.
      </div>
    )
  }
  const t = medTotals(sessions)
  return (
    <div className="mb-10">
      {sessions.map(s => (
        <div key={s.id} className="food-log-item">
          <div className="flex-1">
            <div className="text-base text-default">
              {s.min} min{s.style ? ` · ${s.style}` : ''} <SrcChip src={s.src} />
            </div>
            {(s.hrv != null || s.hr != null || s.mood) && (
              <div className="flex flex-wrap gap-6" style={{ marginTop: 3 }}>
                {s.hrv != null && <span className="oura-badge oura-badge--teal">HRV {s.hrv}</span>}
                {s.hr != null && (
                  <span className="oura-badge oura-badge--green">HR {s.hr} bpm</span>
                )}
                {s.mood && <span className="oura-badge oura-badge--purple">feeling: {s.mood}</span>}
              </div>
            )}
          </div>
          <button onClick={() => onRemove(s)} className="food-remove-btn" title="Remove session">
            ×
          </button>
        </div>
      ))}
      <div className="session-totals text-gold">
        Total today: {fmtMin(t.min)} · {t.sessions} session{t.sessions === 1 ? '' : 's'}
      </div>
    </div>
  )
}
