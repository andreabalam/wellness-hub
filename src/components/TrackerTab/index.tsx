import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import type { User } from '@supabase/supabase-js'
import { useTrackerStore, useFoodLibraryStore, bodyStatsStore, MED_GUIDES_KEY, useUserSettingsStore } from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import type { MedGuide } from '../../lib/sync'
import { macrosFromKcal } from '../../lib/stats'
import ProfileStatsCard from './ProfileStatsCard'
import {
  QUICK_FOODS, SESSION_OPTS, MED_MINS, MED_STYLES, PHASE_NOTES,
} from '../../data/tracker'
import type { DayData, FoodEntry, QuickFood } from '../../data/tracker'
import {
  isOuraConnected,
  fetchOuraWorkouts, fetchOuraReadiness, fetchOuraSessions, fetchOuraSleep,
  OURA_ACTIVITY_MAP, OURA_SESSION_MAP, roundToMedMin,
  readinessColor, readinessLabel, sleepScoreToStars,
} from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { safeGet, safeSet } from '../../lib/storage'
import { analyzeImage } from '../../lib/analyzeFood'
import type { PhotoAnalysisResult } from '../../lib/analyzeFood'
import RemindersSection from './RemindersSection'

function dkey(d: Date) { return d.toISOString().split('T')[0] }

// ── Oura readiness cache (one entry per date) ─────────────────────
const READINESS_CACHE_KEY = 'whub_oura_readiness_v1'
function getCachedReadiness(date: string): OuraReadiness | null {
  return safeGet<Record<string, OuraReadiness>>(READINESS_CACHE_KEY, {})[date] ?? null
}
function setCachedReadiness(date: string, data: OuraReadiness): void {
  const all = safeGet<Record<string, OuraReadiness>>(READINESS_CACHE_KEY, {})
  all[date] = data
  safeSet(READINESS_CACHE_KEY, all)
}


// ── Meditation guides ────────────────────────────────────────────
const DEFAULT_GUIDES: MedGuide[] = [
  { title: 'Guided Meditation · Session 1', url: 'https://www.youtube.com/watch?v=_nfMuLIpRus&list=PLSGCbLKMPkC1I1jnlSKIqCllxhRu2fNTN&index=1' },
  { title: 'Guided Meditation · Session 2', url: 'https://www.youtube.com/watch?v=UFFx_b-rpOE&list=PLSGCbLKMPkC1I1jnlSKIqCllxhRu2fNTN&index=2' },
]
function loadGuides(): MedGuide[] {
  try { return JSON.parse(localStorage.getItem(MED_GUIDES_KEY) ?? 'null') ?? DEFAULT_GUIDES }
  catch { return DEFAULT_GUIDES }
}
async function saveGuides(g: MedGuide[]) {
  localStorage.setItem(MED_GUIDES_KEY, JSON.stringify(g))
  if (!supabase) return
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) sync.pushMedGuides(user.id, g).catch(() => { /* offline */ })
  } catch { /* ignore */ }
}

// ── Macro bar ────────────────────────────────────────────────────
const MacroBar = memo(function MacroBar({ label, sub, val, target, color, valColor }: {
  label: string; sub?: string; val: number; target: number
  color: string; valColor: string
}) {
  const pct = Math.min(100, Math.round(val / target * 100))
  const barColor = label === 'Calories' && pct > 105 ? 'var(--red)' : pct > 95 ? 'var(--amber)' : color
  return (
    <div>
      <div className="macro-bar-header">
        <span className="macro-bar-label">
          {label} {sub && <span className="text-muted2" style={{ fontSize: 10 }}>· {sub}</span>}
        </span>
        <span className="macro-bar-val">
          <span style={{ color: valColor }}>{label === 'Calories' ? val.toLocaleString() : `${val}g`}</span>
          <span className="text-muted2"> / {label === 'Calories' ? `${target.toLocaleString()} kcal` : `${target}g`}</span>
        </span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ background: barColor, width: `${pct}%` }} />
      </div>
      {label === 'Calories' && (
        <div className="macro-bar-remaining">
          <span className="text-teal">{Math.max(0, target - val).toLocaleString()}</span> kcal remaining
        </div>
      )}
    </div>
  )
})

