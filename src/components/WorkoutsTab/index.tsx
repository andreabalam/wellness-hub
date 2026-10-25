import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  WORKOUT_PLAN,
  WORKOUT_PLAN_VERSION,
  PLAN_NOTES,
  MALE_DEFAULT_PLAN,
} from '../../data/workouts'
import type { Exercise, WorkoutWeek } from '../../data/workouts'
import { bodyStatsStore, trackerStore, useStoreRev, workoutPlanStore } from '../../hooks/useStore'
import { useCyclePhase } from '../../hooks/useCyclePhase'
import type { PhaseSuggestion } from '../../lib/cyclePhase'
import { isOuraConnected } from '../../lib/oura'
import { showToast } from '../../lib/toast'
import { safeGet, safeRemove, safeSet } from '../../lib/storage'
import { isWorkoutDraft } from '../../lib/schema'
import {
  applyEdit,
  attachLoggedWorkout,
  completedExercises,
  draftFromSession,
  draftMinutes,
  loggedSummary,
  newDraft,
} from '../../lib/workoutLog'
import type { WorkoutDraft } from '../../lib/workoutLog'
import { dayWorkoutSessions, workoutSessionLabel } from '../../data/tracker'
import type { DayData, WorkoutSession } from '../../data/tracker'
import type { WorkoutDay } from '../../data/workouts'
import { dkey } from '../TrackerTab/dateKey'
import CycleToday from './CycleToday'
import TrainDay from './TrainDay'
import WorkoutLogger from './WorkoutLogger'
import { importOuraWorkoutHistory } from '../../lib/ouraImport'
import TrainHistory from './TrainHistory'

/** The workout in progress — survives closing the logger or the app. */
const DRAFT_KEY = 'whub_workout_draft_v1'
/** Last Oura history backfill (ms) — at most once a day */
const HISTORY_SYNC_KEY = 'whub_oura_history_sync_v1'
const HISTORY_SYNC_MS = 24 * 60 * 60 * 1000
const HISTORY_DAYS = 84

/** Plan week (0-based) for each cycle phase in the 4-week cycle-synced plan. */
const PHASE_WEEK: Record<PhaseSuggestion['phase'], number> = {
  Menstrual: 0,
  Follicular: 1,
  Ovulatory: 2,
  Luteal: 3,
}

// ── Sub-components ────────────────────────────────────────────────

function ExerciseRow({
  ex,
  idx,
  color,
  size = 'normal',
}: {
  ex: Exercise
  idx: number
  color: string
  size?: 'normal' | 'small'
}) {
  const [open, setOpen] = useState(false)
  const numSize = size === 'small' ? '1.2rem' : '1.35rem'
  const bg = size === 'small' ? 'var(--muted2)' : color
  return (
    <div className="exercise-row" onClick={() => setOpen(o => !o)}>
      <div
        className="exercise-num flex-center"
        style={{ width: numSize, height: numSize, background: bg }}
      >
        {idx + 1}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-6 flex-wrap">
          <span
            className="font-500 text-default"
            style={{ fontSize: size === 'small' ? '0.857rem' : '0.929rem' }}
          >
            {ex.t}
          </span>
          <span className="exercise-badge">{ex.d}</span>
        </div>
        {open && <div className="exercise-instruction">{ex.i}</div>}
      </div>
    </div>
  )
}

// ── Edit form for one workout day ─────────────────────────────────

function ExerciseEditRow({
  ex,
  idx,
  onChange,
  onRemove,
}: {
  ex: Exercise
  idx: number
  onChange: (idx: number, field: keyof Exercise, val: string) => void
  onRemove: (idx: number) => void
}) {
  return (
    <div className="ex-edit-row">
      <div className="ex-edit-num">{idx + 1}</div>
      <div className="flex-1">
        <div className="flex gap-6 mb-4">
          <input
            className="input-sm flex-1"
            placeholder="Exercise name"
            value={ex.t}
            onChange={e => onChange(idx, 't', e.target.value)}
          />
          <input
            className="input-sm"
            style={{ width: 100 }}
            placeholder="Sets / time"
            value={ex.d}
            onChange={e => onChange(idx, 'd', e.target.value)}
          />
        </div>
        <textarea
          className="input-sm w-full"
          rows={2}
          placeholder="Instructions"
          value={ex.i}
          onChange={e => onChange(idx, 'i', e.target.value)}
        />
      </div>
      <button
        className="ex-edit-del"
        onClick={() => onRemove(idx)}
        title="Remove exercise"
        type="button"
      >
        ×
      </button>
    </div>
  )
}

