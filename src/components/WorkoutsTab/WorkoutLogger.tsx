import { useEffect, useMemo, useState } from 'react'
import type { LoggedExercise, LoggedSet } from '../../data/tracker'
import { trackerStore } from '../../hooks/useStore'
import { fmtSets, lastPerformance } from '../../lib/workoutLog'
import type { WorkoutDraft } from '../../lib/workoutLog'

// ── Number stepper: big − / + buttons around a typeable value ─────

function Stepper({
  value,
  step,
  unit,
  label,
  onChange,
}: {
  value: number | undefined
  step: number
  unit: string
  label: string
  onChange: (v: number | undefined) => void
}) {
  // Local text so "12." can be typed before it parses
  const [text, setText] = useState(value == null ? '' : String(value))
  const [prev, setPrev] = useState(value)
  if (value !== prev) {
    setPrev(value)
    setText(value == null ? '' : String(value))
  }
  const bump = (dir: 1 | -1) => {
    const next = Math.max(0, Math.round(((value ?? 0) + dir * step) * 10) / 10)
    onChange(next)
  }
  return (
    <div className="stepper">
      <button
        type="button"
        className="stepper__btn"
        onClick={() => bump(-1)}
        aria-label={`Less ${label}`}
      >
        −
      </button>
      <input
        className="stepper__input"
        inputMode={step < 1 ? 'decimal' : 'numeric'}
        aria-label={label}
        placeholder="–"
        value={text}
        onChange={e => {
          const t = e.target.value.replace(',', '.')
          setText(t)
          if (t.trim() === '') onChange(undefined)
          else if (!Number.isNaN(Number(t))) onChange(Number(t))
        }}
      />
      <span className="stepper__unit">{unit}</span>
      <button
        type="button"
        className="stepper__btn"
        onClick={() => bump(1)}
        aria-label={`More ${label}`}
      >
        +
      </button>
    </div>
  )
}

// ── One exercise card ─────────────────────────────────────────────

function ExerciseCard({
  ex,
  idx,
  last,
  onChange,
  onRemove,
}: {
  ex: LoggedExercise
  idx: number
  last: string | null
  onChange: (ex: LoggedExercise) => void
  onRemove: () => void
}) {
  const timed = ex.sets.some(s => s.sec != null)
  const setSet = (i: number, patch: Partial<LoggedSet>) =>
    onChange({ ...ex, sets: ex.sets.map((s, j) => (j === i ? { ...s, ...patch } : s)) })

  // Ticking a set carries its numbers into the next unticked set
  const toggleDone = (i: number) => {
    const s = ex.sets[i]
    const sets = ex.sets.map((x, j) => {
      if (j === i) return { ...x, done: !x.done }
      if (j === i + 1 && !s.done && !x.done) return { ...x, reps: s.reps, kg: s.kg, sec: s.sec }
      return x
    })
    onChange({ ...ex, sets })
  }

  const addSet = () => {
    const tail = ex.sets[ex.sets.length - 1]
    const next: LoggedSet = tail
      ? { reps: tail.reps, kg: tail.kg, sec: tail.sec, done: false }
      : { reps: 10, done: false }
    onChange({ ...ex, sets: [...ex.sets, next] })
  }

  return (
    <div className="logger-ex">
      <div className="logger-ex__hdr">
        <span className="logger-ex__num">{idx + 1}</span>
        <input
          className="logger-ex__name"
          value={ex.name}
          placeholder="Exercise name"
          aria-label={`Exercise ${idx + 1} name`}
          onChange={e => onChange({ ...ex, name: e.target.value })}
        />
        <button
          type="button"
          className="logger-icon-btn"
          onClick={onRemove}
          aria-label={`Remove ${ex.name || 'exercise'}`}
        >
          ×
        </button>
      </div>
      {last && <div className="logger-ex__last">Last time: {last}</div>}
      {ex.sets.map((s, i) => (
        <div key={i} className={`logger-set${s.done ? ' logger-set--done' : ''}`}>
          <span className="logger-set__idx">{i + 1}</span>
          {timed ? (
            <Stepper
              value={s.sec}
              step={5}
              unit="s"
              label={`Set ${i + 1} seconds`}
              onChange={v => setSet(i, { sec: v })}
            />
          ) : (
            <>
              <Stepper
                value={s.reps}
                step={1}
                unit="reps"
                label={`Set ${i + 1} reps`}
                onChange={v => setSet(i, { reps: v })}
              />
              <Stepper
                value={s.kg}
                step={0.5}
                unit="kg"
                label={`Set ${i + 1} kg`}
                onChange={v => setSet(i, { kg: v })}
              />
            </>
          )}
          <button
            type="button"
            className="logger-set__check"
            aria-pressed={s.done}
            aria-label={`Set ${i + 1} done`}
            onClick={() => toggleDone(i)}
          >
            ✓
          </button>
        </div>
      ))}
      <div className="logger-ex__actions">
        <button type="button" className="link-btn" onClick={addSet}>
          ＋ Add set
        </button>
        {ex.sets.length > 1 && (
          <button
            type="button"
            className="link-btn text-muted"
            onClick={() => onChange({ ...ex, sets: ex.sets.slice(0, -1) })}
          >
            Remove last set
          </button>
        )}
      </div>
    </div>
  )
}