// ── Star picker ──────────────────────────────────────────────────
const StarRow = memo(function StarRow({ value, onChange, emoji }: { value: number; onChange: (v: number) => void; emoji: string }) {
  return (
    <div className="flex gap-6">
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
})

// ── Week strip ───────────────────────────────────────────────────
const WeekStrip = memo(function WeekStrip({ currentDate, onSelect, getDay }: {
  currentDate: Date
  onSelect: (d: Date) => void
  getDay: (key: string) => DayData
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  // Build week around currentDate (not always today) so Prev/Next navigate the strip too
  const cur = new Date(currentDate); cur.setHours(0, 0, 0, 0)
  const dow = (cur.getDay() + 6) % 7
  const startW = new Date(cur); startW.setDate(cur.getDate() - dow)
  const DL = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  // Label: "This week" when showing the current calendar week, otherwise show the range
  const todayDow = (today.getDay() + 6) % 7
  const startOfThisWeek = new Date(today); startOfThisWeek.setDate(today.getDate() - todayDow)
  const isThisWeek = startW.getTime() === startOfThisWeek.getTime()
  const endW = new Date(startW); endW.setDate(startW.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const weekLabel = isThisWeek ? 'This week' : `${fmt(startW)} – ${fmt(endW)}`

  return (
    <div className="tcard">
      <div className="week-strip-header">{weekLabel}</div>
      <div className="week-strip-grid">
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
              className={`week-strip-cell ${isCur ? 'week-strip-cell--cur' : isToday ? 'week-strip-cell--today' : ''}`}
            >
              <div className={`font-mono ${isToday ? 'text-teal' : 'text-muted2'}`} style={{ fontSize: 10, marginBottom: 2 }}>{lbl}</div>
              <div className="text-muted2" style={{ fontSize: 10, marginBottom: 3 }}>{d.getDate()}</div>
              <div className={`font-mono ${kcal > 0 ? 'text-green' : 'text-muted2'}`} style={{ fontSize: 10 }}>{kcal > 0 ? kcal : '-'}</div>
              <div style={{ fontSize: 11, marginTop: 2 }}>
                {hasW && <span className="text-coral">W</span>}
                {hasM && <span className="text-gold">M</span>}
              </div>
            </div>
          )
        })}
      </div>
      <div className="week-strip-legend">
        <span><span className="text-green">●</span> kcal</span>
        <span><span className="text-coral">W</span> workout</span>
        <span><span className="text-gold">M</span> meditation</span>
      </div>
    </div>
  )
})

