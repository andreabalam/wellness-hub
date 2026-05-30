import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useTrackerStore, useFoodLibraryStore, MED_GUIDES_KEY, exportAllData, importAllData } from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import type { MedGuide } from '../../lib/sync'
import {
  KCAL_TARGET, PROT_TARGET, CARB_TARGET, FAT_TARGET, FIBER_TARGET,
  QUICK_FOODS, SESSION_OPTS, MED_MINS, MED_STYLES, PHASE_NOTES,
} from '../../data/tracker'
import type { DayData, FoodEntry, QuickFood } from '../../data/tracker'
import {
  getOuraPat, saveOuraPat, clearOuraPat, testOuraConnection,
  fetchOuraWorkouts, fetchOuraReadiness, fetchOuraSessions, fetchOuraSleep,
  OURA_ACTIVITY_MAP, OURA_SESSION_MAP, roundToMedMin,
  readinessColor, readinessLabel, sleepScoreToStars,
} from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { analyzeImage } from '../../lib/analyzeFood'
import type { PhotoAnalysisResult } from '../../lib/analyzeFood'

function dkey(d: Date) { return d.toISOString().split('T')[0] }

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

  // Data export / import
  const handleExport = () => {
    const data = JSON.stringify(exportAllData(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wellness_hub_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const ok = importAllData(ev.target?.result as string)
      if (ok) { alert('Data imported! Reloading...'); location.reload() }
      else alert('Import failed. Make sure you are using a backup file exported from this Hub.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

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

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

  const goToday = () => {
    const d = new Date(); d.setHours(0, 0, 0, 0)
    setDate(d)
  }

  const phaseNote = PHASE_NOTES[phase] ?? PHASE_NOTES['']

  // ── Oura state ──────────────────────────────────────────────────
  const [ouraConnected, setOuraConnected]     = useState(false)
  const [ouraShowSettings, setOuraShowSettings] = useState(false)
  const [ouraPatInput, setOuraPatInput]       = useState('')
  const [ouraShowPat, setOuraShowPat]         = useState(false)
  const [ouraTesting, setOuraTesting]         = useState(false)
  const [ouraPatSaved, setOuraPatSaved]       = useState(false)
  const [ouraError, setOuraError]             = useState<string | null>(null)
  const [readiness, setReadiness]             = useState<OuraReadiness | null>(null)
  const [wkSyncing, setWkSyncing]             = useState(false)
  const [medSyncing, setMedSyncing]           = useState(false)
  const [ouraHRV, setOuraHRV]               = useState<number | null>(null)
  const [ouraHR, setOuraHR]                 = useState<number | null>(null)
  const [ouraMood, setOuraMood]             = useState<string | null>(null)
  const [ouraActualMin, setOuraActualMin]   = useState<number | null>(null)

  // Check connection status on mount
  useEffect(() => {
    getOuraPat().then(pat => setOuraConnected(!!pat)).catch(() => {})
  }, [])

  // Clear Oura per-day data when date changes
  useEffect(() => {
    setReadiness(null)
    setOuraHRV(null); setOuraHR(null); setOuraMood(null); setOuraActualMin(null)
  }, [date])

  const saveAndTestPat = async () => {
    const pat = ouraPatInput.trim()
    if (!pat) { setOuraError('Paste your Personal Access Token first.'); return }
    setOuraTesting(true); setOuraError(null)
    try {
      await saveOuraPat(pat)
      const ok = await testOuraConnection()
      if (ok) {
        setOuraConnected(true)
        setOuraPatSaved(true)
        setTimeout(() => { setOuraPatSaved(false); setOuraShowSettings(false) }, 1800)
      } else {
        setOuraError('Connection test failed — double-check your token.')
        setOuraConnected(false)
      }
    } catch (err: unknown) {
      setOuraError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setOuraTesting(false)
    }
  }

  const disconnectOura = async () => {
    await clearOuraPat()
    setOuraConnected(false); setOuraPatInput(''); setReadiness(null)
    setOuraHRV(null); setOuraHR(null); setOuraMood(null); setOuraActualMin(null)
  }

  const syncWorkoutFromOura = async () => {
    setWkSyncing(true)
    try {
      const dateStr = dkey(date)
      const [workouts, readinessData] = await Promise.all([
        fetchOuraWorkouts(dateStr),
        fetchOuraReadiness(dateStr),
      ])
      if (readinessData) setReadiness(readinessData)
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
              {/* Hidden file input for photo capture */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 8px', background: 'rgba(184,150,58,0.1)', border: '1px solid var(--amber)', borderRadius: 7, marginBottom: 8, fontSize: 11 }}>
                  <span style={{ color: 'var(--amber-light)', fontFamily: '"DM Mono",monospace' }}>Editing: {day.foods[editIndex]?.n}</span>
                  <button onClick={cancelEdit} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 11 }}>Cancel</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginBottom: 7, alignItems: 'center' }}>
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
                  <input
                    key={ph} className="tnum" type="number" min="0"
                    placeholder={ph} value={val} onChange={e => set(e.target.value)}
                    style={photoConfidence === 'low' || photoConfidence === 'medium'
                      ? { borderColor: 'var(--amber)' } : undefined}
                  />
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <div className="tlabel" style={{ color: 'var(--coral)', marginBottom: 0 }}>Workout log · 4:30 PM</div>
            {ouraConnected && (
              <button
                onClick={syncWorkoutFromOura}
                disabled={wkSyncing}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6,
                  border: '1px solid var(--teal)', background: 'rgba(58,144,144,0.08)',
                  color: 'var(--teal-light)', cursor: wkSyncing ? 'default' : 'pointer',
                  fontFamily: '"DM Mono",monospace', opacity: wkSyncing ? 0.6 : 1,
                  transition: 'opacity .2s',
                }}
              >
                {wkSyncing ? 'Syncing…' : '⟳ Sync Oura'}
              </button>
            )}
          </div>

          {/* Readiness badge */}
          {readiness && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
              padding: '8px 11px', background: 'var(--bg3)', borderRadius: 8,
              border: `1px solid ${readinessColor(readiness.score)}40`,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                background: `${readinessColor(readiness.score)}20`,
                border: `2px solid ${readinessColor(readiness.score)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: '"DM Mono",monospace', fontSize: 12, fontWeight: 700,
                color: readinessColor(readiness.score),
              }}>{readiness.score}</div>
              <div>
                <div style={{ fontSize: 12, color: readinessColor(readiness.score), fontWeight: 600 }}>
                  {readinessLabel(readiness.score)}
                </div>
                <div style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace' }}>
                  HRV balance {readiness.hrv_balance_score} · Recovery {readiness.recovery_index_score}
                </div>
              </div>
            </div>
          )}

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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>Meditation · 8:45 AM</div>
              {ouraConnected && (
                <button
                  onClick={syncMedFromOura}
                  disabled={medSyncing}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 6,
                    border: '1px solid var(--gold)', background: 'rgba(184,150,58,0.08)',
                    color: 'var(--gold-light)', cursor: medSyncing ? 'default' : 'pointer',
                    fontFamily: '"DM Mono",monospace', opacity: medSyncing ? 0.6 : 1,
                    transition: 'opacity .2s',
                  }}
                >
                  {medSyncing ? 'Syncing…' : '⟳ Sync Oura'}
                </button>
              )}
            </div>

            {/* Oura meditation data badges */}
            {ouraHRV !== null && (
              <div style={{
                display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10,
              }}>
                <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'rgba(58,144,144,0.1)', border: '1px solid var(--teal)', color: 'var(--teal-light)', fontFamily: '"DM Mono",monospace' }}>
                  HRV {ouraHRV}
                </span>
                {ouraHR !== null && (
                  <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'rgba(76,175,125,0.1)', border: '1px solid var(--green2)', color: 'var(--green-light)', fontFamily: '"DM Mono",monospace' }}>
                    HR {ouraHR} bpm
                  </span>
                )}
                {ouraActualMin !== null && ouraActualMin !== medMin && (
                  <span title={`Actual: ${ouraActualMin} min — rounded to nearest option`} style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--muted2)', fontFamily: '"DM Mono",monospace', cursor: 'help' }}>
                    actual {ouraActualMin} min
                  </span>
                )}
                {ouraMood && (
                  <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 5, background: 'rgba(138,106,184,0.1)', border: '1px solid var(--purple)', color: 'var(--purple)', fontFamily: 'sans-serif' }}>
                    feeling: {ouraMood}
                  </span>
                )}
              </div>
            )}

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

          {/* Favorite guides */}
          <div className="tcard">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>Favorite Guides</div>
              <button
                onClick={() => setShowAddGuide(v => !v)}
                style={{ fontSize: 11, background: 'none', border: 'none', color: showAddGuide ? 'var(--muted2)' : 'var(--teal-light)', cursor: 'pointer', fontFamily: 'sans-serif', padding: 0 }}
              >
                {showAddGuide ? 'Cancel' : '+ Add'}
              </button>
            </div>

            {guides.length === 0 && !showAddGuide && (
              <div style={{ fontSize: 12, color: 'var(--muted2)', fontStyle: 'italic', marginBottom: 6 }}>No guides saved yet.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: showAddGuide ? 10 : 0 }}>
              {guides.map((g, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 9 }}>
                  <span style={{ fontSize: 13, color: 'var(--gold)' }}>▶</span>
                  <a
                    href={g.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ flex: 1, fontSize: 13, color: 'var(--teal-light)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {g.title}
                  </a>
                  <button
                    onClick={() => removeGuide(i)}
                    title="Remove"
                    style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 18, padding: '0 3px', lineHeight: 1, flexShrink: 0 }}
                  >×</button>
                </div>
              ))}
            </div>

            {showAddGuide && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  className="tinput"
                  value={newGuideTitle}
                  onChange={e => setNewGuideTitle(e.target.value)}
                  placeholder="Title (e.g. Morning Calm · 13 min)"
                  style={{ marginBottom: 0 }}
                />
                <input
                  className="tinput"
                  value={newGuideUrl}
                  onChange={e => setNewGuideUrl(e.target.value)}
                  placeholder="URL"
                  style={{ marginBottom: 0 }}
                  onKeyDown={e => e.key === 'Enter' && addGuide()}
                />
                <button onClick={addGuide} className="tbtn" style={{ background: 'rgba(184,150,58,0.15)', border: '1px solid var(--gold)', color: 'var(--gold-light)' }}>
                  Add guide
                </button>
              </div>
            )}
          </div>

          {/* Daily check-in */}
          <div className="tcard" onFocus={syncSleepFromOura} onMouseEnter={syncSleepFromOura}>
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

      {/* Data backup */}
      <div className="tcard" style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: '"DM Mono",monospace', marginRight: 4 }}>Data backup</span>
        <button
          onClick={handleExport}
          style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontFamily: '"DM Mono",monospace', color: 'var(--muted)', cursor: 'pointer' }}
        >
          ↓ Export
        </button>
        <label style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontFamily: '"DM Mono",monospace', color: 'var(--muted)', cursor: 'pointer' }}>
          ↑ Import
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
        </label>
      </div>

      {/* Oura Ring settings — only shown when Supabase is configured */}
      {supabase && (
        <div className="tcard" style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontFamily: '"DM Mono",monospace', color: ouraConnected ? 'var(--teal-light)' : 'var(--muted)' }}>
                Oura Ring
              </span>
              {ouraConnected && (
                <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 5, background: 'rgba(58,144,144,0.12)', border: '1px solid var(--teal)', color: 'var(--teal-light)', fontFamily: '"DM Mono",monospace' }}>
                  ✓ connected
                </span>
              )}
            </div>
            <button
              onClick={() => { setOuraShowSettings(v => !v); setOuraError(null) }}
              style={{ fontSize: 11, background: 'none', border: 'none', color: ouraShowSettings ? 'var(--muted2)' : 'var(--teal-light)', cursor: 'pointer', fontFamily: 'sans-serif', padding: 0 }}
            >
              {ouraShowSettings ? 'Done' : ouraConnected ? 'Manage' : 'Connect'}
            </button>
          </div>

          {ouraShowSettings && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, marginTop: 0, marginBottom: 10 }}>
                Generate a Personal Access Token at{' '}
                <a href="https://cloud.ouraring.com/personal-access-tokens" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--teal-light)' }}>
                  cloud.ouraring.com
                </a>
                {' '}→ Personal Access Tokens, then paste it below.
              </p>

              <div style={{ position: 'relative', marginBottom: 8 }}>
                <input
                  className="tinput"
                  type={ouraShowPat ? 'text' : 'password'}
                  value={ouraPatInput}
                  onChange={e => setOuraPatInput(e.target.value)}
                  placeholder="Paste your Oura PAT here…"
                  style={{ marginBottom: 0, paddingRight: 42, fontFamily: '"DM Mono",monospace', fontSize: 12 }}
                  onKeyDown={e => e.key === 'Enter' && saveAndTestPat()}
                />
                <button
                  onClick={() => setOuraShowPat(v => !v)}
                  title={ouraShowPat ? 'Hide token' : 'Show token'}
                  style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 14, padding: 0 }}
                >
                  {ouraShowPat ? '🙈' : '👁'}
                </button>
              </div>

              {ouraError && (
                <div style={{ fontSize: 11, color: 'var(--coral-light)', marginBottom: 8, padding: '5px 9px', background: 'rgba(255,107,91,0.08)', border: '1px solid var(--coral)', borderRadius: 6 }}>
                  {ouraError}
                </div>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  onClick={saveAndTestPat}
                  disabled={ouraTesting}
                  className="tbtn"
                  style={{ background: ouraPatSaved ? 'var(--green)' : 'var(--teal)', color: '#fff', opacity: ouraTesting ? 0.7 : 1 }}
                >
                  {ouraTesting ? 'Testing…' : ouraPatSaved ? '✓ Connected!' : 'Save & test connection'}
                </button>
                {ouraConnected && (
                  <button
                    onClick={disconnectOura}
                    style={{ fontSize: 12, padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg3)', color: 'var(--muted)', cursor: 'pointer' }}
                  >
                    Disconnect
                  </button>
                )}
              </div>

              <p style={{ fontSize: 10, color: 'var(--muted2)', marginTop: 10, marginBottom: 0, lineHeight: 1.6 }}>
                Your token is stored encrypted in Supabase — never in your browser's local storage.
                Syncs happen on demand when you tap "Sync Oura" in the Workout or Meditation tabs.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
