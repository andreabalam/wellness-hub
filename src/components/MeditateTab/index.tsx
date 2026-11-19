import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { DayData } from '../../data/tracker'
import { dayMedSessions } from '../../data/tracker'
import { trackerStore, useStoreRev } from '../../hooks/useStore'
import { isOuraConnected } from '../../lib/oura'
import { dkey } from '../../lib/dateKey'
import { DayHeader } from '../common'
import MeditationLog from '../TrackerTab/MeditationLog'
import MeditationGuides from '../TrackerTab/MeditationGuides'

interface Props {
  user: User | null
  /** Day shared with Today and Food */
  date: Date
  onDateChange: (d: Date) => void
}

/** Meditation: the day's sessions (with Oura import) and favourite guides. The week shows on Today's strip. */
export default function MeditateTab({ user, date, onDateChange }: Props) {
  const rev = useStoreRev() // re-read after logging or a background Oura import
  const [ouraConnected, setOuraConnected] = useState(false)

  useEffect(() => {
    if (!user) return
    isOuraConnected()
      .then(setOuraConnected)
      .catch(() => {})
  }, [user])

  if (!user) {
    return (
      <div className="guest-gate-cta">
        <div className="guest-gate-cta__icon">🔒</div>
        <div className="section-title mb-8">
          Sign in to use <em className="text-teal">Meditate</em>
        </div>
        <div className="guest-gate-cta__body">
          Log meditation sessions (or import them from Oura) and keep your favourite guides. Your
          data stays private and syncs across devices.
        </div>
      </div>
    )
  }

  const key = dkey(date)
  void rev
  const day = trackerStore.getDay(key)
  const save = (patch: Partial<DayData>) =>
    trackerStore.setDay(key, { ...trackerStore.getDay(key), ...patch })
  const select = (d: Date) => {
    d.setHours(0, 0, 0, 0)
    onDateChange(d)
  }

  return (
    <>
      <DayHeader date={date} onDateChange={select} />
      <div className="flex flex-col gap-12">
        {/* Keyed by date so its inputs re-seed on day change */}
        <MeditationLog
          key={`med-${key}`}
          sessions={dayMedSessions(day)}
          ouraConnected={ouraConnected}
          date={date}
          onSave={save}
        />
        <MeditationGuides />
      </div>
    </>
  )
}