// ── Main component ───────────────────────────────────────────────
export default function TrackerTab({ user }: { user?: User | null }) {
  const store         = useTrackerStore()
  const libStore      = useFoodLibraryStore()
  const settingsStore = useUserSettingsStore()
  const todayBase = new Date(); todayBase.setHours(0, 0, 0, 0)

  const [targets]                 = useState(() => settingsStore.get())
  // Macro bar targets: prefer bodyStats (with macroSplit) over legacy settings
  const [statsSeed, setStatsSeed] = useState(0)  // increment to force re-read after ProfileStatsCard save
  const activeStats = bodyStatsStore.get()
  const activeMacros = macrosFromKcal(activeStats.kcalTarget, (activeStats.macroSplit as import('../../lib/stats').MacroSplit) || 'balanced')
  const activeKcalTarget  = activeStats.kcalTarget  || targets.kcalTarget
  const activeProtTarget  = activeMacros?.prot  ?? targets.protTarget
  const activeCarbTarget  = activeMacros?.carb  ?? targets.carbTarget
  const activeFatTarget   = activeMacros?.fat   ?? targets.fatTarget
  const activeFiberTarget = activeMacros?.fiber ?? targets.fiberTarget

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
  const [photoStatus, setPhotoStatus] = useState<'idle' | 'detecting' | 'reading' | 'identifying' | 'error'>('idle')
  const [photoNotes, setPhotoNotes]   = useState<string>('')
  const [photoConfidence, setPhotoConfidence] = useState<PhotoAnalysisResult['confidence'] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // Meditation guides
  const [guides, setGuides]             = useState<MedGuide[]>(loadGuides)
  const [newGuideTitle, setNewGuideTitle] = useState('')
  const [newGuideUrl, setNewGuideUrl]     = useState('')
  const [showAddGuide, setShowAddGuide]   = useState(false)

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
    setPhotoStatus('idle'); setPhotoNotes(''); setPhotoConfidence(null)
  }, [store])

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    setPhotoStatus('idle'); setPhotoNotes(''); setPhotoConfidence(null)
  }

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPhotoStatus('detecting')
    setPhotoNotes(''); setPhotoConfidence(null)
    try {
      const result = await analyzeImage(file, msg => {
        if (msg === 'Detecting…')       setPhotoStatus('detecting')
        else if (msg === 'Reading label…') setPhotoStatus('reading')
        else                            setPhotoStatus('identifying')
      })
      setFName(result.name)
      setFKcal(String(result.kcal))
      setFPro(String(result.protein))
      setFCarb(String(result.carbs))
      setFat(String(result.fat))
      setFFiber(String(result.fiber))
      setFServings(String(result.servings))
      setPhotoNotes(result.notes)
      setPhotoConfidence(result.confidence)
      setPhotoStatus('idle')
    } catch {
      setPhotoStatus('error')
      setPhotoNotes('Could not identify — fill in manually.')
    }
  }, [])

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, day])

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

  const addGuide = () => {
    const url = newGuideUrl.trim()
    if (!url) return
    const title = newGuideTitle.trim() || url
    const updated = [...guides, { title, url }]
    setGuides(updated); saveGuides(updated)
    setNewGuideTitle(''); setNewGuideUrl(''); setShowAddGuide(false)
  }

  const removeGuide = (i: number) => {
    const updated = guides.filter((_, j) => j !== i)
    setGuides(updated); saveGuides(updated)
  }

  const goDate = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
  }

  const phaseNote = PHASE_NOTES[phase] ?? PHASE_NOTES['']


  // ── Oura state ──────────────────────────────────────────────────
  const [ouraConnected, setOuraConnected]     = useState(false)
  const [readiness, setReadiness]             = useState<OuraReadiness | null>(null)
  const [wkSyncing, setWkSyncing]             = useState(false)
  const [medSyncing, setMedSyncing]           = useState(false)
  const [ouraHRV, setOuraHRV]               = useState<number | null>(null)
  const [ouraHR, setOuraHR]                 = useState<number | null>(null)
  const [ouraMood, setOuraMood]             = useState<string | null>(null)
  const [ouraActualMin, setOuraActualMin]   = useState<number | null>(null)

  // Check connection status on mount
  useEffect(() => {
    isOuraConnected().then(setOuraConnected).catch(() => {})
  }, [])

  // Load readiness from cache on date change; auto-fetch from Oura if not cached
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setOuraHRV(null); setOuraHR(null); setOuraMood(null); setOuraActualMin(null)
    const dateStr = dkey(date)
    const cached = getCachedReadiness(dateStr)
    if (cached) {
      setReadiness(cached)
    } else {
      setReadiness(null)
      if (ouraConnected) {
        fetchOuraReadiness(dateStr)
          .then(data => {
            if (data) { setCachedReadiness(dateStr, data); setReadiness(data) }
          })
          .catch(() => {})
      }
    }
  }, [date, ouraConnected])
  /* eslint-enable react-hooks/set-state-in-effect */

  const syncWorkoutFromOura = async () => {
    setWkSyncing(true)
    try {
      const dateStr = dkey(date)
      const [workouts, readinessData] = await Promise.all([
        fetchOuraWorkouts(dateStr),
        fetchOuraReadiness(dateStr),
      ])
      if (readinessData) { setCachedReadiness(dkey(date), readinessData); setReadiness(readinessData) }
      if (workouts.length === 0) {
        if (!readinessData) alert('No Oura data found for this date.')
        return
      }
      const w = workouts[0]
      const mapped = OURA_ACTIVITY_MAP[w.activity] ?? null
      if (mapped) setSess(mapped)
      const dMin = Math.round(
        (new Date(w.end_datetime).getTime() - new Date(w.start_datetime).getTime()) / 60000
      )
      const hrNote = w.average_heart_rate ? ` · avg HR ${w.average_heart_rate} bpm` : ''
      setWkNotes(`Oura: ${w.activity.replace(/_/g, ' ')} · ${dMin} min${hrNote}`)
    } catch (err: unknown) {
      alert(`Oura sync failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setWkSyncing(false)
    }
  }

  const syncMedFromOura = async () => {
    setMedSyncing(true)
    try {
      const sessions = await fetchOuraSessions(dkey(date))
      const med = sessions.find(s => s.type !== 'nap')
      if (!med) { alert('No meditation session found for this date in Oura.'); return }
      const dSec = (new Date(med.end_datetime).getTime() - new Date(med.start_datetime).getTime()) / 1000
      setMedMin(roundToMedMin(dSec))
      if (OURA_SESSION_MAP[med.type]) setMedStyle(OURA_SESSION_MAP[med.type])
      setOuraHRV(med.average_hrv); setOuraHR(med.average_heart_rate)
      setOuraMood(med.mood); setOuraActualMin(Math.round(dSec / 60))
    } catch (err: unknown) {
      alert(`Oura sync failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setMedSyncing(false)
    }
  }

  // Auto-populate sleep stars from Oura when switching to check-in view
  const syncSleepFromOura = useCallback(async () => {
    if (!ouraConnected || sleep > 0) return   // don't overwrite manually-set value
    try {
      const data = await fetchOuraSleep(dkey(date))
      if (data) setSleep(sleepScoreToStars(data.score))
    } catch { /* silent — sleep sync is best-effort */ }
  }, [ouraConnected, sleep, date])

  const [wide, setWide] = useState(window.innerWidth >= 680)
  useEffect(() => {
    const handler = () => setWide(window.innerWidth >= 680)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  if (!user) {
    return (
      <div className="guest-gate-cta">
        <div className="guest-gate-cta__icon">🔒</div>
        <div className="section-title mb-8">
          Sign in to use <em className="text-teal">Tracker</em>
        </div>
        <div className="guest-gate-cta__body">
          Log meals, track macros and monitor your daily progress. Your data stays private and syncs across devices.
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Header */}
      <div className="mb-16">
        <div className="page-title">
          My <em className="italic text-teal">Daily Tracker</em>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center gap-10 mb-16 flex-wrap">
        <button onClick={() => goDate(-1)} className="date-nav-btn">‹ Prev</button>
        <div className="date-display">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <button onClick={() => goDate(1)} className="date-nav-btn">Next ›</button>
      </div>

      {/* Week strip — always visible */}
      <WeekStrip
        key={stripKey}
        currentDate={date}
        onSelect={d => { d.setHours(0, 0, 0, 0); setDate(d) }}
        getDay={store.getDay}
      />

      {/* Inner tabs */}
      <div className="flex inner-tab-bar">
        {(['food', 'workout', 'meditation'] as const).map(t => (
          <button
            key={t}
            onClick={() => setInnerTab(t)}
            className={`inner-tab${innerTab === t ? ' active' : ''}`}
          >
            {t === 'food' ? 'Food' : t === 'workout' ? 'Workout' : 'Meditation'}
          </button>
        ))}
      </div>

      {/* ── Food ── */}
      {innerTab === 'food' && (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: wide ? '1fr 1fr' : '1fr', gap: 14 }}>

          {/* Macro summary */}
          <div className="tcard">
            <div className="tlabel text-muted2">Daily targets</div>
            <div className="flex flex-col gap-10">
              <MacroBar label="Calories" val={totals.k} target={activeKcalTarget} color="var(--green)" valColor="var(--green-light)" />
              <MacroBar label="Protein" sub="muscle retention" val={totals.p} target={activeProtTarget} color="var(--blue)" valColor="var(--blue-light)" />
              <MacroBar label="Carbs" sub="moderate-low" val={totals.c} target={activeCarbTarget} color="var(--amber)" valColor="var(--amber-light)" />
              <MacroBar label="Fat" sub="hormonal health" val={totals.f} target={activeFatTarget} color="var(--coral)" valColor="var(--coral-light)" />
              <MacroBar label="Fiber" sub="satiety on deficit" val={totals.fi} target={activeFiberTarget} color="var(--teal)" valColor="var(--teal-light)" />
            </div>
          </div>

          {/* Food log */}
          <div className="tcard">
            <div className="tlabel text-muted2">Meals logged</div>
            <div className="mb-12" style={{ minHeight: 30 }}>
              {day.foods.length === 0 ? (
                <div className="text-base text-muted2 italic" style={{ padding: '3px 0' }}>No meals logged yet.</div>
              ) : day.foods.map((f, i) => (
                <div
                  key={i}
                  className={`food-log-item ${editIndex === i ? 'food-log-item--editing' : ''}`}
                >
                  <div className="flex-1">
                    <div className="text-base text-default">{f.n}{f.s && f.s !== 1 ? <span className="text-muted2 text-2xs" style={{ marginLeft: 5 }}>×{f.s} srv</span> : null}</div>
                    <div className="food-log-meta">{f.k} kcal · {f.p}g P · {f.c}g C · {f.f}g F{f.fi ? ` · ${f.fi}g fiber` : ''}</div>
                  </div>
                  <button onClick={() => startEdit(i)} title="Edit" className={`food-edit-btn ${editIndex === i ? 'active' : ''}`}>✏</button>
                  <button onClick={() => removeFood(i)} className="food-remove-btn">×</button>
                </div>
              ))}
            </div>
            <div style={{ paddingTop: 12 }}>
              {/* Hidden file input for photo capture */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoSelect}
              />

              {/* Photo status banner */}
              {(photoStatus !== 'idle' || photoNotes) && (
                <div style={{
                  fontSize: 11, marginBottom: 8, padding: '5px 9px', borderRadius: 6,
                  background: photoStatus === 'error' || photoConfidence === 'low'
                    ? 'rgba(184,150,58,0.08)' : 'var(--bg3)',
                  border: `1px solid ${photoStatus === 'error' || photoConfidence === 'low'
                    ? 'var(--amber)' : 'var(--border)'}`,
                  color: photoStatus === 'error' || photoConfidence === 'low'
                    ? 'var(--amber-light)' : 'var(--muted2)',
                  fontFamily: '"DM Mono",monospace',
                }}>
                  {photoStatus === 'detecting'   && '● Detecting…'}
                  {photoStatus === 'reading'     && '● Reading label…'}
                  {photoStatus === 'identifying' && '● Identifying food…'}
                  {photoStatus === 'error'       && photoNotes}
                  {photoStatus === 'idle'        && photoNotes}
                </div>
              )}

              {editIndex !== null && (
                <div className="edit-indicator">
                  <span className="text-amber font-mono">Editing: {day.foods[editIndex]?.n}</span>
                  <button onClick={cancelEdit} className="item-icon-btn text-xs">Cancel</button>
                </div>
              )}
              <div className="flex gap-6 mb-8 items-center">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoStatus !== 'idle'}
                  title="Analyze food photo or nutrition label"
                  style={{
                    flexShrink: 0, width: 32, height: 32, borderRadius: 7,
                    border: '1px solid var(--border)', background: 'var(--bg3)',
                    color: photoStatus !== 'idle' ? 'var(--muted2)' : 'var(--teal-light)',
                    cursor: photoStatus !== 'idle' ? 'default' : 'pointer',
                    fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all .15s',
                  }}
                >
                  {photoStatus !== 'idle' ? '⏳' : '📷'}
                </button>
                <div className="autocomplete-wrap">
                  <input
                    className="tinput w-full"
                    value={fName}
                    onChange={e => { setFName(e.target.value); setShowSugg(true) }}
                    onFocus={() => setShowSugg(true)}
                    onBlur={() => setTimeout(() => setShowSugg(false), 150)}
                    placeholder="Meal name (e.g. Berry Oats)"
                  />
                  {showSugg && suggestions.length > 0 && (
                    <div className="autocomplete-dropdown">
                      {suggestions.map(f => (
                        <button
                          key={f.n}
                          onMouseDown={() => applySuggestion(f)}
                          className="autocomplete-item"
                        >
                          {f.n}
                          <span className="autocomplete-hint">
                            {f.k} kcal · {f.p}g P · {f.c}g C · {f.f}g F
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <span className="font-mono text-muted2 text-2xs tracking-8 no-wrap">SRV</span>
                <input className="tnum" type="number" min="0.5" step="0.5" placeholder="1" value={fServings} onChange={e => setFServings(e.target.value)} style={{ width: 36, textAlign: 'center' }} />
              </div>
              <div className="macro-inputs-grid">
                {([['kcal', fKcal, setFKcal], ['prot', fPro, setFPro], ['carb', fCarb, setFCarb], ['fat', fFat, setFat], ['fiber', fFiber, setFFiber]] as [string, string, (v: string) => void][]).map(([ph, val, set]) => (
                  <input
                    key={ph} className={`tnum ${photoConfidence === 'low' || photoConfidence === 'medium' ? 'input-warn' : ''}`} type="number" min="0"
                    placeholder={ph} value={val} onChange={e => set(e.target.value)}
                  />
                ))}
              </div>
              <div className="font-mono text-muted2 text-2xs mb-8">per serving</div>
              <div className="text-xs text-muted2 mb-6">Quick-add from recent meals:</div>
              <div className="flex flex-wrap gap-6 mb-8">
                {recentMeals.length === 0 ? (
                  <span className="text-muted2 italic text-2xs">Meals you log will appear here.</span>
                ) : recentMeals.map((f, i) => (
                  <button key={i} onClick={() => quickAdd(f)} className="quick-food-btn">
                    {f.n} ({f.k}{f.s && f.s !== 1 ? ` ×${f.s}srv` : ''})
                  </button>
                ))}
              </div>
              <button onClick={addFood} className={`tbtn ${editIndex !== null ? 'tbtn--amber' : 'tbtn--teal'}`}>
                {editIndex !== null ? '✓ Save changes' : '+ Log food'}
              </button>
            </div>
          </div>
        </div>

        {/* Profile & Targets — consolidated stats module */}
        <ProfileStatsCard
          key={statsSeed}
          user={user ?? null}
          onSaved={() => setStatsSeed(n => n + 1)}
        />
        </>
      )}

      {/* ── Workout ── */}
      {innerTab === 'workout' && (
        <div className="tcard">
          <div className="flex-between mb-6">
            <div className="tlabel" style={{ color: 'var(--coral)', marginBottom: 0 }}>Workout log · 4:30 PM</div>
            {ouraConnected && (
              <button
                onClick={syncWorkoutFromOura}
                disabled={wkSyncing}
                className={`oura-sync-btn oura-sync-btn--teal ${wkSyncing ? 'loading' : ''}`}
              >
                {wkSyncing ? 'Syncing…' : '⟳ Sync Oura'}
              </button>
            )}
          </div>

          {/* Readiness badge */}
          {readiness && (
            <div className="readiness-badge" style={{ border: `1px solid ${readinessColor(readiness.score)}40` }}>
              <div
                className="readiness-score flex-center"
                style={{
                  background: `${readinessColor(readiness.score)}20`,
                  border: `2px solid ${readinessColor(readiness.score)}`,
                  color: readinessColor(readiness.score),
                }}
              >{readiness.score}</div>
              <div>
                <div className="text-sm font-600" style={{ color: readinessColor(readiness.score) }}>{readinessLabel(readiness.score)}</div>
                <div className="font-mono text-muted2 text-2xs">HRV balance {readiness.contributors.hrv_balance} · Recovery {readiness.contributors.recovery_index}</div>
              </div>
            </div>
          )}

          <div className="phase-note">{phaseNote}</div>
          <div className="text-sm text-muted mb-8">Session type:</div>
          <div className="flex flex-wrap gap-6 mb-10">
            {SESSION_OPTS.map(s => (
              <button
                key={s.id}
                onClick={() => setSess(selSession === s.id ? null : s.id)}
                className="session-type-btn"
                style={{
                  border: `1px solid ${selSession === s.id ? s.color : 'var(--border)'}`,
                  background: selSession === s.id ? `${s.color}20` : 'var(--bg3)',
                  color: selSession === s.id ? s.color : 'var(--muted)',
                }}
              >{s.label}</button>
            ))}
          </div>
          {wkSaved && day.workout && (
            <div className="workout-saved">
              <div className="text-base text-green font-500 mb-4">✓ Session logged</div>
              <div className="text-sm text-muted">
                {SESSION_OPTS.find(s => s.id === day.workout)?.label ?? day.workout}
                {day.wkNotes ? ` - ${day.wkNotes.substring(0, 70)}` : ''}
              </div>
            </div>
          )}
          <textarea className="tinput resize-vertical mb-8" value={wkNotes} onChange={e => setWkNotes(e.target.value)} placeholder="How did it feel? PRs? Modifications?" rows={3} />
          <button onClick={logWorkout} className="tbtn tbtn--coral">+ Log workout</button>
        </div>
      )}

      {/* ── Meditation ── */}
      {innerTab === 'meditation' && (
        <div className="flex flex-col gap-12">

          {/* Meditation */}
          <div className="tcard">
            <div className="flex-between mb-6">
              <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>Meditation · 8:45 AM</div>
              {ouraConnected && (
                <button
                  onClick={syncMedFromOura}
                  disabled={medSyncing}
                  className={`oura-sync-btn oura-sync-btn--gold ${medSyncing ? 'loading' : ''}`}
                >
                  {medSyncing ? 'Syncing…' : '⟳ Sync Oura'}
                </button>
              )}
            </div>

            {/* Oura meditation data badges */}
            {ouraHRV !== null && (
              <div className="flex flex-wrap gap-8 mb-10">
                <span className="oura-badge oura-badge--teal">HRV {ouraHRV}</span>
                {ouraHR !== null && <span className="oura-badge oura-badge--green">HR {ouraHR} bpm</span>}
                {ouraActualMin !== null && ouraActualMin !== medMin && (
                  <span className="oura-badge oura-badge--muted" title={`Actual: ${ouraActualMin} min — rounded to nearest option`}>
                    actual {ouraActualMin} min
                  </span>
                )}
                {ouraMood && <span className="oura-badge oura-badge--purple">feeling: {ouraMood}</span>}
              </div>
            )}

            <div className="text-sm text-muted mb-10 lh-15">Optimal post-CAR window. Even 13 minutes measurably improves focus and working memory for hours.</div>
            <div className="text-sm text-muted mb-6">Duration:</div>
            <div className="flex flex-wrap gap-6 mb-10">
              {MED_MINS.map(m => (
                <button key={m} onClick={() => setMedMin(medMin === m ? 0 : m)} className={`med-min-btn ${medMin === m ? 'active' : ''}`}>{m} min</button>
              ))}
            </div>
            <div className="text-sm text-muted mb-6">Style:</div>
            <div className="flex flex-wrap gap-6 mb-10">
              {MED_STYLES.map(s => (
                <button key={s} onClick={() => setMedStyle(medStyle === s ? '' : s)} className={`med-style-btn ${medStyle === s ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
            {day.medMin > 0 && (
              <div className="med-done">Done: {day.medMin} min{day.medStyle ? ` - ${day.medStyle}` : ''}</div>
            )}
            <button onClick={logMed} className={`tbtn btn-gold ${medSaved ? 'saved' : ''}`}>
              {medSaved ? 'Saved!' : 'Log meditation'}
            </button>
          </div>

          {/* Favorite guides */}
          <div className="tcard">
            <div className="flex-between mb-10">
              <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>Favorite Guides</div>
              <button
                onClick={() => setShowAddGuide(v => !v)}
                className={`open-toggle-btn ${showAddGuide ? 'text-muted2' : 'text-teal'}`}
              >
                {showAddGuide ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {guides.length === 0 && !showAddGuide && (
              <div className="text-sm text-muted2 italic mb-6">No guides saved yet.</div>
            )}

            <div className={`flex flex-col gap-6 ${showAddGuide ? 'mb-10' : ''}`}>
              {guides.map((g, i) => (
                <div key={i} className="guide-row">
                  <span className="text-base" style={{ color: 'var(--gold)' }}>▶</span>
                  <a href={g.url} target="_blank" rel="noopener noreferrer" className="guide-link">{g.title}</a>
                  <button onClick={() => removeGuide(i)} title="Remove" className="item-icon-btn text-lg">×</button>
                </div>
              ))}
            </div>

            {showAddGuide && (
              <div className="flex flex-col gap-6">
                <input className="tinput" value={newGuideTitle} onChange={e => setNewGuideTitle(e.target.value)} placeholder="Title (e.g. Morning Calm · 13 min)" />
                <input className="tinput" value={newGuideUrl} onChange={e => setNewGuideUrl(e.target.value)} placeholder="URL" onKeyDown={e => e.key === 'Enter' && addGuide()} />
                <button onClick={addGuide} className="tbtn btn-gold">Add guide</button>
              </div>
            )}
          </div>

          {/* Daily check-in */}
          <div className="tcard" onFocus={syncSleepFromOura} onMouseEnter={syncSleepFromOura}>
            <div className="tlabel" style={{ color: 'var(--purple)' }}>Daily check-in</div>
            <div className="flex flex-col gap-12">
              <div>
                <div className="text-sm text-muted mb-6">Energy ⚡</div>
                <StarRow value={energy} onChange={setEnergy} emoji="E" />
              </div>
              <div>
                <div className="text-sm text-muted mb-6">Mood 😊</div>
                <StarRow value={mood} onChange={setMood} emoji="M" />
              </div>
              <div>
                <div className="text-sm text-muted mb-6">Sleep 🌙</div>
                <StarRow value={sleep} onChange={setSleep} emoji="Z" />
              </div>
              <div>
                <div className="text-sm text-muted mb-6">Cycle phase</div>
                <div className="flex gap-6 flex-wrap">
                  {(['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'Unsure'] as const).map((p, i) => {
                    const colors = ['var(--purple)', 'var(--green)', 'var(--teal)', 'var(--amber)', 'var(--muted2)']
                    const active = phase === p
                    return (
                      <button key={p} onClick={() => setPhase(active ? '' : p)} className="phase-btn" style={{
                        border: `1px solid ${active ? colors[i] : 'var(--border)'}`,
                        background: active ? `${colors[i]}20` : 'var(--bg3)',
                        color: active ? colors[i] : 'var(--muted)',
                      }}>{p}</button>
                    )
                  })}
                </div>
              </div>
              <button onClick={saveCheckIn} className={`tbtn ${checkInSaved ? 'tbtn--green' : 'tbtn--secondary'}`}>
                {checkInSaved ? 'Saved!' : 'Save check-in'}
              </button>
            </div>
          </div>

          {/* Reminders */}
          <RemindersSection user={user} />

          {/* Day notes */}
          <div className="tcard">
            <div className="tlabel text-muted2">Day notes</div>
            <textarea className="tinput resize-vertical mb-8" value={dayNotes} onChange={e => setDayNotes(e.target.value)} placeholder="Cravings, how the workout felt, anything worth noting..." rows={4} />
            <button onClick={saveNotes} className={`tbtn tbtn-ghost ${notesSaved ? 'saved' : ''}`}>
              {notesSaved ? 'Saved!' : 'Save notes'}
            </button>
          </div>
        </div>
      )}

    </>
  )
}
