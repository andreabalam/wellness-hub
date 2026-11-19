import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import type { DayData } from '../../data/tracker'
import { dayMedSessions, fmtMin, medTotals } from '../../data/tracker'
import { trackerStore, useStoreRev } from '../../hooks/useStore'
import { isOuraConnected } from '../../lib/oura'
import { dkey, fromKey, mondayOf, addDays } from '../../lib/dateKey'
import { DayHeader } from '../common'
import MeditationLog from '../TrackerTab/MeditationLog'
import MeditationGuides from '../TrackerTab/MeditationGuides'

interface Props {
  user: User | null
  /** Day shared with Today and Food */
  date: Date
  onDateChange: (d: Date) => void
}

const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** Minutes meditated each day of the viewed week, plus the week total. */
function MeditationWeek({ date, onSelect }: { date: Date; onSelect: (d: Date) => void }) {
  const monday = mondayOf(date)
  const days = DL.map((lbl, i) => {
    const d = addDays(monday, i)
    const key = dkey(d)
    return { lbl, d, key, min: medTotals(dayMedSessions(trackerStore.getDay(key))).min }
  })
  const total = days.reduce((s, d) => s + d.min, 0)
  const active = days.filter(d => d.min > 0).length
  const todayKey = dkey(new Date())
  const viewed = dkey(date)
  return (
    <div className="tcard">
      <div className="week-strip-header">
        {active > 0
          ? `This week · ${active} day${active === 1 ? '' : 's'} · ${fmtMin(total)}`
          : 'This week'}
      </div>
      <div className="week-strip-grid">
        {days.map(({ lbl, d, key, min }) => (
          <button
            key={key}
            type="button"
            aria-label={`${lbl} ${d.getDate()}: ${min ? `${min} min` : 'none'}${key === viewed ? ', selected' : ''}`}
            aria-current={key === viewed ? 'date' : undefined}
            onClick={() => onSelect(fromKey(key))}
            className={`week-strip-cell ${key === viewed ? 'week-strip-cell--cur' : key === todayKey ? 'week-strip-cell--today' : ''}`}
          >
            <div className={`font-mono ${key === todayKey ? 'text-teal' : 'text-muted2'}`}>
              {lbl}
            </div>
            <div className="text-muted2">{d.getDate()}</div>
            <div className={`font-mono ${min ? 'text-gold' : 'text-muted2'}`}>
              {min ? `${min}′` : '-'}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Meditation: the day's sessions (with Oura import), the week, and favourite guides. */
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
          Log meditation sessions (or import them from Oura), see your week and keep your favourite
          guides. Your data stays private and syncs across devices.
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
        <MeditationWeek key={`mw-${rev}`} date={date} onSelect={select} />
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
