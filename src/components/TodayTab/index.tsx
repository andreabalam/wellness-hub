import { useEffect, useState, lazy, Suspense } from 'react'
import type { User } from '@supabase/supabase-js'
import type { DayData } from '../../data/tracker'
import { dayWorkoutSessions } from '../../data/tracker'
import { bodyStatsStore, trackerStore, useStoreRev } from '../../hooks/useStore'
import { useOuraWorkoutSync } from '../../hooks/useOuraWorkoutSync'
import { fetchOuraReadiness, isOuraConnected } from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { safeGet, safeSet } from '../../lib/storage'
import { significantBurnKcal } from '../../lib/stats'
import { workoutWeekStats } from '../../lib/workoutWeeks'
import { dkey } from '../../lib/dateKey'
import WeekStrip from '../TrackerTab/WeekStrip'
import WeekActivitySummary from '../TrackerTab/WeekActivitySummary'
import TrainSummary from '../TrackerTab/TrainSummary'
import RemindersSection from '../TrackerTab/RemindersSection'
import DayTimeline, { dayKeyOf } from './DayTimeline'
import FoodCard from './FoodCard'
import { READINESS_CACHE_KEY } from '../../lib/storageKeys'
import { DayHeader, Sheet } from '../common'

// Full Schedule (editor, .ics export, cognitive peak) — opened from the timeline
const ScheduleTab = lazy(() => import('../ScheduleTab'))

/** Free-text notes for the day — keyed by date by the parent so it re-seeds. */
function DayNotes({ initial, onSave }: { initial: string; onSave: (notes: string) => void }) {
  const [notes, setNotes] = useState(initial)
  const [saved, setSaved] = useState(false)
  return (
    <div className="tcard">
      <div className="tlabel text-muted2">Day notes</div>
      <textarea
        className="tinput resize-vertical mb-8"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Cravings, how the workout felt, anything worth noting..."
        rows={3}
      />
      <button
        onClick={() => {
          onSave(notes)
          setSaved(true)
          setTimeout(() => setSaved(false), 1600)
        }}
        className={`tbtn tbtn-ghost ${saved ? 'saved' : ''}`}
      >
        {saved ? 'Saved!' : 'Save notes'}
      </button>
    </div>
  )
}

interface Props {
  user: User | null
  /** Viewed day, shared with the Food tab */
  date: Date
  onDateChange: (d: Date) => void
  onOpenFood: () => void
  onOpenTrain: () => void
}

/**
 * Home screen: everything for one day at a glance — food and workout (with
 * readiness and the week streak) summaries, reminders, the Schedule timeline
 * and notes. Meditation has its own tab; Profile & targets lives in the user menu.
 */
export default function TodayTab({ user, date, onDateChange, onOpenFood, onOpenTrain }: Props) {
  // Bumped on any tracker / profile write (this tab, Train, background Oura import)
  const rev = useStoreRev()
  // Bumped when the Schedule sheet closes so the timeline re-reads edited blocks
  const [scheduleRev, setScheduleRev] = useState(0)
  const [ouraConnected, setOuraConnected] = useState(false)
  const [sheet, setSheet] = useState<'schedule' | null>(null)
  const [readiness, setReadiness] = useState<Record<string, OuraReadiness>>(() =>
    safeGet<Record<string, OuraReadiness>>(READINESS_CACHE_KEY, {}),
  )

  const key = dkey(date)
  const isToday = key === dkey(new Date())

  useEffect(() => {
    isOuraConnected()
      .then(setOuraConnected)
      .catch(() => {})
  }, [])

  // Readiness for the viewed day: cached, else fetched once when connected
  useEffect(() => {
    if (!ouraConnected || readiness[key]) return
    fetchOuraReadiness(key)
      .then(r => {
        if (!r) return
        const all = { ...safeGet<Record<string, OuraReadiness>>(READINESS_CACHE_KEY, {}), [key]: r }
        safeSet(READINESS_CACHE_KEY, all)
        setReadiness(all)
      })
      .catch(() => {})
  }, [key, ouraConnected, readiness])

  const stats = bodyStatsStore.get()
  const wkSync = useOuraWorkoutSync(key, ouraConnected)

  const { day, streak } = (() => {
    void rev
    return {
      day: trackerStore.getDay(key),
      streak: workoutWeekStats(trackerStore.getAll(), new Date()).currentStreak,
    }
  })()

  const save = (patch: Partial<DayData>) => {
    trackerStore.setDay(key, { ...trackerStore.getDay(key), ...patch })
  }

  if (!user) {
    return (
      <div className="guest-gate-cta">
        <div className="guest-gate-cta__icon">🔒</div>
        <div className="section-title mb-8">
          Sign in to see <em className="text-teal">Today</em>
        </div>
        <div className="guest-gate-cta__body">
          Your day at a glance: food, workout, reminders and schedule. Your data stays private and
          syncs across devices.
        </div>
      </div>
    )
  }

  const r = readiness[key]

  return (
    <>
      <DayHeader date={date} onDateChange={onDateChange} />

      <WeekStrip
        key={`strip-${rev}`}
        currentDate={date}
        onSelect={d => {
          d.setHours(0, 0, 0, 0)
          onDateChange(d)
        }}
        getDay={trackerStore.getDay}
        burnThreshold={significantBurnKcal(stats.tdeeKcal || 0)}
      />

      {/* Week workout roll-up (hidden when the week is empty) */}
      <WeekActivitySummary key={`was-${rev}`} currentDate={date} getDay={trackerStore.getDay} />

      <div className="flex flex-col gap-12">
        <FoodCard day={day} onOpenFood={onOpenFood} />
        <TrainSummary
          sessions={dayWorkoutSessions(day)}
          onOpenTrain={onOpenTrain}
          readiness={r?.score}
          streak={streak}
          oura={
            ouraConnected
              ? { lastSynced: wkSync.lastSynced, syncing: wkSync.syncing, onSync: wkSync.sync }
              : undefined
          }
        />
        <RemindersSection user={user} />
        <DayTimeline
          key={`tl-${key}-${scheduleRev}`}
          date={date}
          isToday={isToday}
          onOpenSchedule={() => setSheet('schedule')}
        />
        <DayNotes
          key={`notes-${key}`}
          initial={day.notes ?? ''}
          onSave={notes => save({ notes })}
        />
      </div>

      {sheet === 'schedule' && (
        <Sheet
          title="Schedule"
          onClose={() => {
            setSheet(null)
            setScheduleRev(n => n + 1)
          }}
        >
          <Suspense fallback={null}>
            <ScheduleTab user={user} initialDay={dayKeyOf(date)} />
          </Suspense>
        </Sheet>
      )}
    </>
  )
}
