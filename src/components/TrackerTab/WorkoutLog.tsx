import { useState, useEffect, useRef } from 'react'
import { SESSION_OPTS } from '../../data/tracker'
import type { DayData, WorkoutSession } from '../../data/tracker'
import { fetchOuraReadiness, readinessColor, readinessLabel } from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { dismissOuraSession, importOuraWorkouts } from '../../lib/ouraImport'
import type { PhaseSuggestion } from '../../lib/cyclePhase'
import { showToast } from '../../lib/toast'
import { reportError } from '../../lib/errorLog'
import { safeGet, safeSet } from '../../lib/storage'
import { WorkoutSessionList } from './SessionList'
import { dkey } from './dateKey'

const PHASES = ['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'Unsure'] as const
const PHASE_COLORS = [
  'var(--purple)',
  'var(--green)',
  'var(--teal)',
  'var(--amber)',
  'var(--muted2)',
]

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
  /** Persisted sessions for the day (reactive; legacy days pre-synthesized by the parent). */
  sessions: WorkoutSession[]
  initialWkNotes: string
  phaseNote: string
  phase: string
  /** Estimated phase shown as a ghost suggestion when no phase is set. */
  suggestedPhase: PhaseSuggestion | null
  onPhaseChange: (p: string) => void
  ouraConnected: boolean
  date: Date
  onSave: (patch: Partial<DayData>) => void
}

/** Workout logger: session list + type/minutes/kcal entry, Oura readiness + auto-import. */
export default function WorkoutLog({
  sessions,
  initialWkNotes,
  phaseNote,
  phase,
  suggestedPhase,
  onPhaseChange,
  ouraConnected,
  date,
  onSave,
}: Props) {
  const [selSession, setSess] = useState<string | null>(null)
  const [wkMin, setWkMin] = useState('30')
  const [wkKcal, setWkKcal] = useState('')
  const [wkNotes, setWkNotes] = useState(initialWkNotes)
  const [readiness, setReadiness] = useState<OuraReadiness | null>(null)
  const [wkSyncing, setWkSyncing] = useState(false)

  // Latest sessions for the auto-import effect without re-triggering it.
  const sessionsRef = useRef(sessions)
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  /** Persist a new session list, mirroring the first session into the legacy slot. */
  const saveSessions = (next: WorkoutSession[]) => {
    onSave({ wkSessions: next, workout: next[0]?.type ?? null })
  }

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

  // Silent Oura auto-import (policy-gated inside importOuraWorkouts)
  useEffect(() => {
    if (!ouraConnected) return
    let cancelled = false
    importOuraWorkouts(dkey(date), sessionsRef.current)
      .then(merged => {
        if (cancelled || !merged) return
        const added = merged.length - sessionsRef.current.length
        onSave({ wkSessions: merged, workout: merged[0]?.type ?? null })
        if (added > 0)
          showToast(`${added} workout${added === 1 ? '' : 's'} imported from Oura`, 'info')
      })
      .catch(() => {}) // silent — manual sync surfaces errors
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, ouraConnected])

  const syncWorkoutFromOura = async () => {
    setWkSyncing(true)
    try {
      const dateStr = dkey(date)
      const [merged, readinessData] = await Promise.all([
        importOuraWorkouts(dateStr, sessions, true),
        fetchOuraReadiness(dateStr),
      ])
      if (readinessData) {
        setCachedReadiness(dateStr, readinessData)
        setReadiness(readinessData)
      }
      if (merged) {
        const added = merged.length - sessions.length
        saveSessions(merged)
        showToast(
          added > 0
            ? `${added} workout${added === 1 ? '' : 's'} imported from Oura`
            : 'Oura workouts updated',
          'info',
        )
      } else if (!readinessData) {
        showToast('No Oura data found for this date.', 'info')
      }
    } catch (err: unknown) {
      showToast(reportError('oura-sync:workout', err), 'error')
    } finally {
      setWkSyncing(false)
    }
  }

  const logWorkout = () => {
    if (!selSession) {
      alert('Select a session type first.')
      return
    }
    const min = Math.max(0, parseInt(wkMin) || 0)
    const kcal = Math.max(0, parseInt(wkKcal) || 0)
    const entry: WorkoutSession = {
      id: `manual-${Date.now()}`,
      src: 'manual',
      type: selSession,
      min,
      ...(kcal > 0 && { kcal }),
    }
    onSave({ wkSessions: [...sessions, entry], workout: sessions[0]?.type ?? selSession, wkNotes })
    setSess(null)
    setWkKcal('')
  }

  const removeSession = (s: WorkoutSession) => {
    if (s.src === 'oura') dismissOuraSession(dkey(date), s.id)
    saveSessions(sessions.filter(x => x.id !== s.id))
  }

  const saveNotes = () => onSave({ wkNotes })

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

      <div className="mb-10">
        <div className="text-sm text-muted mb-6">
          Cycle phase
          {!phase && suggestedPhase && (
            <span className="text-muted2 text-2xs" style={{ marginLeft: 6 }}>
              · from {suggestedPhase.source === 'oura-tag' ? 'Oura' : 'history'} (estimated, day{' '}
              {suggestedPhase.cycleDay})
            </span>
          )}
        </div>
        <div className="flex gap-6 flex-wrap">
          {PHASES.map((p, i) => {
            const active = phase === p
            const ghost = !phase && suggestedPhase?.phase === p
            return (
              <button
                key={p}
                onClick={() => onPhaseChange(active ? '' : p)}
                className="phase-btn"
                style={{
                  border: `1px ${ghost ? 'dashed' : 'solid'} ${active || ghost ? PHASE_COLORS[i] : 'var(--border)'}`,
                  background: active ? `${PHASE_COLORS[i]}20` : 'var(--bg3)',
                  color: active || ghost ? PHASE_COLORS[i] : 'var(--muted)',
                }}
              >
                {p}
              </button>
            )
          })}
        </div>
      </div>
      <div className="phase-note">
        {phase
          ? phaseNote
          : suggestedPhase
            ? `Estimated ${suggestedPhase.phase.toLowerCase()} — tap to confirm or correct.`
            : phaseNote}
      </div>

      {/* Today's sessions */}
      <div className="text-sm text-muted mb-6">Today's sessions:</div>
      <WorkoutSessionList sessions={sessions} onRemove={removeSession} />

      <div className="text-sm text-muted mb-8">Log a session:</div>
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
      <div className="flex gap-8 mb-10 items-center flex-wrap">
        <label className="session-num-label">
          <input
            type="number"
            min={0}
            max={600}
            value={wkMin}
            onChange={e => setWkMin(e.target.value)}
            className="tinput session-num-input"
          />
          min
        </label>
        <label className="session-num-label">
          <input
            type="number"
            min={0}
            max={5000}
            value={wkKcal}
            onChange={e => setWkKcal(e.target.value)}
            placeholder="—"
            className="tinput session-num-input"
          />
          kcal (optional)
        </label>
      </div>
      <textarea
        className="tinput resize-vertical mb-8"
        value={wkNotes}
        onChange={e => setWkNotes(e.target.value)}
        onBlur={saveNotes}
        placeholder="How did it feel? PRs? Modifications?"
        rows={3}
      />
      <button onClick={logWorkout} className="tbtn tbtn--coral">
        + Log workout
      </button>
    </div>
  )
}
