import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTrackerStore, useFoodLibraryStore } from '../../hooks/useStore'
import {
  KCAL_TARGET, PROT_TARGET, CARB_TARGET, FAT_TARGET, FIBER_TARGET,
  QUICK_FOODS, SESSION_OPTS, MED_MINS, MED_STYLES, PHASE_NOTES,
} from '../../data/tracker'
import type { DayData, FoodEntry, QuickFood } from '../../data/tracker'

function dkey(d: Date) { return d.toISOString().split('T')[0] }

// ── Macro bar ────────────────────────────────────────────────────
function MacroBar({ label, sub, val, target, color, valColor }: {
  label: string; sub?: string; val: number; target: number
  color: string; valColor: string
}) {
  const pct = Math.min(100, Math.round(val / target * 100))
  const barColor = label === 'Calories' && pct > 105 ? 'var(--red)' : pct > 95 ? 'var(--amber)' : color
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>
          {label} {sub && <span style={{ color: 'var(--muted2)', fontSize: 10 }}>· {sub}</span>}
        </span>
        <span style={{ fontFamily: '"DM Mono",monospace', fontSize: 12 }}>
          <span style={{ color: valColor }}>{label === 'Calories' ? val.toLocaleString() : `${val}g`}</span>
          <span style={{ color: 'var(--muted2)' }}> / {label === 'Calories' ? `${target.toLocaleString()} kcal` : `${target}g`}</span>
        </span>
      </div>
      <div style={{ background: 'var(--bg3)', borderRadius: 4, height: 7, overflow: 'hidden' }}>
        <div style={{ height: '100%', background: barColor, borderRadius: 4, width: `${pct}%`, transition: 'width .4s' }} />
      </div>
      {label === 'Calories' && (
        <div style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 2 }}>
          <span style={{ color: 'var(--teal-light)' }}>{Math.max(0, target - val).toLocaleString()}</span> kcal remaining
        </div>
      )}
    </div>
  )
}

// ── Star picker ──────────────────────────────────────────────────
function StarRow({ value, onChange, emoji }: { value: number; onChange: (v: number) => void; emoji: string }) {
  return (
    <div style={{ display: 'flex', gap: 5 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          onClick={() => onChange(i === value ? 0 : i)}
          style={{
            width: 30, height: 30, borderRadius: 6,
            border: `1px solid ${i <= value ? 'var(--purple)' : 'var(--border)'}`,
            background: i <= value ? 'rgba(138,106,184,0.18)' : 'var(--bg3)',
            cursor: 'pointer', fontSize: 15, transition: 'all .15s',
          }}
        >
          {i <= value ? emoji : '·'}
        </button>
      ))}
    </div>
  )
}

// ── Week strip ───────────────────────────────────────────────────
function WeekStrip({ currentDate, onSelect, getDay }: {
  currentDate: Date
  onSelect: (d: Date) => void
  getDay: (key: string) => DayData
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const dow = (today.getDay() + 6) % 7
  const startW = new Date(today); startW.setDate(today.getDate() - dow)
  const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--muted2)', marginBottom: 12 }}>This week</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 5 }}>
        {DL.map((lbl, i) => {
          const d = new Date(startW); d.setDate(startW.getDate() + i)
          const k = dkey(d)
          const data = getDay(k)
          const kcal = data.foods.reduce((s, f) => s + f.k, 0)
          const hasW = !!data.workout
          const hasM = !!data.medMin
          const isToday = d.getTime() === today.getTime()
          const isCur = d.getTime() === currentDate.getTime()
          return (
            <div
              key={i}
              onClick={() => onSelect(new Date(d))}
              style={{
                background: 'var(--bg3)',
                border: `1px solid ${isCur ? 'var(--teal)' : isToday ? 'var(--border2)' : 'var(--border)'}`,
                borderRadius: 9, padding: '8px 3px', textAlign: 'center',
                cursor: 'pointer', transition: 'all .2s',
              }}
            >
              <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 10, color: isToday ? 'var(--teal-light)' : 'var(--muted2)', marginBottom: 2 }}>{lbl}</div>
              <div style={{ fontSize: 10, color: 'var(--muted2)', marginBottom: 3 }}>{d.getDate()}</div>
              <div style={{ fontSize: 10, fontFamily: '"DM Mono",monospace', color: kcal > 0 ? 'var(--green-light)' : 'var(--muted2)' }}>{kcal > 0 ? kcal : '-'}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                {hasW && <span style={{ color: 'var(--coral-light)' }}>W</span>}
                {hasM && <span style={{ color: 'var(--gold-light)' }}>M</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: '"DM Mono",monospace' }}><span style={{ color: 'var(--green-light)' }}>●</span> kcal</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: '"DM Mono",monospace' }}><span style={{ color: 'var(--coral-light)' }}>W</span> workout</span>
        <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: '"DM Mono",monospace' }}><span style={{ color: 'var(--gold-light)' }}>M</span> meditation</span>
      </div>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────
