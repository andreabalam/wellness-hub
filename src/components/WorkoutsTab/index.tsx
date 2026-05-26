import { useState } from 'react'
import { WORKOUT_PLAN, PLAN_NOTES } from '../../data/workouts'
import type { Exercise } from '../../data/workouts'

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

export default function WorkoutsTab() {
  const [activeWeek, setActiveWeek] = useState(0)

  const wk = WORKOUT_PLAN[activeWeek]

  const STATS = [
    { l: 'Weight', v: '58 kg', c: 'var(--text)' },
    { l: 'Body fat', v: '35%', c: 'var(--coral-light)' },
    { l: 'Fat mass', v: '~20.3 kg', c: 'var(--coral)' },
    { l: 'Lean mass', v: '~37.7 kg', c: 'var(--green-light)' },
    { l: 'Height', v: '1.56 m', c: 'var(--text)' },
    { l: 'TDEE', v: '~1,680 kcal', c: 'var(--amber-light)' },
    { l: 'Daily target', v: '~1,380 kcal', c: 'var(--green)' },
    { l: 'Protein target', v: '105-115g/day', c: 'var(--blue-light)' },
    { l: 'Fat loss goal', v: '0.4-0.5 kg/wk', c: 'var(--green-light)' },
  ]

  const PHASES = [
    { n: 'Week 1 - Menstrual', s: 'Low intensity, Pilates focus', c: 'var(--purple)' },
    { n: 'Week 2 - Follicular', s: 'Build strength, peak energy', c: 'var(--green)' },
    { n: 'Week 3 - Luteal', s: 'Moderate load, glute shred', c: 'var(--amber)' },
    { n: 'Restart Week 1', s: 'When next period begins', c: 'var(--coral)' },
  ]

  return (
    <>
      {/* Subtitle */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--coral)', marginBottom: 5 }}>
          Fat loss · Cycle-synced · Home + Pilates
        </div>
        <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 26, fontWeight: 400, color: 'var(--text)', lineHeight: 1.2, marginBottom: 7 }}>
          Her Fat Loss &amp; <em style={{ fontStyle: 'italic', color: 'var(--coral-light)' }}>Recomposition Plan</em>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 580, lineHeight: 1.6 }}>
          58 kg · 35% body fat · 1.56 m · irregular cycle · 3, 5, 10 lb dumbbells + Pilates. Target: ~1,380 kcal/day, 0.4–0.5 kg fat/week. All sessions 4:30 PM (late chronotype peak).
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginBottom: 22 }}>
        {STATS.map(s => (
          <div key={s.l} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '11px 13px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: 9, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted2)', marginBottom: 4 }}>{s.l}</div>
            <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 500, color: s.c }}>{s.v}</div>
          </div>
        ))}
      </div>

      {/* 3-week rotating cycle */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--purple)', borderRadius: 12, padding: '14px 18px', marginBottom: 22 }}>
        <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--purple-light)', marginBottom: 7 }}>3-Week Rotating Cycle</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, marginBottom: 10 }}>
          Restart at <strong style={{ color: 'var(--text)' }}>Week 1</strong> whenever your period begins. The plan mirrors the four hormonal phases without requiring you to track exact days.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 8 }}>
          {PHASES.map(p => (
            <div key={p.n} style={{ padding: '9px 12px', borderRadius: 8, border: `1px solid ${p.c}` }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: p.c, marginBottom: 2 }}>{p.n}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>{p.s}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Week nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {WORKOUT_PLAN.map((w, i) => (
          <button
            key={w.week}
            onClick={() => setActiveWeek(i)}
            style={{
              background: 'var(--bg2)',
              border: `1px solid ${i === activeWeek ? w.color : 'var(--border)'}`,
              borderRadius: 8, padding: '7px 18px',
              fontFamily: 'sans-serif', fontSize: 13,
              color: i === activeWeek ? w.color : 'var(--muted)',
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
                  {day.exs.map((ex, ei) => (
                    <ExerciseRow key={ei} ex={ex} idx={ei} color={day.color} />
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace', textAlign: 'center', marginTop: 7 }}>
                    tap any exercise to expand
                  </div>

                  {/* Alt block */}
                  {day.alts && (
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

        {/* Plan notes (Week 1 only) */}
        {activeWeek === 0 && (
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
