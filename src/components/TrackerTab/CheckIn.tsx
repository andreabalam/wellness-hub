import { useState, useCallback } from 'react'
import StarRow from './StarRow'
import { dkey } from './dateKey'
import { fetchOuraSleep, fetchOuraStress, sleepScoreToStars, stressToScale } from '../../lib/oura'

interface Props {
  /** Initial star values for the current day (the parent re-keys on date change). */
  initialEnergy: number
  initialMood: number
  initialSleep: number
  initialStress: number
  ouraConnected: boolean
  date: Date
  onSave: (patch: { energy: number; mood: number; sleep: number; stress: number }) => void
}

/**
 * Daily check-in: energy / mood / sleep / stress stars.
 * Sleep and stress auto-fill from Oura (best-effort, only when not already set manually).
 * Cycle phase has moved to WorkoutLog where it sits alongside training context.
 */
export default function CheckIn({
  initialEnergy,
  initialMood,
  initialSleep,
  initialStress,
  ouraConnected,
  date,
  onSave,
}: Props) {
  const [energy, setEnergy] = useState(initialEnergy)
  const [mood, setMood] = useState(initialMood)
  const [sleep, setSleep] = useState(initialSleep)
  const [stress, setStress] = useState(initialStress)
  const [checkInSaved, setCheckInSaved] = useState(false)

  // Auto-populate sleep stars from Oura when switching to check-in view
  const syncSleepFromOura = useCallback(async () => {
    if (!ouraConnected || sleep > 0) return // don't overwrite manually-set value
    try {
      const data = await fetchOuraSleep(dkey(date))
      if (data) setSleep(sleepScoreToStars(data.score))
    } catch {
      /* silent — sleep sync is best-effort */
    }
  }, [ouraConnected, sleep, date])

  // Auto-populate the stress scale from Oura daily_stress (same lazy pattern as sleep)
  const syncStressFromOura = useCallback(async () => {
    if (!ouraConnected || stress > 0) return // don't overwrite a manual/already-set value
    try {
      const data = await fetchOuraStress(dkey(date))
      const scaled = data && stressToScale(data)
      if (scaled) setStress(scaled)
    } catch {
      /* silent — stress sync is best-effort */
    }
  }, [ouraConnected, stress, date])

  const saveCheckIn = () => {
    onSave({ energy, mood, sleep, stress })
    setCheckInSaved(true)
    setTimeout(() => setCheckInSaved(false), 1600)
  }

  return (
    <div
      className="tcard"
      onFocus={() => {
        syncSleepFromOura()
        syncStressFromOura()
      }}
      onMouseEnter={() => {
        syncSleepFromOura()
        syncStressFromOura()
      }}
    >
      <div className="tlabel" style={{ color: 'var(--purple)' }}>
        Daily check-in
      </div>
      <div className="flex flex-col gap-12">
        <div>
          <div className="text-sm text-muted mb-6">Energy ⚡</div>
          <StarRow
            value={energy}
            onChange={setEnergy}
            emoji="E"
            lowLabel="Drained"
            highLabel="Peaked"
          />
        </div>
        <div>
          <div className="text-sm text-muted mb-6">Mood 😊</div>
          <StarRow value={mood} onChange={setMood} emoji="M" lowLabel="Low" highLabel="Bright" />
        </div>
        <div>
          <div className="text-sm text-muted mb-6">Sleep 🌙</div>
          <StarRow
            value={sleep}
            onChange={setSleep}
            emoji="Z"
            lowLabel="Poor"
            highLabel="Restorative"
          />
        </div>
        <div>
          <div className="text-sm text-muted mb-6">
            Stress 🧠
            {ouraConnected && (
              <span className="text-2xs text-muted2" style={{ marginLeft: 6 }}>
                auto from Oura · tap to override
              </span>
            )}
          </div>
          <StarRow
            value={stress}
            onChange={setStress}
            emoji="S"
            lowLabel="Calm"
            highLabel="Stressed"
          />
        </div>
        <button
          onClick={saveCheckIn}
          className={`tbtn ${checkInSaved ? 'tbtn--green' : 'tbtn--secondary'}`}
        >
          {checkInSaved ? 'Saved!' : 'Save check-in'}
        </button>
      </div>
    </div>
  )
}