export default function TrackerTab() {
  const store    = useTrackerStore()
  const libStore = useFoodLibraryStore()
  const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0)

  const [date, setDate]           = useState<Date>(new Date(todayBase))
  const [day, setDay]             = useState<DayData>(() => store.getDay(dkey(todayBase)))
  const [fName, setFName]         = useState('')
  const [fKcal, setFKcal]         = useState('')
  const [fPro, setFPro]           = useState('')
  const [fCarb, setFCarb]         = useState('')
  const [fFat, setFat]            = useState('')
  const [fFiber, setFFiber]       = useState('')
  const [fServings, setFServings] = useState('1')
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [showSugg, setShowSugg]   = useState(false)
  const [foodLib, setFoodLib]     = useState<QuickFood[]>(() => libStore.getAll())
  const [selSession, setSess]     = useState<string | null>(null)
  const [wkNotes, setWkNotes]   = useState('')
  const [wkSaved, setWkSaved]   = useState(false)
  const [medMin, setMedMin]     = useState(0)
  const [medStyle, setMedStyle] = useState('')
  const [medSaved, setMedSaved] = useState(false)
  const [energy, setEnergy]     = useState(0)
  const [mood, setMood]         = useState(0)
  const [sleep, setSleep]       = useState(0)
  const [phase, setPhase]       = useState('')
  const [dayNotes, setDayNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [checkInSaved, setCheckInSaved] = useState(false)
  const [stripKey, setStripKey] = useState(0)
  const [innerTab, setInnerTab] = useState<'food' | 'workout' | 'meditation'>('food')

  const loadDate = useCallback((d: Date) => {
    const k = dkey(d)
    const data = store.getDay(k)
    setDay(data)
    setSess(data.workout ?? null)
    setWkNotes(data.wkNotes ?? '')
    setMedMin(data.medMin ?? 0)
    setMedStyle(data.medStyle ?? '')
    setEnergy(data.energy ?? 0)
    setMood(data.mood ?? 0)
    setSleep(data.sleep ?? 0)
    setPhase(data.phase ?? '')
    setDayNotes(data.notes ?? '')
    setWkSaved(!!data.workout)
    setMedSaved(!!data.medMin)
    setEditIndex(null)
    setFName(''); setFKcal(''); setFPro(''); setFCarb(''); setFat(''); setFFiber('')
    setFServings('1')
    setShowSugg(false)
  }, [store])

  useEffect(() => { loadDate(date) }, [date, loadDate])

  const save = useCallback((patch: Partial<DayData>) => {
    const k = dkey(date)
    const updated = { ...store.getDay(k), ...patch }
    store.setDay(k, updated)
    setDay(updated)
    setStripKey(n => n + 1)
  }, [date, store])

  // Totals
  const totals = day.foods.reduce(
    (acc, f) => ({ k: acc.k + f.k, p: acc.p + f.p, c: acc.c + f.c, f: acc.f + f.f, fi: acc.fi + f.fi }),
    { k: 0, p: 0, c: 0, f: 0, fi: 0 }
  )

  // Combined list: personal library first, then QUICK_FOODS not already in library
  const allFoodSuggestions: QuickFood[] = [
    ...foodLib,
    ...QUICK_FOODS.filter(qf => !foodLib.some(lf => lf.n.toLowerCase() === qf.n.toLowerCase())),
  ]
  const suggestions = fName.length >= 2
    ? allFoodSuggestions.filter(f => f.n.toLowerCase().includes(fName.toLowerCase())).slice(0, 8)
    : []

  const applySuggestion = (f: QuickFood) => {
    setFName(f.n)
    setFKcal(String(f.k))
    setFPro(String(f.p))
    setFCarb(String(f.c))
    setFat(String(f.f))
    setFFiber(String(f.fi))
    setShowSugg(false)
  }

  const startEdit = (i: number) => {
    const f = day.foods[i]
    const srv = f.s ?? 1
    setEditIndex(i)
    setFName(f.n)
    setFServings(String(srv))
    setFKcal(String(srv > 1 ? Math.round(f.k / srv) : f.k))
    setFPro(String(srv > 1 ? Math.round(f.p / srv) : f.p))
    setFCarb(String(srv > 1 ? Math.round(f.c / srv) : f.c))
    setFat(String(srv > 1 ? Math.round(f.f / srv) : f.f))
    setFFiber(String(srv > 1 ? Math.round(f.fi / srv) : f.fi))
    setShowSugg(false)
  }

  const cancelEdit = () => {
    setEditIndex(null)
    setFName(''); setFKcal(''); setFPro(''); setFCarb(''); setFat(''); setFFiber('')
    setFServings('1')
  }

  const addFood = () => {
    const nm = fName.trim()
    if (!nm || !fKcal) { alert('Enter a name and calories.'); return }
    const srv = Math.max(0.5, parseFloat(fServings) || 1)
    const perK = parseInt(fKcal) || 0
    const perP = parseInt(fPro) || 0
    const perC = parseInt(fCarb) || 0
    const perF = parseInt(fFat) || 0
    const perFi = parseInt(fFiber) || 0
    const entry: FoodEntry = {
      n: nm,
      k: Math.round(perK * srv), p: Math.round(perP * srv),
      c: Math.round(perC * srv), f: Math.round(perF * srv),
      fi: Math.round(perFi * srv),
      ...(srv !== 1 ? { s: srv } : {}),
    }
    // Upsert per-serving values into food library
    if (perK > 0) {
      const updated = libStore.upsert({ n: nm, k: perK, p: perP, c: perC, f: perF, fi: perFi })
      setFoodLib(updated)
    }
    if (editIndex !== null) {
      const foods = [...day.foods]
      foods[editIndex] = entry
      save({ foods })
      setEditIndex(null)
    } else {
      save({ foods: [...day.foods, entry] })
    }
    setFName(''); setFKcal(''); setFPro(''); setFCarb(''); setFat(''); setFFiber('')
    setFServings('1')
  }

  const removeFood = (i: number) => {
    if (editIndex === i) cancelEdit()
    const foods = day.foods.filter((_, j) => j !== i)
    save({ foods })
  }

  const quickAdd = (f: FoodEntry) => {
    save({ foods: [...day.foods, f] })
  }

  // Top 10 most-recently-seen unique meals across all logged days
  const recentMeals = useMemo(() => {
    const all = store.getAll()
    const sorted = Object.entries(all).sort(([a], [b]) => b.localeCompare(a))
    const seen = new Set<string>()
    const result: FoodEntry[] = []
    for (const [, d] of sorted) {
      for (const food of [...d.foods].reverse()) {
        const key = food.n.toLowerCase()
        if (!seen.has(key)) { seen.add(key); result.push(food) }
        if (result.length >= 10) break
      }
      if (result.length >= 10) break
    }
    return result
  }, [day, store])

  const logWorkout = () => {
    if (!selSession) { alert('Select a session type first.'); return }
    save({ workout: selSession, wkNotes })
    setWkSaved(true)
  }

  const logMed = () => {
    if (!medMin) { alert('Select a duration first.'); return }
    save({ medMin, medStyle })
    setMedSaved(true)
    setTimeout(() => setMedSaved(false), 1600)
  }

  const saveCheckIn = () => {
    save({ energy, mood, sleep, phase })
    setCheckInSaved(true)
    setTimeout(() => setCheckInSaved(false), 1600)
  }

  const saveNotes = () => {
    save({ notes: dayNotes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 1600)
  }

  const goDate = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
  }

  const goToday = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    setDate(d)
  }

  const phaseNote = PHASE_NOTES[phase] ?? PHASE_NOTES['']

  const [wide, setWide] = useState(window.innerWidth >= 680)
  useEffect(() => {
    const handler = () => setWide(window.innerWidth >= 680)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  return (
    <>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 26, fontWeight: 400, color: 'var(--text)' }}>
          My <em style={{ fontStyle: 'italic', color: 'var(--teal-light)' }}>Daily Tracker</em>
        </div>
      </div>

      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => goDate(-1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif' }}>‹ Prev</button>
        <div style={{ fontFamily: '"DM Mono",monospace', fontSize: 13, color: 'var(--text)', minWidth: 190, textAlign: 'center' }}>
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <button onClick={() => goDate(1)} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 14px', color: 'var(--muted)', cursor: 'pointer', fontSize: 13, fontFamily: 'sans-serif' }}>Next ›</button>
        <button onClick={goToday} style={{ background: 'rgba(58,144,144,0.1)', border: '1px solid var(--teal)', borderRadius: 8, padding: '6px 14px', color: 'var(--teal-light)', cursor: 'pointer', fontSize: 12, fontFamily: '"DM Mono",monospace' }}>TODAY</button>
      </div>

      {/* Week strip — always visible */}
      <WeekStrip
        key={stripKey}
        currentDate={date}
        onSelect={d => { d.setHours(0, 0, 0, 0); setDate(d) }}
        getDay={store.getDay}
      />

      {/* Inner tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginTop: 20, marginBottom: 16 }}>
        {(['food', 'workout', 'meditation'] as const).map(t => (
          <button
            key={t}
            onClick={() => setInnerTab(t)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '9px 20px',
              fontSize: 13, fontFamily: '"DM Sans",sans-serif', fontWeight: 500,
              color: innerTab === t ? 'var(--teal-light)' : 'var(--muted)',
              borderBottom: `2px solid ${innerTab === t ? 'var(--teal)' : 'transparent'}`,
              marginBottom: -1, whiteSpace: 'nowrap',
              transition: 'color .2s, border-color .2s',
              textTransform: 'capitalize',
            }}
          >
            {t === 'food' ? 'Food' : t === 'workout' ? 'Workout' : 'Meditation'}
          </button>
        ))}
      </div>

      {/* ── Food ── */}
      {innerTab === 'food' && (
        <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: 14 }}>

          {/* Macro summary */}
          <div className="tcard">
            <div className="tlabel" style={{ color: 'var(--muted2)' }}>Daily macro targets · fat loss + recomposition</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <MacroBar label="Calories" val={totals.k} target={KCAL_TARGET} color="var(--green)" valColor="var(--green-light)" />
              <MacroBar label="Protein" sub="muscle retention" val={totals.p} target={PROT_TARGET} color="var(--blue)" valColor="var(--blue-light)" />
              <MacroBar label="Carbs" sub="moderate-low" val={totals.c} target={CARB_TARGET} color="var(--amber)" valColor="var(--amber-light)" />
              <MacroBar label="Fat" sub="hormonal health" val={totals.f} target={FAT_TARGET} color="var(--coral)" valColor="var(--coral-light)" />
              <MacroBar label="Fiber" sub="satiety on deficit" val={totals.fi} target={FIBER_TARGET} color="var(--teal)" valColor="var(--teal-light)" />
            </div>
          </div>

          {/* Food log */}
          <div className="tcard">
            <div className="tlabel" style={{ color: 'var(--muted2)' }}>Meals logged</div>
            <div style={{ marginBottom: 12, minHeight: 30 }}>
              {day.foods.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted2)', fontStyle: 'italic', padding: '3px 0' }}>No meals logged yet.</div>
              ) : day.foods.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
                  borderBottom: '1px solid var(--border)',
                  background: editIndex === i ? 'rgba(184,150,58,0.06)' : 'none',
                  borderRadius: editIndex === i ? 6 : 0,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: 'var(--text)' }}>{f.n}{f.s && f.s !== 1 ? <span style={{ fontSize: 10, color: 'var(--muted2)', marginLeft: 5 }}>×{f.s} srv</span> : null}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)' }}>
                      {f.k} kcal · {f.p}g P · {f.c}g C · {f.f}g F{f.fi ? ` · ${f.fi}g fiber` : ''}
                    </div>
                  </div>
                  <button onClick={() => startEdit(i)} title="Edit" style={{ background: 'none', border: 'none', color: editIndex === i ? 'var(--amber-light)' : 'var(--muted2)', cursor: 'pointer', fontSize: 14, padding: '0 3px', lineHeight: 1 }}>✏</button>
                  <button onClick={() => removeFood(i)} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 19, padding: '0 4px', lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 12 }}>
              {editIndex !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'rgba(184,150,58,0.1)', border: '1px solid var(--amber)', borderRadius: 7, marginBottom: 8, fontSize: 11 }}>
                  <span style={{ color: 'var(--amber-light)', fontFamily: '"DM Mono",monospace' }}>Editing: {day.foods[editIndex]?.n}</span>
                  <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    className="tinput"
                    value={fName}
                    onChange={e => { setFName(e.target.value); setShowSugg(true) }}
                    onFocus={() => setShowSugg(true)}
                    onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                    placeholder="Meal name (e.g. Berry Oats)"
                    style={{ marginBottom: 0, width: '100%' }}
                  />
                  {showSugg && suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.3)', overflow: 'hidden', marginTop: 2 }}>
                      {suggestions.map(f => (
                        <button
                          key={f.n}
                          onMouseDown={() => applySuggestion(f)}
                          style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 11px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer', fontSize: 12 }}
                        >
                          {f.n}
                          <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--muted)', marginLeft: 8 }}>
                            {f.k} kcal · {f.p}g P · {f.c}g C · {f.f}g F
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace', letterSpacing: '.08em', whiteSpace: 'nowrap' }}>SRV</span>
                <input className="tnum" type="number" min="0.5" step="0.5" placeholder="1" value={fServings} onChange={e => setFServings(e.target.value)} style={{ width: 36, padding: '7px 4px', textAlign: 'center' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 5, marginBottom: 3 }}>
                {([['kcal', fKcal, setFKcal], ['prot', fPro, setFPro], ['carb', fCarb, setFCarb], ['fat', fFat, setFat], ['fiber', fFiber, setFFiber]] as [string, string, (v: string) => void][]).map(([ph, val, set]) => (
                  <input key={ph} className="tnum" type="number" min="0" placeholder={ph} value={val} onChange={e => set(e.target.value)} />
                ))}
              </div>
              <div style={{ fontSize: 9, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace', marginBottom: 8 }}>per serving</div>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 5 }}>Quick-add from recent meals:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                {recentMeals.length === 0 ? (
                  <span style={{ fontSize: 10, color: 'var(--muted2)', fontStyle: 'italic' }}>Meals you log will appear here.</span>
                ) : recentMeals.map((f, i) => (
                  <button key={i} onClick={() => quickAdd(f)} style={{ fontSize: 10, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', cursor: 'pointer', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                    {f.n} ({f.k}{f.s && f.s !== 1 ? ` ×${f.s}srv` : ''})
                  </button>
                ))}
              </div>
              <button onClick={addFood} className="tbtn" style={{ background: editIndex !== null ? 'var(--amber)' : 'var(--teal)', color: '#fff' }}>
                {editIndex !== null ? '✓ Save changes' : '+ Log food'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Workout ── */}
      {innerTab === 'workout' && (
        <div className="tcard">
          <div className="tlabel" style={{ color: 'var(--coral)' }}>Workout log · 4:30 PM</div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 7, lineHeight: 1.5 }}>
            {phaseNote}
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 7 }}>Session type:</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            {SESSION_OPTS.map(s => (
              <button
                key={s.id}
                onClick={() => setSess(selSession === s.id ? null : s.id)}
                style={{
                  fontSize: 12, padding: '5px 11px', borderRadius: 7,
                  border: `1px solid ${selSession === s.id ? s.color : 'var(--border)'}`,
                  background: selSession === s.id ? `${s.color}20` : 'var(--bg3)',
                  color: selSession === s.id ? s.color : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all .15s',
                }}
              >{s.label}</button>
            ))}
          </div>
          {wkSaved && day.workout && (
            <div style={{ padding: '10px 12px', background: 'rgba(76,175,125,0.06)', border: '1px solid var(--green2)', borderRadius: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: 'var(--green-light)', fontWeight: 500, marginBottom: 3 }}>✓ Session logged</div>
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                {SESSION_OPTS.find(s => s.id === day.workout)?.label ?? day.workout}
                {day.wkNotes ? ` - ${day.wkNotes.substring(0, 70)}` : ''}
              </div>
            </div>
          )}
          <textarea className="tinput" value={wkNotes} onChange={e => setWkNotes(e.target.value)} placeholder="How did it feel? PRs? Modifications?" rows={3} style={{ resize: 'vertical', marginBottom: 8 }} />
          <button onClick={logWorkout} className="tbtn" style={{ background: 'var(--coral)', color: '#fff' }}>+ Log workout</button>
        </div>
      )}

      {/* ── Meditation ── */}
      {innerTab === 'meditation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Meditation */}
          <div className="tcard">
            <div className="tlabel" style={{ color: 'var(--gold)' }}>Meditation · 8:45 AM</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10, lineHeight: 1.5 }}>Optimal post-CAR window. Even 13 minutes measurably improves focus and working memory for hours.</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Duration:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {MED_MINS.map(m => (
                <button key={m} onClick={() => setMedMin(medMin === m ? 0 : m)} style={{
                  fontSize: 12, padding: '5px 12px', borderRadius: 7,
                  border: `1px solid ${medMin === m ? 'var(--gold)' : 'var(--border)'}`,
                  background: medMin === m ? 'rgba(184,150,58,0.15)' : 'var(--bg3)',
                  color: medMin === m ? 'var(--gold-light)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'monospace', transition: 'all .15s',
                }}>{m} min</button>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Style:</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {MED_STYLES.map(s => (
                <button key={s} onClick={() => setMedStyle(medStyle === s ? '' : s)} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                  border: `1px solid ${medStyle === s ? 'var(--gold)' : 'var(--border)'}`,
                  background: medStyle === s ? 'rgba(184,150,58,0.1)' : 'var(--bg3)',
                  color: medStyle === s ? 'var(--gold-light)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all .15s',
                }}>{s}</button>
              ))}
            </div>
            {day.medMin > 0 && (
              <div style={{ display: 'block', padding: '8px 10px', background: 'rgba(184,150,58,0.08)', border: '1px solid var(--gold)', borderRadius: 7, fontSize: 12, color: 'var(--gold-light)', marginBottom: 8 }}>
                Done: {day.medMin} min{day.medStyle ? ` - ${day.medStyle}` : ''}
              </div>
            )}
            <button onClick={logMed} className="tbtn" style={{ background: medSaved ? 'rgba(184,150,58,0.2)' : 'var(--bg3)', border: '1px solid var(--gold)', color: 'var(--gold-light)' }}>
              {medSaved ? 'Saved!' : 'Log meditation'}
            </button>
          </div>

          {/* Daily check-in */}
          <div className="tcard">
            <div className="tlabel" style={{ color: 'var(--purple)' }}>Daily check-in</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Energy ⚡</div>
                <StarRow value={energy} onChange={setEnergy} emoji="E" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Mood 😊</div>
                <StarRow value={mood} onChange={setMood} emoji="M" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Sleep 🌙</div>
                <StarRow value={sleep} onChange={setSleep} emoji="Z" />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Cycle phase</div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {(['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'Unsure'] as const).map((p, i) => {
                    const colors = ['var(--purple)', 'var(--green)', 'var(--teal)', 'var(--amber)', 'var(--muted2)']
                    const active = phase === p
                    return (
                      <button key={p} onClick={() => setPhase(active ? '' : p)} style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6,
                        border: `1px solid ${active ? colors[i] : 'var(--border)'}`,
                        background: active ? `${colors[i]}20` : 'var(--bg3)',
                        color: active ? colors[i] : 'var(--muted)',
                        cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all .15s',
                      }}>{p}</button>
                    )
                  })}
                </div>
              </div>
              <button onClick={saveCheckIn} className="tbtn" style={{ background: checkInSaved ? 'var(--green)' : 'var(--purple)', color: '#fff' }}>
                {checkInSaved ? 'Saved!' : 'Save check-in'}
              </button>
            </div>
          </div>

          {/* Day notes */}
          <div className="tcard">
            <div className="tlabel" style={{ color: 'var(--muted2)' }}>Day notes</div>
            <textarea className="tinput" value={dayNotes} onChange={e => setDayNotes(e.target.value)} placeholder="Cravings, how the workout felt, anything worth noting..." rows={4} style={{ resize: 'vertical', marginBottom: 8 }} />
            <button onClick={saveNotes} className="tbtn" style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', color: notesSaved ? 'var(--green-light)' : 'var(--muted)' }}>
              {notesSaved ? 'Saved!' : 'Save notes'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
