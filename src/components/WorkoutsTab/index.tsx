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
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        display: 'flex', gap: 9, padding: '9px 0',
        borderBottom: '1px solid var(--border)', cursor: 'pointer', alignItems: 'flex-start',
      }}
    >
      <div style={{
        width: numSize, height: numSize, borderRadius: '50%', background: bg,
        color: '#fff', fontFamily: 'monospace', fontSize: 9,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
      }}>{idx + 1}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: size === 'small' ? 12 : 13, fontWeight: 500, color: 'var(--text)' }}>{ex.t}</span>
          <span style={{
            fontFamily: 'monospace', fontSize: 9, color: 'var(--muted)',
            background: 'var(--bg3)', padding: '1px 7px', borderRadius: 5, border: '1px solid var(--border)',
          }}>{ex.d}</span>
        </div>
        {open && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 5, lineHeight: 1.6 }}>{ex.i}</div>
        )}
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────

interface Props { user: User | null }

export default function WorkoutsTab({ user }: Props) {
  const [activeWeek, setActiveWeek] = useState(0)
  const [statsSeed, setStatsSeed] = useState(0)

  // ── Load from stores (populated by syncAll on sign-in) ──────────
  const storedStats   = bodyStatsStore.get()
  const storedPlan    = workoutPlanStore.get()

  const isAuth      = !!user
  const hasStats    = isAuth && storedStats.weightKg > 0

  // Which plan to display
  const planData    = isAuth ? (storedPlan?.planData ?? WORKOUT_PLAN) : MALE_DEFAULT_PLAN
  const planGender  = isAuth ? (storedPlan?.gender   ?? 'female')     : 'male'

  // Clamp active week to actual plan length
  const safeWeek  = Math.min(activeWeek, planData.length - 1)
  const wk        = planData[safeWeek]

  const PHASES_FEMALE = [
    { n: 'Week 1 - Menstrual',  s: 'Low intensity, Pilates focus',       c: 'var(--purple)' },
    { n: 'Week 2 - Follicular', s: 'Build strength, peak energy',        c: 'var(--green)'  },
    { n: 'Week 3 - Luteal',     s: 'Moderate load, glute shred',         c: 'var(--amber)'  },
    { n: 'Restart Week 1',      s: 'When next period begins',            c: 'var(--coral)'  },
  ]

  // ── Render ───────────────────────────────────────────────────────
  return (
    <>
      {/* Guest banner */}
      {!isAuth && (
        <div className="pbanner mb-20">
          <span style={{ fontSize: 16 }}>💡</span>
          <div>
            <span className="text-base text-teal font-500">
              Example plan · Full-body 3×/week
            </span>
            <span className="text-sm text-muted" style={{ marginLeft: 8 }}>
              Sign in to load your personalized programme.
            </span>
          </div>
        </div>
      )}

      {/* Plan subtitle */}
      <div className="mb-20">
        {isAuth && (
          <div className="font-mono uppercase tracking-wider mb-6" style={{ fontSize: 10, color: planGender === 'female' ? 'var(--coral)' : 'var(--teal)' }}>
            {planGender === 'female'
              ? 'Fat loss · Cycle-synced · Home + Pilates'
              : 'Strength · Full-body · Home'}
          </div>
        )}
        <div className="font-serif mb-8" style={{ fontSize: 26, fontWeight: 400, color: 'var(--text)', lineHeight: 1.2 }}>
          {isAuth
            ? planGender === 'female'
              ? <><span>Her Fat Loss &amp; </span><em className="italic text-coral">Recomposition Plan</em></>
              : <><span>Full-Body </span><em className="italic text-teal">Strength Plan</em></>
            : <><span>Full-Body </span><em className="italic text-teal">3×/week Template</em></>
          }
        </div>
        {isAuth && hasStats && (
          <div className="text-base text-muted" style={{ maxWidth: 580, lineHeight: 1.6 }}>
            {storedStats.weightKg} kg · {storedStats.bodyFatPct}% body fat · {storedStats.heightM} m
            {storedStats.cycleType !== 'none' && ` · ${storedStats.cycleType} cycle`}
            {storedStats.equipment && ` · ${storedStats.equipment}`}
          </div>
        )}
        {!isAuth && (
          <div className="text-base text-muted" style={{ lineHeight: 1.6 }}>
            A 3-week progressive full-body template. Week 1 shows example exercises — create an account to save your own plan.
          </div>
        )}
      </div>

      {/* Profile & Targets — shared module (edit here or in Tracker tab) */}
      {isAuth && (
        <ProfileStatsCard
          key={statsSeed}
          user={user}
          onSaved={() => setStatsSeed(n => n + 1)}
        />
      )}

      {/* 3-week rotating cycle (female + has cycle) */}
      {isAuth && planGender === 'female' && storedStats.cycleType !== 'none' && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--purple)', borderRadius: 12, padding: '14px 18px', marginBottom: 22 }}>
          <div className="font-mono uppercase tracking-wider text-purple mb-8" style={{ fontSize: 9 }}>3-Week Rotating Cycle</div>
          <div className="text-base text-muted mb-10" style={{ lineHeight: 1.6 }}>
            Restart at <strong className="text-default">Week 1</strong> whenever your period begins. The plan mirrors the four hormonal phases without requiring you to track exact days.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
            {PHASES_FEMALE.map(p => (
              <div key={p.n} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${p.c}` }}>
                <div className="text-sm font-500 mb-4" style={{ color: p.c }}>{p.n}</div>
                <div className="text-xs text-muted" style={{ lineHeight: 1.4 }}>{p.s}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Week nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
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
        <div style={{ background: 'var(--bg2)', border: `1px solid ${wk.color}`, borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
          <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 19, fontWeight: 400, color: 'var(--text)', marginBottom: 7 }}>{wk.label}</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 9 }}>{wk.note}</div>
          <div style={{ padding: '9px 13px', background: 'rgba(201,145,58,0.06)', borderLeft: '2px solid var(--amber)', borderRadius: '0 6px 6px 0', fontSize: 12, color: 'var(--amber-light)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--text)' }}>Nutrition this week:</strong> {wk.nutr}
          </div>
        </div>

        {/* Day cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 12 }}>
          {wk.days.map(day => {
            const typeIcon = { Home: '🏠', Pilates: '🧘', Rest: '😴' }[day.type] ?? '💪'
            const hasExercises = day.exs.length > 0
            return (
              <div key={day.slot} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                {/* Card header */}
                <div style={{ padding: '13px 15px 10px', borderBottom: '1px solid var(--border)', background: 'linear-gradient(135deg,var(--bg2),var(--bg3))' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: day.color }}>{day.slot}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)' }}>{typeIcon} {day.type}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text)', marginBottom: 2 }}>{day.label}</div>
                  <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: 'var(--muted)', marginBottom: 7 }}>{day.time}</div>
                  <div style={{ fontSize: 12, color: day.color, padding: '6px 9px', borderRadius: 6, border: `1px solid ${day.color}22`, lineHeight: 1.5, fontStyle: 'italic' }}>{day.solin}</div>
                </div>

                {/* Exercises */}
                <div style={{ padding: '5px 15px 13px' }}>
                  {hasExercises ? (
                    <>
                      {day.exs.map((ex, ei) => (
                        <ExerciseRow key={ei} ex={ex} idx={ei} color={day.color} />
                      ))}
                      <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace', textAlign: 'center', marginTop: 7 }}>
                        tap any exercise to expand
                      </div>
                    </>
                  ) : (
                    <div style={{ padding: '14px 0', textAlign: 'center', color: 'var(--muted2)', fontSize: 12, fontFamily: '"DM Mono",monospace' }}>
                      No exercises added yet
                    </div>
                  )}

                  {/* Alt block */}
                  {day.alts && day.alts.length > 0 && (
                    <div style={{ marginTop: 12, padding: '11px 13px', background: 'var(--bg3)', borderRadius: 8, border: '1px dashed var(--border2)' }}>
                      <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 4 }}>If no Pilates available</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)', marginBottom: 9 }}>{day.altLabel}</div>
                      {day.alts.map((ex, ei) => (
                        <ExerciseRow key={ei} ex={ex} idx={ei} color={day.color} size="small" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Plan notes (Week 1 only, auth female) */}
        {safeWeek === 0 && isAuth && planGender === 'female' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 11, marginTop: 24 }}>
            <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 10, gridColumn: '1/-1' }}>
              Plan guidance &amp; integration
            </div>
            {PLAN_NOTES.map(n => (
              <div key={n.title} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                  <span style={{ fontSize: 17 }}>{n.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500, color: n.color }}>{n.title}</span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{n.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  )
}

