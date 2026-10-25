import { useEffect, useState, lazy, Suspense } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import type { DayData } from '../../data/tracker'
import { dayMedSessions, dayWorkoutSessions } from '../../data/tracker'
import { bodyStatsStore, trackerStore, useStoreRev } from '../../hooks/useStore'
import { useOuraWorkoutSync } from '../../hooks/useOuraWorkoutSync'
import { useCyclePhase } from '../../hooks/useCyclePhase'
import { fetchOuraReadiness, isOuraConnected, readinessColor, readinessLabel } from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { safeGet, safeSet } from '../../lib/storage'
import { significantBurnKcal } from '../../lib/stats'
import { workoutWeekStats } from '../../lib/workoutWeeks'
import { dkey } from '../TrackerTab/dateKey'
import WeekStrip from '../TrackerTab/WeekStrip'
import WeekActivitySummary from '../TrackerTab/WeekActivitySummary'
import TrainSummary from '../TrackerTab/TrainSummary'
import CheckIn from '../TrackerTab/CheckIn'
import MeditationLog from '../TrackerTab/MeditationLog'
import MeditationGuides from '../TrackerTab/MeditationGuides'
import RemindersSection from '../TrackerTab/RemindersSection'
import WeekGoal from '../TrackerTab/WeekGoal'
import ProfileStatsCard from '../TrackerTab/ProfileStatsCard'
import type { WeekGoalPayload } from '../TrackerTab/WeekGoal'
import { PHASE_COLOR } from '../WorkoutsTab/CycleToday'
import DayTimeline, { dayKeyOf } from './DayTimeline'
import FoodCard from './FoodCard'

// Full Schedule (editor, .ics export, cognitive peak) — opened from the timeline
const ScheduleTab = lazy(() => import('../ScheduleTab'))

const READINESS_CACHE_KEY = 'whub_oura_readiness_v1'

/** Local Monday (week anchor) of the week containing d. */
function mondayOf(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7))
  return m
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

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
 * streak, the Schedule timeline, food and workout summaries, check-in,
 * meditation, reminders, notes and the weekly goal.
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

  const { day, weekAnchorDay, lastWeek, streak } = (() => {
    void rev
    return {
      day: trackerStore.getDay(key),
      weekAnchorDay: trackerStore.getDay(dkey(mondayOf(date))),
      lastWeek: trackerStore.getDay(dkey(addDays(mondayOf(date), -7))),
      streak: workoutWeekStats(trackerStore.getAll(), new Date()).currentStreak,
    }
  })()

  const save = (patch: Partial<DayData>) => {
    trackerStore.setDay(key, { ...trackerStore.getDay(key), ...patch })
  }

  // Weekly goal persists on the week's Monday anchor day (not the viewed day)
  const saveWeekGoal = (p: WeekGoalPayload) => {
    const anchorKey = dkey(mondayOf(date))
    trackerStore.setDay(anchorKey, {
      ...trackerStore.getDay(anchorKey),
      weekGoal: p.weekGoal.trim(),
      weekGoalKind: p.weekGoalKind,
      weekGoalResult: p.weekGoalResult || undefined,
      weekGoalNote: p.weekGoalNote.trim() || undefined,
    })
  }

  const shift = (delta: number) => onDateChange(addDays(date, delta))

  if (!user) {
    return (
      <div className="guest-gate-cta">
        <div className="guest-gate-cta__icon">🔒</div>
        <div className="section-title mb-8">
          Sign in to see <em className="text-teal">Today</em>
        </div>
        <div className="guest-gate-cta__body">
          Your day at a glance: schedule, food, workout, check-in and meditation. Your data stays
          private and syncs across devices.
        </div>
      </div>
    )
  }

  const r = readiness[key]
  const manualPhase = day.phase in PHASE_COLOR ? (day.phase as keyof typeof PHASE_COLOR) : null
  const phase = manualPhase ?? cycle.suggestion?.phase

  return (
    <>
      <div className="today-hdr">
        <button
          type="button"
          onClick={() => shift(-1)}
          className="date-nav-btn"
          aria-label="Previous day"
        >
          ‹
        </button>
        <div className="today-hdr__title">
          <div className="page-title">
            {isToday ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'long' })}
          </div>
          <div className="date-display">
            {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="date-nav-btn"
          aria-label="Next day"
        >
          ›
        </button>
      </div>

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

      {/* Week workout/meditation roll-up (hidden when the week is empty) */}
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
        <DayTimeline
          key={`tl-${key}-${scheduleRev}`}
          date={date}
          isToday={isToday}
          onOpenSchedule={() => setSheet('schedule')}
        />
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
        {/* Keyed by date so their inputs re-seed on day change */}
        <CheckIn
          key={`checkin-${key}`}
          initialEnergy={day.energy}
          initialMood={day.mood}
          initialSleep={day.sleep}
          initialStress={day.stress}
          ouraConnected={ouraConnected}
          date={date}
          onSave={save}
        />
        <MeditationLog
          key={`med-${key}`}
          sessions={dayMedSessions(day)}
          ouraConnected={ouraConnected}
          date={date}
          onSave={save}
        />
        <MeditationGuides />
        <RemindersSection user={user} />
        <DayNotes
          key={`notes-${key}`}
          initial={day.notes ?? ''}
          onSave={notes => save({ notes })}
        />
        <WeekGoal
          key={dkey(mondayOf(date))}
          initialGoal={weekAnchorDay.weekGoal ?? ''}
          initialKind={weekAnchorDay.weekGoalKind ?? 'goal'}
          initialResult={weekAnchorDay.weekGoalResult ?? ''}
          initialNote={weekAnchorDay.weekGoalNote ?? ''}
          lastWeekGoal={lastWeek.weekGoal ?? ''}
          lastWeekResult={lastWeek.weekGoalResult ?? ''}
          onSave={saveWeekGoal}
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