// ── Full-screen logger ────────────────────────────────────────────

function fmtElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return h ? `${h}:${mmss}` : mmss
}

interface Props {
  draft: WorkoutDraft
  onChange: (d: WorkoutDraft) => void
  /** Hide the logger; the draft is kept so it can be resumed */
  onClose: () => void
  onFinish: () => void
  onDiscard: () => void
}

/** Set-by-set workout logger. Every change is saved to the draft by the parent. */
export default function WorkoutLogger({ draft, onChange, onClose, onFinish, onDiscard }: Props) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Keep the screen on mid-workout (same as cooking mode)
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    navigator.wakeLock
      ?.request('screen')
      .then(l => (lock = l))
      .catch(() => {})
    return () => void lock?.release().catch(() => {})
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // "Last time" hints — history is fixed while the logger is open
  const [history] = useState(() => trackerStore.getAll())
  const lastByName = useMemo(() => {
    const out: Record<string, string | null> = {}
    for (const e of draft.exercises) {
      const last = lastPerformance(e.name, history, draft.date)
      out[e.name] = last ? fmtSets(last.sets) : null
    }
    return out
  }, [draft.exercises, draft.date, history])

  const setEx = (i: number, ex: LoggedExercise) =>
    onChange({ ...draft, exercises: draft.exercises.map((e, j) => (j === i ? ex : e)) })
  const removeEx = (i: number) =>
    onChange({ ...draft, exercises: draft.exercises.filter((_, j) => j !== i) })
  const addEx = () =>
    onChange({
      ...draft,
      exercises: [...draft.exercises, { name: '', sets: [{ reps: 10, done: false }] }],
    })

  const editing = !!draft.editing
  const total = draft.exercises.reduce((n, e) => n + e.sets.length, 0)
  const done = draft.exercises.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0)

  return (
    <div
      className="cooking-overlay logger"
      role="dialog"
      aria-modal="true"
      aria-label="Log workout"
    >
      <div className="cooking-topbar">
        <button
          type="button"
          onClick={onClose}
          className="cooking-topbar__back"
          aria-label="Close logger"
        >
          ✕
        </button>
        <span className="logger__title">
          {editing ? 'Edit · ' : ''}
          {draft.title}
        </span>
        {!editing && (
          <span className="logger__timer" aria-label="Elapsed time">
            {fmtElapsed(now - draft.startedAt)}
          </span>
        )}
      </div>

      <div className="logger__body">
        {draft.exercises.map((ex, i) => (
          <ExerciseCard
            key={i}
            ex={ex}
            idx={i}
            last={lastByName[ex.name] ?? null}
            onChange={e => setEx(i, e)}
            onRemove={() => removeEx(i)}
          />
        ))}
        <button type="button" className="ex-add-btn" onClick={addEx}>
          ＋ Add exercise
        </button>
        <button
          type="button"
          className="link-btn text-muted logger__discard"
          onClick={() =>
            window.confirm(
              editing
                ? 'Discard your changes? The saved workout stays as it was.'
                : 'Discard this workout? Logged sets will be lost.',
            ) && onDiscard()
          }
        >
          {editing ? 'Discard changes' : 'Discard workout'}
        </button>
      </div>

      <div className="logger__footer">
        <button type="button" className="btn btn--teal logger__finish" onClick={onFinish}>
          {editing ? 'Save changes' : 'Finish workout'} · {done}/{total} sets
        </button>
      </div>
    </div>
  )
}
