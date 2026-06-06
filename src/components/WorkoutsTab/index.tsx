import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { WORKOUT_PLAN, PLAN_NOTES, MALE_DEFAULT_PLAN } from '../../data/workouts'
import type { Exercise } from '../../data/workouts'
import { bodyStatsStore, workoutPlanStore } from '../../hooks/useStore'
import ProfileStatsCard from '../TrackerTab/ProfileStatsCard'

// ── Sub-components ────────────────────────────────────────────────

function ExerciseRow({ ex, idx, color, size = 'normal' }: {
  ex: Exercise; idx: number; color: string; size?: 'normal' | 'small'
}) {
  const [open, setOpen] = useState(false)
  const numSize = size === 'small' ? 17 : 19
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
          <span className="font-500 text-default" style={{ fontSize: size === 'small' ? 12 : 13 }}>{ex.t}</span>
          <span className="exercise-badge">{ex.d}</span>
        </div>
        {open && <div className="exercise-instruction">{ex.i}</div>}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

interface Props { user: User | null }

export default function WorkoutsTab({ user }: Props) {
  const [activeWeek, setActiveWeek] = useState(0)
  const [statsSeed, setStatsSeed] = useState(0)

  const storedStats   = bodyStatsStore.get()
  const storedPlan    = workoutPlanStore.get()

  const isAuth      = !!user
  const hasStats    = isAuth && storedStats.weightKg > 0

  const planData    = isAuth ? (storedPlan?.planData ?? WORKOUT_PLAN) : MALE_DEFAULT_PLAN
  const planGender  = isAuth ? (storedPlan?.gender   ?? 'female')     : 'male'

  const safeWeek  = Math.min(activeWeek, planData.length - 1)
  const wk        = planData[safeWeek]

  const PHASES_FEMALE = [
    { n: 'Week 1 - Menstrual',  s: 'Low intensity, Pilates focus',       c: 'var(--purple)' },
    { n: 'Week 2 - Follicular', s: 'Build strength, peak energy',        c: 'var(--green)'  },
    { n: 'Week 3 - Luteal',     s: 'Moderate load, glute shred',         c: 'var(--amber)'  },
    { n: 'Restart Week 1',      s: 'When next period begins',            c: 'var(--coral)'  },
  ]

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

      {/* Plan subtitle */}
      <div className="mb-20">
        {isAuth && (
          <div className="font-mono uppercase tracking-wider mb-6 text-2xs" style={{ color: planGender === 'female' ? 'var(--coral)' : 'var(--teal)' }}>
            {planGender === 'female' ? 'Fat loss · Cycle-synced · Home + Pilates' : 'Strength · Full-body · Home'}
          </div>
        )}
        <div className="page-title">
          {isAuth
            ? planGender === 'female'
              ? <><span>Her Fat Loss &amp; </span><em className="italic text-coral">Recomposition Plan</em></>
              : <><span>Full-Body </span><em className="italic text-teal">Strength Plan</em></>
            : <><span>Full-Body </span><em className="italic text-teal">3×/week Template</em></>
          }
        </div>
        {isAuth && hasStats && (
          <div className="plan-label" style={{ maxWidth: 580 }}>
            {storedStats.weightKg} kg · {storedStats.bodyFatPct}% body fat · {storedStats.heightM} m
            {storedStats.cycleType !== 'none' && ` · ${storedStats.cycleType} cycle`}
            {storedStats.equipment && ` · ${storedStats.equipment}`}
          </div>
        )}
        {!isAuth && <div className="plan-label">A 3-week progressive full-body template. Week 1 shows example exercises — create an account to save your own plan.</div>}
      </div>

      {isAuth && (
        <ProfileStatsCard key={statsSeed} user={user} onSaved={() => setStatsSeed(n => n + 1)} />
      )}

      {/* 3-week rotating cycle */}
      {isAuth && planGender === 'female' && storedStats.cycleType !== 'none' && (
        <div className="cycle-panel">
          <div className="cycle-panel__label">3-Week Rotating Cycle</div>
          <div className="cycle-panel__body">
            Restart at <strong className="text-default">Week 1</strong> whenever your period begins. The plan mirrors the four hormonal phases without requiring you to track exact days.
          </div>
          <div className="cycle-phases-grid">
            {PHASES_FEMALE.map(p => (
              <div key={p.n} className="cycle-phase-item" style={{ border: `1px solid ${p.c}` }}>
                <div className="text-sm font-500 mb-4" style={{ color: p.c }}>{p.n}</div>
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
            onClick={() => setActiveWeek(i)}
            style={{
              background: 'var(--bg2)',
              border: `1px solid ${i === safeWeek ? w.color : 'var(--border)'}`,
              borderRadius: 8, padding: '7px 18px',
              fontFamily: 'sans-serif', fontSize: 13,
              color: i === safeWeek ? w.color : 'var(--muted)',
              cursor: 'pointer', transition: 'all .2s', whiteSpace: 'nowrap',
            }}
          >
            Week {w.week}
          </button>
        ))}
      </div>

      {/* Week content */}
      <div>
        {/* Phase header */}
        <div className="week-phase-header" style={{ background: 'var(--bg2)', border: `1px solid ${wk.color}` }}>
          <div className="week-phase-title">{wk.label}</div>
          <div className="week-phase-note">{wk.note}</div>
          <div className="week-nutrition"><strong className="text-default">Nutrition this week:</strong> {wk.nutr}</div>
        </div>

        {/* Day cards */}
        <div className="day-cards-grid">
          {wk.days.map(day => {
            const typeIcon = { Home: '🏠', Pilates: '🧘', Rest: '😴' }[day.type] ?? '💪'
            const hasExercises = day.exs.length > 0
            return (
              <div key={day.slot} className="day-card">
                <div className="day-card__header">
                  <div className="day-card__top-row">
                    <div className="day-card__slot" style={{ color: day.color }}>{day.slot}</div>
                    <div className="day-card__type">{typeIcon} {day.type}</div>
                  </div>
                  <div className="day-card__label">{day.label}</div>
                  <div className="day-card__time">{day.time}</div>
                  <div className="day-card__solin" style={{ color: day.color, border: `1px solid ${day.color}22` }}>{day.solin}</div>
                </div>
                <div className="day-card__body">
                  {hasExercises ? (
                    <>
                      {day.exs.map((ex, ei) => <ExerciseRow key={ei} ex={ex} idx={ei} color={day.color} />)}
                      <div className="day-card__hint">tap any exercise to expand</div>
                    </>
                  ) : (
                    <div className="day-card__empty">No exercises added yet</div>
                  )}
                  {day.alts && day.alts.length > 0 && (
                    <div className="alt-block">
                      <div className="alt-block__label">If no Pilates available</div>
                      <div className="alt-block__title">{day.altLabel}</div>
                      {day.alts.map((ex, ei) => <ExerciseRow key={ei} ex={ex} idx={ei} color={day.color} size="small" />)}
                    </div>
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
                  <span style={{ fontSize: 17 }}>{n.icon}</span>
                  <span className="text-base font-500" style={{ color: n.color }}>{n.title}</span>
                </div>
                <div className="plan-note-card__text">{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
