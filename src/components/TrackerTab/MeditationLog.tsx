import { useState } from 'react'
import { MED_MINS, MED_STYLES } from '../../data/tracker'
import { fetchOuraSessions, OURA_SESSION_MAP, roundToMedMin } from '../../lib/oura'
import { showToast } from '../../lib/toast'
import { reportError } from '../../lib/errorLog'
import { dkey } from './dateKey'

interface Props {
  /** Editable selection seed for the current day (parent re-keys on date change). */
  initialMedMin: number
  initialMedStyle: string
  /** Persisted values (reactive) for the "Done" summary line. */
  savedMedMin: number
  savedMedStyle: string
  ouraConnected: boolean
  date: Date
  onSave: (patch: { medMin: number; medStyle: string }) => void
}

/** Meditation logger: duration + style picker, with Oura session auto-fill. */
export default function MeditationLog({
  initialMedMin,
  initialMedStyle,
  savedMedMin,
  savedMedStyle,
  ouraConnected,
  date,
  onSave,
}: Props) {
  const [medMin, setMedMin] = useState(initialMedMin)
  const [medStyle, setMedStyle] = useState(initialMedStyle)
  const [medSaved, setMedSaved] = useState(initialMedMin > 0)
  const [medSyncing, setMedSyncing] = useState(false)
  const [ouraHRV, setOuraHRV] = useState<number | null>(null)
  const [ouraHR, setOuraHR] = useState<number | null>(null)
  const [ouraMood, setOuraMood] = useState<string | null>(null)
  const [ouraActualMin, setOuraActualMin] = useState<number | null>(null)

  const logMed = () => {
    if (!medMin) {
      alert('Select a duration first.')
      return
    }
    onSave({ medMin, medStyle })
    setMedSaved(true)
    setTimeout(() => setMedSaved(false), 1600)
  }

  const syncMedFromOura = async () => {
    setMedSyncing(true)
    try {
      const sessions = await fetchOuraSessions(dkey(date))
      const med = sessions.find(s => s.type !== 'nap')
      if (!med) {
        showToast('No meditation session found for this date in Oura.', 'info')
        return
      }
      const dSec =
        (new Date(med.end_datetime).getTime() - new Date(med.start_datetime).getTime()) / 1000
      setMedMin(roundToMedMin(dSec))
      if (OURA_SESSION_MAP[med.type]) setMedStyle(OURA_SESSION_MAP[med.type])
      setOuraHRV(med.average_hrv)
      setOuraHR(med.average_heart_rate)
      setOuraMood(med.mood)
      setOuraActualMin(Math.round(dSec / 60))
    } catch (err: unknown) {
      showToast(reportError('oura-sync:meditation', err), 'error')
    } finally {
      setMedSyncing(false)
    }
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

      {/* Oura meditation data badges */}
      {ouraHRV !== null && (
        <div className="flex flex-wrap gap-8 mb-10">
          <span className="oura-badge oura-badge--teal">HRV {ouraHRV}</span>
          {ouraHR !== null && <span className="oura-badge oura-badge--green">HR {ouraHR} bpm</span>}
          {ouraActualMin !== null && ouraActualMin !== medMin && (
            <span
              className="oura-badge oura-badge--muted"
              title={`Actual: ${ouraActualMin} min — rounded to nearest option`}
            >
              actual {ouraActualMin} min
            </span>
          )}
          {ouraMood && <span className="oura-badge oura-badge--purple">feeling: {ouraMood}</span>}
        </div>
      )}

      <div className="text-sm text-muted mb-10 lh-15">
        Optimal post-CAR window. Even 13 minutes measurably improves focus and working memory for
        hours.
      </div>
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
      {savedMedMin > 0 && (
        <div className="med-done">
          Done: {savedMedMin} min{savedMedStyle ? ` - ${savedMedStyle}` : ''}
        </div>
      )}
      <button onClick={logMed} className={`tbtn btn-gold ${medSaved ? 'saved' : ''}`}>
        {medSaved ? 'Saved!' : 'Log meditation'}
      </button>
    </div>
  )
}
