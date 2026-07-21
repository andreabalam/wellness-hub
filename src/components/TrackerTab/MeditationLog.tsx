import { useState, useEffect, useRef } from 'react'
import { MED_MINS, MED_STYLES } from '../../data/tracker'
import type { DayData, MedSession } from '../../data/tracker'
import { dismissOuraSession, importOuraMeditations } from '../../lib/ouraImport'
import { showToast } from '../../lib/toast'
import { reportError } from '../../lib/errorLog'
import { MedSessionList } from './SessionList'
import { dkey } from './dateKey'

interface Props {
  /** Persisted sessions for the day (reactive; legacy days pre-synthesized by the parent). */
  sessions: MedSession[]
  ouraConnected: boolean
  date: Date
  onSave: (patch: Partial<DayData>) => void
}

/** Meditation logger: session list + duration/style entry, with Oura auto-import. */
export default function MeditationLog({ sessions, ouraConnected, date, onSave }: Props) {
  const [medMin, setMedMin] = useState(0)
  const [medStyle, setMedStyle] = useState('')
  const [medSaved, setMedSaved] = useState(false)
  const [medSyncing, setMedSyncing] = useState(false)

  const sessionsRef = useRef(sessions)
  useEffect(() => {
    sessionsRef.current = sessions
  }, [sessions])

  /** Persist a new session list, mirroring the first session into the legacy slot. */
  const saveSessions = (next: MedSession[]) => {
    onSave({
      medSessions: next,
      medMin: next[0]?.min ?? 0,
      medStyle: next[0]?.style ?? '',
    })
  }

  // Silent Oura auto-import (policy-gated inside importOuraMeditations)
  useEffect(() => {
    if (!ouraConnected) return
    let cancelled = false
    importOuraMeditations(dkey(date), sessionsRef.current)
      .then(merged => {
        if (cancelled || !merged) return
        const added = merged.length - sessionsRef.current.length
        onSave({
          medSessions: merged,
          medMin: merged[0]?.min ?? 0,
          medStyle: merged[0]?.style ?? '',
        })
        if (added > 0)
          showToast(
            `${added} meditation session${added === 1 ? '' : 's'} imported from Oura`,
            'info',
          )
      })
      .catch(() => {}) // silent — manual sync surfaces errors
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, ouraConnected])

  const syncMedFromOura = async () => {
    setMedSyncing(true)
    try {
      const merged = await importOuraMeditations(dkey(date), sessions, true)
      if (!merged) {
        showToast('No new meditation sessions found in Oura.', 'info')
        return
      }
      const added = merged.length - sessions.length
      saveSessions(merged)
      showToast(
        added > 0
          ? `${added} meditation session${added === 1 ? '' : 's'} imported from Oura`
          : 'Oura sessions updated',
        'info',
      )
    } catch (err: unknown) {
      showToast(reportError('oura-sync:meditation', err), 'error')
    } finally {
      setMedSyncing(false)
    }
  }

  const logMed = () => {
    if (!medMin) {
      alert('Select a duration first.')
      return
    }
    const entry: MedSession = {
      id: `manual-${Date.now()}`,
      src: 'manual',
      min: medMin,
      style: medStyle,
    }
    saveSessions([...sessions, entry])
    setMedSaved(true)
    setMedMin(0)
    setMedStyle('')
    setTimeout(() => setMedSaved(false), 1600)
  }

  const removeSession = (s: MedSession) => {
    if (s.src === 'oura') dismissOuraSession(dkey(date), s.id)
    saveSessions(sessions.filter(x => x.id !== s.id))
  }

  return (
    <div className="tcard">
      <div className="flex-between mb-6">
        <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>
          Meditation · 8:45 AM
        </div>
        {ouraConnected && (
          <button
            onClick={syncMedFromOura}
            disabled={medSyncing}
            className={`oura-sync-btn oura-sync-btn--gold ${medSyncing ? 'loading' : ''}`}
          >
            {medSyncing ? 'Syncing…' : '⟳ Sync Oura'}
          </button>
        )}
      </div>

      <div className="text-sm text-muted mb-10 lh-15">
        Optimal post-CAR window. Even 13 minutes measurably improves focus and working memory for
        hours.
      </div>

      {/* Today's sessions */}
      <div className="text-sm text-muted mb-6">Today's sessions:</div>
      <MedSessionList sessions={sessions} onRemove={removeSession} />

      <div className="text-sm text-muted mb-6">Duration:</div>
      <div className="flex flex-wrap gap-6 mb-10">
        {MED_MINS.map(m => (
          <button
            key={m}
            onClick={() => setMedMin(medMin === m ? 0 : m)}
            className={`med-min-btn ${medMin === m ? 'active' : ''}`}
          >
            {m} min
          </button>
        ))}
      </div>
      <div className="text-sm text-muted mb-6">Style:</div>
      <div className="flex flex-wrap gap-6 mb-10">
        {MED_STYLES.map(s => (
          <button
            key={s}
            onClick={() => setMedStyle(medStyle === s ? '' : s)}
            className={`med-style-btn ${medStyle === s ? 'active' : ''}`}
          >
            {s}
          </button>
        ))}
      </div>
      <button onClick={logMed} className={`tbtn btn-gold ${medSaved ? 'saved' : ''}`}>
        {medSaved ? 'Saved!' : 'Log meditation'}
      </button>
    </div>
  )
}
