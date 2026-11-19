import { useEffect, useState, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { DayData } from '../../data/tracker'
import { dayWorkoutSessions } from '../../data/tracker'
import { bodyStatsStore, trackerStore, useStoreRev } from '../../hooks/useStore'
import { useOuraWorkoutSync } from '../../hooks/useOuraWorkoutSync'
import { useCyclePhase } from '../../hooks/useCyclePhase'
import { fetchOuraReadiness, isOuraConnected, readinessColor, readinessLabel } from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { safeGet, safeSet } from '../../lib/storage'
import { significantBurnKcal } from '../../lib/stats'
import { workoutWeekStats } from '../../lib/workoutWeeks'
import { dkey } from '../../lib/dateKey'
import WeekStrip from '../TrackerTab/WeekStrip'
import WeekActivitySummary from '../TrackerTab/WeekActivitySummary'
import TrainSummary from '../TrackerTab/TrainSummary'
import RemindersSection from '../TrackerTab/RemindersSection'
import ProfileStatsCard from '../TrackerTab/ProfileStatsCard'
import { PHASE_COLOR } from '../WorkoutsTab/CycleToday'
import DayTimeline, { dayKeyOf } from './DayTimeline'
import FoodCard from './FoodCard'
import { READINESS_CACHE_KEY } from '../../lib/storageKeys'
import { DayHeader } from '../common'

// Full Schedule (editor, .ics export, cognitive peak) — opened from the timeline
const ScheduleTab = lazy(() => import('../ScheduleTab'))

/** Full-screen sheet over Today (Schedule, Profile & targets). */
function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="cooking-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cooking-topbar">
        <button
          type="button"
          className="cooking-topbar__back"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
        >
          ✕
        </button>
        <span className="logger__title">{title}</span>
      </div>
      <div className="today-schedule-sheet">{children}</div>
    </div>
  )
}

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
 * Home screen: everything for one day at a glance — readiness, cycle and
 * streak, food and workout summaries, reminders, the Schedule timeline and
 * notes. Meditation has its own tab.
 */
export default function TodayTab({ user, date, onDateChange, onOpenFood, onOpenTrain }: Props) {
  // Bumped on any tracker / profile write (this tab, Train, background Oura import)
  const rev = useStoreRev()
  // Bumped when the Schedule sheet closes so the timeline re-reads edited blocks
  const [scheduleRev, setScheduleRev] = useState(0)
  const [ouraConnected, setOuraConnected] = useState(false)
  const [sheet, setSheet] = useState<'schedule' | 'profile' | null>(null)
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
  const cycleOn = stats.cycleType !== 'none'
  const cycle = useCyclePhase(date, cycleOn && ouraConnected, rev)
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
  const manualPhase = day.phase in PHASE_COLOR ? (day.phase as keyof typeof PHASE_COLOR) : null
  const phase = manualPhase ?? cycle.suggestion?.phase

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

      {/* Status: readiness · cycle · streak */}
      <div className="today-status">
        {r && (
          <span className="today-chip" style={{ borderColor: readinessColor(r.score) }}>
            <strong style={{ color: readinessColor(r.score) }}>{r.score}</strong> Readiness ·{' '}
            {readinessLabel(r.score)}
          </span>
        )}
        {cycleOn && phase && (
          <span className="today-chip" style={{ borderColor: PHASE_COLOR[phase] }}>
            <strong style={{ color: PHASE_COLOR[phase] }}>{phase}</strong>
            {cycle.suggestion && ` · day ${cycle.suggestion.cycleDay}`}
          </span>
        )}
        <span className="today-chip">
          🔥 <strong>{streak}</strong> week streak
        </span>
        <button type="button" className="today-chip" onClick={() => setSheet('profile')}>
          👤 Profile &amp; targets
        </button>
      </div>

      <div className="flex flex-col gap-12">
        <FoodCard day={day} onOpenFood={onOpenFood} />
        <TrainSummary
          sessions={dayWorkoutSessions(day)}
          onOpenTrain={onOpenTrain}
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
      {sheet === 'profile' && (
        <Sheet title="Profile & targets" onClose={() => setSheet(null)}>
          <ProfileStatsCard user={user} />
        </Sheet>
      )}
    </>
  )
}
