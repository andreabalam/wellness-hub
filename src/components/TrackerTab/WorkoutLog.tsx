import { useState, useEffect } from 'react'
import { SESSION_OPTS } from '../../data/tracker'
import {
  fetchOuraWorkouts,
  fetchOuraReadiness,
  OURA_ACTIVITY_MAP,
  readinessColor,
  readinessLabel,
} from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { showToast } from '../../lib/toast'
import { reportError } from '../../lib/errorLog'
import { safeGet, safeSet } from '../../lib/storage'
import { dkey } from './dateKey'

// ── Oura readiness cache (one entry per date) ─────────────────────
const READINESS_CACHE_KEY = 'whub_oura_readiness_v1'
function getCachedReadiness(date: string): OuraReadiness | null {
  return safeGet<Record<string, OuraReadiness>>(READINESS_CACHE_KEY, {})[date] ?? null
}
function setCachedReadiness(date: string, data: OuraReadiness): void {
  const all = safeGet<Record<string, OuraReadiness>>(READINESS_CACHE_KEY, {})
  all[date] = data
  safeSet(READINESS_CACHE_KEY, all)
}

interface Props {
  /** Editable seed for the current day (parent re-keys on date change). */
  initialSession: string | null
  initialWkNotes: string
  /** Persisted values (reactive) for the "Session logged" summary. */
  savedWorkout: string | null
  savedWkNotes: string
  phaseNote: string
  ouraConnected: boolean
  date: Date
  onSave: (patch: { workout: string | null; wkNotes: string }) => void
}

/** Workout logger: session-type picker + notes, with Oura readiness + sync. */
export default function WorkoutLog({
  initialSession,
  initialWkNotes,
  savedWorkout,
  savedWkNotes,
  phaseNote,
  ouraConnected,
  date,
  onSave,
}: Props) {
  const [selSession, setSess] = useState<string | null>(initialSession)
  const [wkNotes, setWkNotes] = useState(initialWkNotes)
  const [wkSaved, setWkSaved] = useState(!!initialSession)
  const [readiness, setReadiness] = useState<OuraReadiness | null>(null)
  const [wkSyncing, setWkSyncing] = useState(false)

  // Load readiness from cache; auto-fetch from Oura if not cached
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const dateStr = dkey(date)
    const cached = getCachedReadiness(dateStr)
    if (cached) {
      setReadiness(cached)
    } else if (ouraConnected) {
      fetchOuraReadiness(dateStr)
        .then(data => {
          if (data) {
            setCachedReadiness(dateStr, data)
            setReadiness(data)
          }
        })
        .catch(() => {})
    }
  }, [date, ouraConnected])
  /* eslint-enable react-hooks/set-state-in-effect */

  const logWorkout = () => {
    if (!selSession) {
      alert('Select a session type first.')
      return
    }
    onSave({ workout: selSession, wkNotes })
    setWkSaved(true)
  }

  const syncWorkoutFromOura = async () => {
    setWkSyncing(true)
    try {
      const dateStr = dkey(date)
      const [workouts, readinessData] = await Promise.all([
        fetchOuraWorkouts(dateStr),
        fetchOuraReadiness(dateStr),
      ])
      if (readinessData) {
        setCachedReadiness(dateStr, readinessData)
        setReadiness(readinessData)
      }
      if (workouts.length === 0) {
        if (!readinessData) showToast('No Oura data found for this date.', 'info')
        return
      }
      const w = workouts[0]
      const mapped = OURA_ACTIVITY_MAP[w.activity] ?? null
      if (mapped) setSess(mapped)
      const dMin = Math.round(
        (new Date(w.end_datetime).getTime() - new Date(w.start_datetime).getTime()) / 60000,
      )
      const hrNote = w.average_heart_rate ? ` · avg HR ${w.average_heart_rate} bpm` : ''
      setWkNotes(`Oura: ${w.activity.replace(/_/g, ' ')} · ${dMin} min${hrNote}`)
    } catch (err: unknown) {
      showToast(reportError('oura-sync:workout', err), 'error')
    } finally {
      setWkSyncing(false)
    }
  }

  return (
    <div className="tcard">
      <div className="flex-between mb-6">
        <div className="tlabel" style={{ color: 'var(--coral)', marginBottom: 0 }}>
          Workout log · 4:30 PM
        </div>
        {ouraConnected && (
          <button
            onClick={syncWorkoutFromOura}
            disabled={wkSyncing}
            className={`oura-sync-btn oura-sync-btn--teal ${wkSyncing ? 'loading' : ''}`}
          >
            {wkSyncing ? 'Syncing…' : '⟳ Sync Oura'}
          </button>
        )}
      </div>

      {/* Readiness badge */}
      {readiness && (
        <div
          className="readiness-badge"
          style={{ border: `1px solid ${readinessColor(readiness.score)}40` }}
        >
          <div
            className="readiness-score flex-center"
            style={{
              background: `${readinessColor(readiness.score)}20`,
              border: `2px solid ${readinessColor(readiness.score)}`,
              color: readinessColor(readiness.score),
            }}
          >
            {readiness.score}
          </div>
          <div>
            <div className="text-sm font-600" style={{ color: readinessColor(readiness.score) }}>
              {readinessLabel(readiness.score)}
            </div>
            <div className="font-mono text-muted2 text-2xs">
              HRV balance {readiness.contributors.hrv_balance} · Recovery{' '}
              {readiness.contributors.recovery_index}
            </div>
          </div>
        </div>
      )}

      <div className="phase-note">{phaseNote}</div>
      <div className="text-sm text-muted mb-8">Session type:</div>
      <div className="flex flex-wrap gap-6 mb-10">
        {SESSION_OPTS.map(s => (
          <button
            key={s.id}
            onClick={() => setSess(selSession === s.id ? null : s.id)}
            className="session-type-btn"
            style={{
              border: `1px solid ${selSession === s.id ? s.color : 'var(--border)'}`,
              background: selSession === s.id ? `${s.color}20` : 'var(--bg3)',
              color: selSession === s.id ? s.color : 'var(--muted)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      {wkSaved && savedWorkout && (
        <div className="workout-saved">
          <div className="text-base text-green font-500 mb-4">✓ Session logged</div>
          <div className="text-sm text-muted">
            {SESSION_OPTS.find(s => s.id === savedWorkout)?.label ?? savedWorkout}
            {savedWkNotes ? ` - ${savedWkNotes.substring(0, 70)}` : ''}
          </div>
        </div>
      )}
      <textarea
        className="tinput resize-vertical mb-8"
        value={wkNotes}
        onChange={e => setWkNotes(e.target.value)}
        placeholder="How did it feel? PRs? Modifications?"
        rows={3}
      />
      <button onClick={logWorkout} className="tbtn tbtn--coral">
        + Log workout
      </button>
    </div>
  )
}
