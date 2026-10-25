import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { SESSION_OPTS } from '../../data/tracker'
import type { DayData, WorkoutSession } from '../../data/tracker'
import { fetchOuraReadiness, readinessColor, readinessLabel } from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { dismissOuraSession, importOuraWorkouts } from '../../lib/ouraImport'
import { showToast } from '../../lib/toast'
import { reportError } from '../../lib/errorLog'
import { safeGet, safeSet } from '../../lib/storage'
import { WorkoutSessionList } from '../TrackerTab/SessionList'
import { dkey } from '../TrackerTab/dateKey'

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
  ouraConnected: boolean
  date: Date
  isToday: boolean
  /** Move the viewed day by ±1 (back-fill past days; never past today). */
  onShiftDate: (delta: -1 | 1) => void
  onSave: (patch: Partial<DayData>) => void
  /** Today's plan workout row, rendered under the readiness badge */
  children?: ReactNode
}

/**
 * The Train tab's day card: readiness, the day's plan workout (children),
 * every session logged or imported from Oura, a quick form for activity
 * outside the plan (walks, classes) and how-it-felt notes.
 */
export default function TrainDay({
  sessions,
  initialWkNotes,
  ouraConnected,
  date,
  isToday,
  onShiftDate,
  onSave,
  children,
}: Props) {
  const [otherOpen, setOtherOpen] = useState(false)
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
    setOtherOpen(false)
  }

  const removeSession = (s: WorkoutSession) => {
    if (s.src === 'oura') dismissOuraSession(dkey(date), s.id)
    saveSessions(sessions.filter(x => x.id !== s.id))
  }

  const saveNotes = () => onSave({ wkNotes })

  const dayLabel = date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="tcard train-day">
      <div className="train-day__hdr">
        <button
          type="button"
          className="date-nav-btn"
          onClick={() => onShiftDate(-1)}
          aria-label="Previous day"
        >
          ‹
        </button>
        <div className="train-day__date">
          <div className="tlabel" style={{ color: 'var(--coral)', marginBottom: 0 }}>
            {isToday ? 'Today' : 'Logging for'}
          </div>
          <div className="text-md font-500 text-default">{dayLabel}</div>
        </div>
        <button
          type="button"
          className="date-nav-btn"
          onClick={() => onShiftDate(1)}
          disabled={isToday}
          aria-label="Next day"
        >
          ›
        </button>
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

      {children}

      {/* The day's sessions: plan workouts, Oura imports, other activity */}
      <div className="text-sm text-muted mb-6">Activity</div>
      <WorkoutSessionList sessions={sessions} onRemove={removeSession} />

      {otherOpen ? (
        <div className="train-other">
          <div className="text-sm text-muted mb-8">Other activity (walk, class, sport):</div>
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
          <div className="flex gap-8 mb-10">
            <button onClick={logWorkout} className="tbtn tbtn--coral">
              + Log activity
            </button>
            <button onClick={() => setOtherOpen(false)} className="tbtn tbtn-ghost">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="ex-add-btn mb-10" onClick={() => setOtherOpen(true)}>
          ＋ Other activity
        </button>
      )}

      <textarea
        className="tinput resize-vertical"
        value={wkNotes}
        onChange={e => setWkNotes(e.target.value)}
        onBlur={saveNotes}
        placeholder="How did it feel? PRs? Modifications?"
        rows={2}
      />
    </div>
  )
}