// ── Log / resume button + "logged today" chip on a day card ──────

function DayLogBar({
  logged,
  inProgress,
  isToday,
  onStart,
}: {
  logged: WorkoutSession | undefined
  inProgress: boolean
  isToday: boolean
  onStart: () => void
}) {
  return (
    <div className="day-card__log">
      {logged?.exercises && (
        <span className="day-card__logged">
          ✓ Logged · {loggedSummary(logged.exercises).sets} sets
        </span>
      )}
      <button
        type="button"
        className={`btn btn--sm ${isToday || inProgress ? 'btn--teal' : 'btn--ghost'}`}
        onClick={onStart}
      >
        {inProgress ? '▶ Resume workout' : isToday ? '▶ Start workout' : 'Log this workout'}
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

interface Props {
  user: User | null
}

export default function WorkoutsTab({ user }: Props) {
  // null = follow the cycle phase; a number = the user picked a week by hand
  const [activeWeek, setActiveWeek] = useState<number | null>(null)
  const [today] = useState(() => new Date())
  // The day being viewed/logged in the day card (‹ › back-fills past days)
  const [date, setDate] = useState(today)
  const [ouraConnected, setOuraConnected] = useState(false)
  // Bumped on any tracker / profile write (any tab), so derived reads refresh
  const storeRev = useStoreRev()

  // editKey = "weekIdx-dayIdx" or null when not editing
  const [editKey, setEditKey] = useState<string | null>(null)
  const [draftExs, setDraftExs] = useState<Exercise[]>([])

  const storedStats = bodyStatsStore.get()
  const storedPlan = workoutPlanStore.get()

  const isAuth = !!user

  // A stored plan saved before the current plan version is outdated - show the new built-in plan.
  const storedIsCurrent = storedPlan?.planData?.[0]?.v === WORKOUT_PLAN_VERSION
  const planData = isAuth
    ? storedIsCurrent && storedPlan
      ? storedPlan.planData
      : WORKOUT_PLAN
    : MALE_DEFAULT_PLAN
  const planGender = isAuth ? (storedPlan?.gender ?? 'female') : 'male'

  useEffect(() => {
    if (!isAuth) return
    isOuraConnected()
      .then(setOuraConnected)
      .catch(() => {})
  }, [isAuth])

  // ── Tracker reads (refreshed via storeRev) ──
  const todayKey = dkey(today)
  const dateKey = dkey(date)
  const isToday = dateKey === todayKey
  const { allDays, todayPhase, dayData } = (() => {
    void storeRev
    const all = trackerStore.getAll()
    return {
      allDays: all,
      todayPhase: trackerStore.getDay(todayKey).phase,
      dayData: trackerStore.getDay(dateKey),
    }
  })()
  const daySessions = dayWorkoutSessions(dayData)

  const saveDay = (patch: Partial<DayData>) => {
    trackerStore.setDay(dateKey, { ...trackerStore.getDay(dateKey), ...patch })
  }

  // Once a day, backfill ~12 weeks of Oura workouts in one request so History
  // and the weeks counter include days never opened in the app.
  useEffect(() => {
    if (!ouraConnected) return
    if (Date.now() - safeGet<number>(HISTORY_SYNC_KEY, 0) < HISTORY_SYNC_MS) return
    const keyDaysAgo = (n: number) => {
      const d = new Date(today)
      d.setDate(d.getDate() - n)
      return dkey(d)
    }
    importOuraWorkoutHistory(keyDaysAgo(HISTORY_DAYS), keyDaysAgo(1), d =>
      dayWorkoutSessions(trackerStore.getDay(d)),
    )
      .then(changed => {
        safeSet(HISTORY_SYNC_KEY, Date.now())
        const dates = Object.keys(changed)
        for (const d of dates)
          trackerStore.setDay(d, {
            ...trackerStore.getDay(d),
            wkSessions: changed[d],
            workout: changed[d][0]?.type ?? null,
          })
        if (!dates.length) return
        showToast(
          `Imported Oura workouts for ${dates.length} past day${dates.length === 1 ? '' : 's'}`,
          'info',
        )
      })
      .catch(() => {}) // retried on the next visit
  }, [ouraConnected, today])

  const openDay = (key: string) => {
    setDate(new Date(key + 'T12:00:00'))
    document.getElementById('train-day')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const shiftDate = (delta: -1 | 1) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    if (dkey(d) <= todayKey) setDate(d)
  }

  // ── Cycle sync: open the plan on the week matching today's phase ──
  const cycleOn = isAuth && planGender === 'female' && storedStats.cycleType !== 'none'
  const cycle = useCyclePhase(today, cycleOn && ouraConnected, storeRev)
  const suggestion = cycleOn ? cycle.suggestion : null
  // A phase set by hand for today wins over the estimate
  const phase = cycleOn
    ? todayPhase in PHASE_WEEK
      ? (todayPhase as PhaseSuggestion['phase'])
      : suggestion?.phase
    : undefined
  const phaseWeek = phase && planData.length >= 4 ? PHASE_WEEK[phase] : null

  const safeWeek = Math.min(activeWeek ?? phaseWeek ?? 0, planData.length - 1)
  const wk = planData[safeWeek]

  // Plan days run Mon (Day 1) → Sun (Day 7); only marked on the current phase's week.
  const weekdayIdx = (today.getDay() + 6) % 7
  const todayIdx = phaseWeek === safeWeek && wk.days.length === 7 ? weekdayIdx : null
  const todayPlanWeek = phaseWeek != null ? planData[phaseWeek] : null
  const todayPlanDay = todayPlanWeek?.days.length === 7 ? todayPlanWeek.days[weekdayIdx] : undefined

  const setTodayPhase = (p: string) => {
    trackerStore.setDay(todayKey, { ...trackerStore.getDay(todayKey), phase: p })
    setActiveWeek(null)
  }

  const markPeriodStart = () => {
    setTodayPhase('Menstrual')
    showToast('Period start saved - plan moved to Week 1', 'success')
  }

  // ── Set logging ───────────────────────────────────────────────
  const [draft, setDraftState] = useState<WorkoutDraft | null>(() =>
    safeGet<WorkoutDraft | null>(DRAFT_KEY, null, (v): v is WorkoutDraft | null =>
      isWorkoutDraft(v),
    ),
  )
  const [loggerOpen, setLoggerOpen] = useState(false)

  const setDraft = (d: WorkoutDraft | null) => {
    if (d) safeSet(DRAFT_KEY, d)
    else safeRemove(DRAFT_KEY)
    setDraftState(d)
  }

  const discardPrompt = () =>
    draft?.editing
      ? 'Discard your unsaved changes to the other workout?'
      : 'Discard the workout in progress?'

  const startLogging = (day: WorkoutDay, week: number) => {
    const resume =
      !draft?.editing && draft?.planRef?.week === week && draft.planRef.slot === day.slot
    if (draft && !resume && !window.confirm(discardPrompt())) return
    if (!resume) setDraft(newDraft(day, week, dateKey, trackerStore.getAll()))
    setLoggerOpen(true)
  }

  const editSession = (s: WorkoutSession) => {
    const resume = draft?.editing?.sessionId === s.id
    if (draft && !resume && !window.confirm(discardPrompt())) return
    if (!resume) setDraft(draftFromSession(s, workoutSessionLabel(s), dateKey))
    setLoggerOpen(true)
  }

  const finishWorkout = () => {
    if (!draft) return
    const exercises = completedExercises(draft)
    if (!exercises.length) {
      showToast('Tick ✓ on the sets you did before finishing')
      return
    }
    const day = trackerStore.getDay(draft.date)
    if (draft.editing) {
      trackerStore.setDay(draft.date, {
        ...day,
        wkSessions: applyEdit(dayWorkoutSessions(day), draft.editing.sessionId, exercises),
      })
      setDraft(null)
      setLoggerOpen(false)
      showToast('Workout updated', 'success')
      return
    }
    const sessions = attachLoggedWorkout(dayWorkoutSessions(day), {
      id: `manual-${Date.now()}`,
      src: 'manual',
      type: draft.type,
      label: draft.title,
      min: draftMinutes(draft),
      exercises,
      ...(draft.planRef && { planRef: draft.planRef }),
    })
    trackerStore.setDay(draft.date, {
      ...day,
      wkSessions: sessions,
      workout: sessions[0]?.type ?? null,
    })
    const sum = loggedSummary(exercises)
    setDraft(null)
    setLoggerOpen(false)
    showToast(
      `Workout saved · ${sum.exercises} exercise${sum.exercises === 1 ? '' : 's'}, ${sum.sets} sets`,
      'success',
    )
  }

  const loggedFor = (week: number, slot: string) =>
    daySessions.find(s => s.planRef?.week === week && s.planRef.slot === slot)
  const inProgress = (week: number, slot: string) =>
    !draft?.editing && draft?.planRef?.week === week && draft.planRef.slot === slot

  // Today's plan workout, shown at the top of the day card
  let planRow: ReactNode
  if (!isToday)
    planRow = (
      <div className="train-plan-hint">
        Tap “Log this workout” on a plan day below to log it for this day.
      </div>
    )
  else if (todayPlanWeek && todayPlanDay?.exs.length && todayPlanDay.type !== 'Rest')
    planRow = (
      <div className="train-plan-row">
        <div className="flex-1">
          <div className="tlabel text-muted2" style={{ marginBottom: 2 }}>
            Week {todayPlanWeek.week} plan
          </div>
          <div className="text-md font-500 text-default">
            {todayPlanDay.slot} · {todayPlanDay.label}
          </div>
        </div>
        <DayLogBar
          logged={loggedFor(todayPlanWeek.week, todayPlanDay.slot)}
          inProgress={inProgress(todayPlanWeek.week, todayPlanDay.slot)}
          isToday
          onStart={() => startLogging(todayPlanDay, todayPlanWeek.week)}
        />
      </div>
    )
  else if (todayPlanDay)
    planRow = (
      <div className="train-plan-hint">Today's plan: {todayPlanDay.label.toLowerCase()} 😴</div>
    )
  else planRow = <div className="train-plan-hint">Tap “Start” on a plan day below.</div>

  const PHASES_FEMALE = [
    { n: 'Week 1 - Menstrual', s: 'Train as normal, drop a set on rough days', c: 'var(--purple)' },
    { n: 'Week 2 - Follicular', s: 'Push week: add sets, top of rep ranges', c: 'var(--green)' },
    { n: 'Week 3 - Ovulation', s: 'Hold loads, longer warm-up', c: 'var(--amber)' },
    { n: 'Week 4 - Late luteal', s: 'Same weights, one set fewer', c: 'var(--coral)' },
  ]

  const startEdit = (weekIdx: number, dayIdx: number) => {
    const day = planData[weekIdx]?.days[dayIdx]
    if (!day) return
    setDraftExs(day.exs.map(e => ({ ...e })))
    setEditKey(`${weekIdx}-${dayIdx}`)
  }

  const cancelEdit = () => {
    setEditKey(null)
    setDraftExs([])
  }

  const saveEdit = (weekIdx: number, dayIdx: number) => {
    const filtered = draftExs.filter(e => e.t.trim())
    const newPlanData: WorkoutWeek[] = planData.map((wkk, wi) => ({
      ...wkk,
      v: WORKOUT_PLAN_VERSION,
      days: wkk.days.map((day, di) => {
        if (wi === weekIdx && di === dayIdx) return { ...day, exs: filtered }
        return day
      }),
    }))
    workoutPlanStore.set({
      gender: storedPlan?.gender ?? 'female',
      numWeeks: storedPlan?.numWeeks ?? newPlanData.length,
      planData: newPlanData,
    })
    setEditKey(null)
    setDraftExs([])
  }

  const handleExChange = (idx: number, field: keyof Exercise, val: string) => {
    setDraftExs(prev => prev.map((e, i) => (i === idx ? { ...e, [field]: val } : e)))
  }

  const handleExRemove = (idx: number) => {
    setDraftExs(prev => prev.filter((_, i) => i !== idx))
  }

  const handleExAdd = () => {
    setDraftExs(prev => [...prev, { t: '', d: '', i: '' }])
  }

  return (
    <>
      {/* Guest banner */}
      {!isAuth && (
        <div className="pbanner mb-20">
          <span className="text-lg">💡</span>
          <div>
            <span className="text-base text-teal font-500">Example plan · Full-body 3×/week</span>
            <span className="text-sm text-muted" style={{ marginLeft: 8 }}>
              Sign in to load your personalized programme.
            </span>
          </div>
        </div>
      )}

      {cycleOn && (
        <CycleToday
          suggestion={suggestion}
          week={phaseWeek != null ? planData[phaseWeek].week : null}
          todayKey={todayKey}
          ouraConnected={ouraConnected}
          tagScopeMissing={cycle.tagScopeMissing}
          onPeriodStarted={markPeriodStart}
          manualPhase={todayPhase}
          onPhaseChange={setTodayPhase}
        />
      )}

      {isAuth && (
        <TrainDay
          key={dateKey}
          sessions={daySessions}
          initialWkNotes={dayData.wkNotes}
          ouraConnected={ouraConnected}
          date={date}
          isToday={isToday}
          onShiftDate={shiftDate}
          onSave={saveDay}
          onEditSession={editSession}
        >
          {planRow}
        </TrainDay>
      )}

      {isAuth && <TrainHistory days={allDays} onOpenDay={openDay} />}

      {/* Plan subtitle */}
      <div className="mb-20">
        {isAuth && (
          <div
            className="font-mono uppercase tracking-wider mb-6 text-2xs"
            style={{ color: planGender === 'female' ? 'var(--coral)' : 'var(--teal)' }}
          >
            {planGender === 'female'
              ? 'Fat loss · Cycle-synced · Home + Pilates'
              : 'Strength · Full-body · Home'}
          </div>
        )}
        <div className="page-title">
          {isAuth ? (
            planGender === 'female' ? (
              <>
                <span>Her Fat Loss &amp; </span>
                <em className="italic text-coral">Recomposition Plan</em>
              </>
            ) : (
              <>
                <span>Full-Body </span>
                <em className="italic text-teal">Strength Plan</em>
              </>
            )
          ) : (
            <>
              <span>Full-Body </span>
              <em className="italic text-teal">3×/week Template</em>
            </>
          )}
        </div>
        {!isAuth && (
          <div className="plan-label">
            A 3-week progressive full-body template. Week 1 shows example exercises — create an
            account to save your own plan.
          </div>
        )}
      </div>

      {/* 4-week cycle-synced plan */}
      {isAuth && planGender === 'female' && storedStats.cycleType !== 'none' && (
        <div className="cycle-panel">
          <div className="cycle-panel__label">4-Week Cycle-Synced Plan</div>
          <div className="cycle-panel__body">
            Each cycle phase maps to one week, and the plan opens on the week for your current phase
            - from your Oura period log, or the period start you mark above. Same 7-day structure
            all month - each phase only adjusts sets, conditioning and swaps.
          </div>
          <div className="cycle-phases-grid">
            {PHASES_FEMALE.map(p => (
              <div key={p.n} className="cycle-phase-item" style={{ border: `1px solid ${p.c}` }}>
                <div className="text-sm font-500 mb-4" style={{ color: p.c }}>
                  {p.n}
                </div>
                <div className="text-xs text-muted lh-16">{p.s}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week nav */}
      <div className="week-nav">
        {planData.map((w, i) => (
          <button
            key={w.week}
            className={i === phaseWeek ? 'week-nav__btn--current' : undefined}
            title={i === phaseWeek ? 'Your current cycle week' : undefined}
            onClick={() => setActiveWeek(i)}
            style={{
              background: 'var(--bg2)',
              border: `1px solid ${i === safeWeek ? w.color : 'var(--border)'}`,
              borderRadius: 8,
              padding: '7px 18px',
              fontFamily: 'sans-serif',
              fontSize: '0.929rem',
              color: i === safeWeek ? w.color : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all .2s',
              whiteSpace: 'nowrap',
            }}
          >
            Week {w.week}
          </button>
        ))}
      </div>

      {/* Week content */}
      <div>
        {/* Phase header */}
        <div
          className="week-phase-header"
          style={{ background: 'var(--bg2)', border: `1px solid ${wk.color}` }}
        >
          <div className="week-phase-title">{wk.label}</div>
          <div className="week-phase-note">{wk.note}</div>
          <div className="week-nutrition">
            <strong className="text-default">Nutrition this week:</strong> {wk.nutr}
          </div>
        </div>

        {/* Day cards */}
        <div className="day-cards-grid">
          {wk.days.map((day, dayIdx) => {
            const typeIcon =
              { Home: '🏠', Pilates: '🧘', Rest: '😴', Recovery: '🚶' }[day.type] ?? '💪'
            const hasExercises = day.exs.length > 0
            const key = `${safeWeek}-${dayIdx}`
            const isEditing = editKey === key
            const isTodayCard = dayIdx === todayIdx

            return (
              <div
                key={day.slot}
                id={isTodayCard ? 'day-card-today' : undefined}
                className={isTodayCard ? 'day-card day-card--today' : 'day-card'}
                style={isTodayCard ? { borderColor: day.color } : undefined}
              >
                <div className="day-card__header">
                  <div className="day-card__top-row">
                    <div className="day-card__slot" style={{ color: day.color }}>
                      {day.slot}
                      {isTodayCard && (
                        <span className="day-card__today" style={{ background: day.color }}>
                          Today
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div className="day-card__type">
                        {typeIcon} {day.type}
                      </div>
                      {isAuth && !isEditing && (
                        <button
                          className="ex-edit-btn"
                          onClick={() => startEdit(safeWeek, dayIdx)}
                          title="Edit exercises"
                          type="button"
                        >
                          ✎
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="day-card__label">{day.label}</div>
                  <div className="day-card__time">{day.time}</div>
                  <div
                    className="day-card__solin"
                    style={{ color: day.color, border: `1px solid ${day.color}22` }}
                  >
                    {day.solin}
                  </div>
                </div>
                <div className="day-card__body">
                  {isEditing ? (
                    <div className="ex-edit-panel">
                      {draftExs.length === 0 && (
                        <div className="text-xs text-muted mb-8">
                          No exercises — tap "＋ Add" to add one.
                        </div>
                      )}
                      {draftExs.map((ex, ei) => (
                        <ExerciseEditRow
                          key={ei}
                          ex={ex}
                          idx={ei}
                          onChange={handleExChange}
                          onRemove={handleExRemove}
                        />
                      ))}
                      <button className="ex-add-btn" onClick={handleExAdd} type="button">
                        ＋ Add exercise
                      </button>
                      <div className="flex gap-8 mt-8">
                        <button
                          className="btn btn--teal btn--sm flex-1"
                          onClick={() => saveEdit(safeWeek, dayIdx)}
                        >
                          Save
                        </button>
                        <button className="btn btn--ghost btn--sm" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {hasExercises ? (
                        <>
                          {day.exs.map((ex, ei) => (
                            <ExerciseRow key={ei} ex={ex} idx={ei} color={day.color} />
                          ))}
                          <div className="day-card__hint">tap any exercise to expand</div>
                          {isAuth && day.type !== 'Rest' && (
                            <DayLogBar
                              logged={loggedFor(wk.week, day.slot)}
                              inProgress={inProgress(wk.week, day.slot)}
                              isToday={isToday && isTodayCard}
                              onStart={() => startLogging(day, wk.week)}
                            />
                          )}
                        </>
                      ) : (
                        <div className="day-card__empty">
                          No exercises added yet
                          {isAuth && (
                            <button
                              className="ex-edit-btn"
                              style={{ marginLeft: 8 }}
                              onClick={() => startEdit(safeWeek, dayIdx)}
                            >
                              ＋ Add
                            </button>
                          )}
                        </div>
                      )}
                      {day.alts && day.alts.length > 0 && (
                        <div className="alt-block">
                          <div className="alt-block__label">Swap option</div>
                          <div className="alt-block__title">{day.altLabel}</div>
                          {day.alts.map((ex, ei) => (
                            <ExerciseRow key={ei} ex={ex} idx={ei} color={day.color} size="small" />
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Plan notes */}
        {safeWeek === 0 && isAuth && planGender === 'female' && (
          <div className="plan-notes-grid">
            <div className="plan-notes-header">Plan guidance &amp; integration</div>
            {PLAN_NOTES.map(n => (
              <div key={n.title} className="plan-note-card">
                <div className="plan-note-card__hdr">
                  <span style={{ fontSize: '1.214rem' }}>{n.icon}</span>
                  <span className="text-base font-500" style={{ color: n.color }}>
                    {n.title}
                  </span>
                </div>
                <div className="plan-note-card__text">{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loggerOpen && draft && (
        <WorkoutLogger
          draft={draft}
          onChange={setDraft}
          onClose={() => setLoggerOpen(false)}
          onFinish={finishWorkout}
          onDiscard={() => {
            setDraft(null)
            setLoggerOpen(false)
          }}
        />
      )}
    </>
  )
}
