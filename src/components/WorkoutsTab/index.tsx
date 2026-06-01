import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { WORKOUT_PLAN, PLAN_NOTES, MALE_DEFAULT_PLAN } from '../../data/workouts'
import type { Exercise } from '../../data/workouts'
import { bodyStatsStore, workoutPlanStore } from '../../hooks/useStore'
import type { UserBodyStats } from '../../lib/sync'

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

// ── Stats edit helpers ────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg3)', border: '1px solid var(--border2)',
  borderRadius: 7, padding: '8px 10px', color: 'var(--text)', fontSize: 13,
  fontFamily: '"DM Sans", sans-serif', outline: 'none',
}
const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' }

// ── Main component ────────────────────────────────────────────────

interface Props { user: User | null }

export default function WorkoutsTab({ user }: Props) {
  const [activeWeek, setActiveWeek] = useState(0)
  const [showEditStats, setShowEditStats] = useState(false)

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

  // Computed stats
  const fatMass  = hasStats ? +(storedStats.weightKg * storedStats.bodyFatPct / 100).toFixed(1) : null
  const leanMass = fatMass !== null ? +(storedStats.weightKg - fatMass).toFixed(1) : null

  // ── Edit stats state ─────────────────────────────────────────────
  const [editWeight,      setEditWeight]      = useState('')
  const [editBodyFat,     setEditBodyFat]     = useState('')
  const [editHeight,      setEditHeight]      = useState('')
  const [editTdee,        setEditTdee]        = useState('')
  const [editKcalTarget,  setEditKcalTarget]  = useState('')
  const [editProtRange,   setEditProtRange]   = useState('')
  const [editFatLossGoal, setEditFatLossGoal] = useState('')
  const [editEquipment,   setEditEquipment]   = useState('')
  const [editCycleType,   setEditCycleType]   = useState<UserBodyStats['cycleType']>('none')
  const [editChronotype,  setEditChronotype]  = useState<UserBodyStats['chronotype']>('intermediate')

  const openEditStats = () => {
    const s = storedStats
    setEditWeight(s.weightKg   ? String(s.weightKg)   : '')
    setEditBodyFat(s.bodyFatPct ? String(s.bodyFatPct) : '')
    setEditHeight(s.heightM    ? String(s.heightM)    : '')
    setEditTdee(s.tdeeKcal    ? String(s.tdeeKcal)   : '')
    setEditKcalTarget(s.kcalTarget  ? String(s.kcalTarget) : '')
    setEditProtRange(s.protRange   ?? '')
    setEditFatLossGoal(s.fatLossGoal ?? '')
    setEditEquipment(s.equipment   ?? '')
    setEditCycleType(s.cycleType   ?? 'none')
    setEditChronotype(s.chronotype ?? 'intermediate')
    setShowEditStats(true)
  }

  const saveStats = () => {
    bodyStatsStore.set({
      weightKg:    parseFloat(editWeight)      || 0,
      bodyFatPct:  parseFloat(editBodyFat)     || 0,
      heightM:     parseFloat(editHeight)      || 0,
      tdeeKcal:    parseInt(editTdee)          || 0,
      kcalTarget:  parseInt(editKcalTarget)    || 0,
      protRange:   editProtRange.trim(),
      fatLossGoal: editFatLossGoal.trim(),
      equipment:   editEquipment.trim(),
      cycleType:   editCycleType,
      chronotype:  editChronotype,
    })
    setShowEditStats(false)
  }

  // ── Stats strip data ─────────────────────────────────────────────
  const STATS = hasStats ? [
    { l: 'Weight',        v: `${storedStats.weightKg} kg`,             c: 'var(--text)' },
    { l: 'Body fat',      v: `${storedStats.bodyFatPct}%`,             c: 'var(--coral-light)' },
    { l: 'Fat mass',      v: `~${fatMass} kg`,                         c: 'var(--coral)' },
    { l: 'Lean mass',     v: `~${leanMass} kg`,                        c: 'var(--green-light)' },
    { l: 'Height',        v: `${storedStats.heightM} m`,               c: 'var(--text)' },
    { l: 'TDEE',          v: `~${storedStats.tdeeKcal.toLocaleString()} kcal`, c: 'var(--amber-light)' },
    { l: 'Daily target',  v: `~${storedStats.kcalTarget.toLocaleString()} kcal`, c: 'var(--green)' },
    { l: 'Protein target',v: storedStats.protRange || '—',             c: 'var(--blue-light)' },
    { l: 'Fat loss goal', v: storedStats.fatLossGoal || '—',           c: 'var(--green-light)' },
  ] : []

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
        <div style={{
          background: 'rgba(58,144,144,0.08)', border: '1px solid var(--teal)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>💡</span>
          <div>
            <span style={{ fontSize: 13, color: 'var(--teal-light)', fontWeight: 500 }}>
              Example plan · Full-body 3×/week
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)', marginLeft: 8 }}>
              Sign in to load your personalized programme.
            </span>
          </div>
        </div>
      )}

      {/* Plan subtitle */}
      <div style={{ marginBottom: 20 }}>
        {isAuth && (
          <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: planGender === 'female' ? 'var(--coral)' : 'var(--teal)', marginBottom: 5 }}>
            {planGender === 'female'
              ? 'Fat loss · Cycle-synced · Home + Pilates'
              : 'Strength · Full-body · Home'}
          </div>
        )}
        <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 26, fontWeight: 400, color: 'var(--text)', lineHeight: 1.2, marginBottom: 7 }}>
          {isAuth
            ? planGender === 'female'
              ? <><span>Her Fat Loss &amp; </span><em style={{ fontStyle: 'italic', color: 'var(--coral-light)' }}>Recomposition Plan</em></>
              : <><span>Full-Body </span><em style={{ fontStyle: 'italic', color: 'var(--teal-light)' }}>Strength Plan</em></>
            : <><span>Full-Body </span><em style={{ fontStyle: 'italic', color: 'var(--teal-light)' }}>3×/week Template</em></>
          }
        </div>
        {isAuth && hasStats && (
          <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 580, lineHeight: 1.6 }}>
            {storedStats.weightKg} kg · {storedStats.bodyFatPct}% body fat · {storedStats.heightM} m
            {storedStats.cycleType !== 'none' && ` · ${storedStats.cycleType} cycle`}
            {storedStats.equipment && ` · ${storedStats.equipment}`}
          </div>
        )}
        {!isAuth && (
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
            A 3-week progressive full-body template. Week 1 shows example exercises — create an account to save your own plan.
          </div>
        )}
      </div>

      {/* Stats strip (auth + has stats) */}
      {isAuth && hasStats && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: 8 }}>
            {STATS.map(s => (
              <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted2)', marginBottom: 4 }}>{s.l}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 500, color: s.c }}>{s.v}</div>
              </div>
            ))}
          </div>
          <button
            onClick={showEditStats ? () => setShowEditStats(false) : openEditStats}
            style={{
              background: 'none', border: '1px solid var(--border2)', borderRadius: 7,
              padding: '5px 14px', color: 'var(--muted)', fontSize: 11,
              fontFamily: '"DM Mono",monospace', cursor: 'pointer',
            }}
          >
            {showEditStats ? '✕ Cancel' : '✎ Edit stats'}
          </button>
        </div>
      )}

      {/* Setup prompt: auth but no stats yet */}
      {isAuth && !hasStats && !showEditStats && (
        <div style={{
          background: 'var(--bg2)', border: '1px dashed var(--border2)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 22, textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
            No body stats saved yet. Add your stats to personalise the plan header.
          </div>
          <button
            onClick={openEditStats}
            style={{
              background: 'var(--teal)', border: 'none', borderRadius: 7,
              padding: '8px 20px', color: '#fff', fontSize: 12,
              fontFamily: '"DM Mono",monospace', cursor: 'pointer',
            }}
          >
            Set up my stats
          </button>
        </div>
      )}

      {/* Edit stats panel */}
      {showEditStats && (
        <div style={{
          background: 'var(--bg2)', border: '1px solid var(--border2)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 22,
        }}>
          <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 14 }}>
            Edit body stats
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Weight (kg)</span>
              <input type="number" value={editWeight} onChange={e => setEditWeight(e.target.value)} placeholder="58" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Body fat %</span>
              <input type="number" value={editBodyFat} onChange={e => setEditBodyFat(e.target.value)} placeholder="25" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Height (m)</span>
              <input type="number" step="0.01" value={editHeight} onChange={e => setEditHeight(e.target.value)} placeholder="1.70" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>TDEE (kcal)</span>
              <input type="number" value={editTdee} onChange={e => setEditTdee(e.target.value)} placeholder="2000" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Daily target (kcal)</span>
              <input type="number" value={editKcalTarget} onChange={e => setEditKcalTarget(e.target.value)} placeholder="1600" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Protein target</span>
              <input type="text" value={editProtRange} onChange={e => setEditProtRange(e.target.value)} placeholder="120-140g/day" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Fat loss goal</span>
              <input type="text" value={editFatLossGoal} onChange={e => setEditFatLossGoal(e.target.value)} placeholder="0.4-0.5 kg/wk" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Equipment</span>
              <input type="text" value={editEquipment} onChange={e => setEditEquipment(e.target.value)} placeholder="Dumbbells, bands…" style={inputStyle} />
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Cycle type</span>
              <select value={editCycleType} onChange={e => setEditCycleType(e.target.value as UserBodyStats['cycleType'])} style={selectStyle}>
                <option value="none">None / N/A</option>
                <option value="regular">Regular</option>
                <option value="irregular">Irregular</option>
              </select>
            </label>
            <label style={labelStyle}>
              <span style={labelTextStyle}>Chronotype</span>
              <select value={editChronotype} onChange={e => setEditChronotype(e.target.value as UserBodyStats['chronotype'])} style={selectStyle}>
                <option value="early">Early bird</option>
                <option value="intermediate">Intermediate</option>
                <option value="late">Night owl (late)</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button
              onClick={saveStats}
              style={{ padding: '8px 20px', background: 'var(--teal)', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12, fontFamily: '"DM Mono",monospace', cursor: 'pointer' }}
            >
              Save
            </button>
            <button
              onClick={() => setShowEditStats(false)}
              style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border2)', borderRadius: 7, color: 'var(--muted)', fontSize: 12, fontFamily: '"DM Mono",monospace', cursor: 'pointer' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* 3-week rotating cycle (female + has cycle) */}
      {isAuth && planGender === 'female' && storedStats.cycleType !== 'none' && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--purple)', borderRadius: 12, padding: '14px 18px', marginBottom: 22 }}>
          <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: 7 }}>3-Week Rotating Cycle</div>
          <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
            Restart at <strong style={{ color: 'var(--text)' }}>Week 1</strong> whenever your period begins. The plan mirrors the four hormonal phases without requiring you to track exact days.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
            {PHASES_FEMALE.map(p => (
              <div key={p.n} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${p.c}` }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: p.c, marginBottom: 2 }}>{p.n}</div>
                <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{p.s}</div>
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

// ── Shared label styles ───────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
}
const labelTextStyle: React.CSSProperties = {
  fontSize: 10, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace',
  textTransform: 'uppercase', letterSpacing: '.1em',
}
