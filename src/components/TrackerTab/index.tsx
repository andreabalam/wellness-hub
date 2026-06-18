import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  useTrackerStore,
  useFoodLibraryStore,
  bodyStatsStore,
  useUserSettingsStore,
  recipeStore,
  hiddenRecipeStore,
  builtinRecipeCacheStore,
} from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import { macrosFromKcal } from '../../lib/stats'
import ProfileStatsCard from './ProfileStatsCard'
import { QUICK_FOODS, PHASE_NOTES, WATER_MAX } from '../../data/tracker'
import type { DayData, FoodEntry, QuickFood } from '../../data/tracker'
import { BUILTIN_RECIPES } from '../../data/recipes'
import type { Recipe } from '../../data/recipes'
import { searchLocalFoods, historyFoods } from '../../lib/localFoodSearch'
import type { LocalFoodHit } from '../../lib/localFoodSearch'
import { searchUSDAFoods, estimateFoodMacros } from '../../lib/foodSearch'
import type { UsdaFoodHit } from '../../lib/foodSearch'
import { isOuraConnected } from '../../lib/oura'
import { densityTierFor, DENSITY_COLORS, DENSITY_LABELS } from '../../lib/density'
import { analyzeImage } from '../../lib/analyzeFood'
import type { PhotoAnalysisResult } from '../../lib/analyzeFood'
import RemindersSection from './RemindersSection'
import MacroBar from './MacroBar'
import SatietyRow from './SatietyRow'
import WeekStrip from './WeekStrip'
import CheckIn from './CheckIn'
import MeditationLog from './MeditationLog'
import MeditationGuides from './MeditationGuides'
import WorkoutLog from './WorkoutLog'
import WeekGoal from './WeekGoal'
import type { WeekGoalPayload } from './WeekGoal'
import MealList from './MealList'
import PasteToLog from './PasteToLog'
import HungerCravingPicker from './HungerCravingPicker'
import QuickAddRow from './QuickAddRow'
import CravingSwapReference from './CravingSwapReference'
import { dkey } from './dateKey'

/** Local Monday (week anchor) of the week containing d. */
function mondayOf(d: Date): Date {
  const m = new Date(d)
  m.setHours(0, 0, 0, 0)
  const diff = (m.getDay() + 6) % 7 // days since Monday (getDay: 0=Sun..6=Sat)
  m.setDate(m.getDate() - diff)
  return m
}

/** A new Date offset by n days (does not mutate the input). */
function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

// ── Main component ───────────────────────────────────────────────
export default function TrackerTab({
  user,
  onOpenRecipe,
}: {
  user?: User | null
  /** Called when the 📖 badge on a logged meal is tapped — App switches to Recipes */
  onOpenRecipe?: (id: number | undefined, name: string) => void
}) {
  const store = useTrackerStore()
  const libStore = useFoodLibraryStore()
  const settingsStore = useUserSettingsStore()
  const todayBase = new Date()
  todayBase.setHours(0, 0, 0, 0)

  const [targets] = useState(() => settingsStore.get())
  // Macro bar targets: prefer bodyStats (with macroSplit) over legacy settings
  const [statsSeed, setStatsSeed] = useState(0) // increment to force re-read after ProfileStatsCard save
  const activeStats = bodyStatsStore.get()
  const activeMacros = macrosFromKcal(
    activeStats.kcalTarget,
    (activeStats.macroSplit as import('../../lib/stats').MacroSplit) || 'balanced',
  )
  const activeKcalTarget = activeStats.kcalTarget || targets.kcalTarget
  const activeProtTarget = activeMacros?.prot ?? targets.protTarget
  const activeCarbTarget = activeMacros?.carb ?? targets.carbTarget
  const activeFatTarget = activeMacros?.fat ?? targets.fatTarget
  const activeFiberTarget = activeMacros?.fiber ?? targets.fiberTarget

  const [date, setDate] = useState<Date>(new Date(todayBase))
  const [day, setDay] = useState<DayData>(() => store.getDay(dkey(todayBase)))
  const [fName, setFName] = useState('')
  const [fKcal, setFKcal] = useState('')
  const [fPro, setFPro] = useState('')
  const [fCarb, setFCarb] = useState('')
  const [fFat, setFat] = useState('')
  const [fFiber, setFFiber] = useState('')
  const [fServings, setFServings] = useState('1')
  const [fSat, setFSat] = useState(0)
  const [fHunger, setFHunger] = useState('')
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [showSugg, setShowSugg] = useState(false)
  const [foodLib, setFoodLib] = useState<QuickFood[]>(() => libStore.getAll())
  const [fRecipeId, setFRecipeId] = useState<number | null>(null)
  const [onlineStatus, setOnlineStatus] = useState<'idle' | 'searching' | 'estimating' | 'error'>(
    'idle',
  )
  const [onlineHits, setOnlineHits] = useState<UsdaFoodHit[] | null>(null)
  const onlineAbortRef = useRef<AbortController | null>(null)
  // Delayed-close timer for the suggestions dropdown. Must be cancelled on
  // refocus, or a stale blur timer closes a freshly reopened dropdown.
  const suggTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const openSugg = () => {
    if (suggTimerRef.current) {
      clearTimeout(suggTimerRef.current)
      suggTimerRef.current = null
    }
    setShowSugg(true)
  }
  const closeSuggSoon = () => {
    suggTimerRef.current = setTimeout(() => setShowSugg(false), 150)
  }
  const [photoStatus, setPhotoStatus] = useState<
    'idle' | 'detecting' | 'reading' | 'identifying' | 'error'
  >('idle')
  const [photoNotes, setPhotoNotes] = useState<string>('')
  const [photoConfidence, setPhotoConfidence] = useState<PhotoAnalysisResult['confidence'] | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [water, setWater] = useState(0)
  const [phase, setPhase] = useState('')
  const [dayNotes, setDayNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [stripKey, setStripKey] = useState(0)
  const [innerTab, setInnerTab] = useState<'food' | 'workout' | 'meditation'>('food')

  const loadDate = useCallback(
    (d: Date) => {
      const k = dkey(d)
      const data = store.getDay(k)
      setDay(data)
      setWater(data.water ?? 0)
      setPhase(data.phase ?? '')
      setDayNotes(data.notes ?? '')
      setEditIndex(null)
      setFName('')
      setFKcal('')
      setFPro('')
      setFCarb('')
      setFat('')
      setFFiber('')
      setFServings('1')
      setFSat(0)
      setFHunger('')
      setFRecipeId(null)
      setShowSugg(false)
      setPhotoStatus('idle')
      setPhotoNotes('')
      setPhotoConfidence(null)
    },
    [store],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDate(date)
  }, [date, loadDate])

  const save = useCallback(
    (patch: Partial<DayData>) => {
      const k = dkey(date)
      const updated = { ...store.getDay(k), ...patch }
      store.setDay(k, updated)
      setDay(updated)
      setStripKey(n => n + 1)
    },
    [date, store],
  )

  // Totals
  const totals = day.foods.reduce(
    (acc, f) => ({
      k: acc.k + f.k,
      p: acc.p + f.p,
      c: acc.c + f.c,
      f: acc.f + f.f,
      fi: acc.fi + f.fi,
    }),
    { k: 0, p: 0, c: 0, f: 0, fi: 0 },
  )

  // Built-in recipe catalog for search — served from the localStorage cache
  // (kept fresh by RecipesTab). Fetched once here only when the cache is empty,
  // e.g. first app load before the Recipes tab has ever been opened.
  const [builtinCatalog, setBuiltinCatalog] = useState<Recipe[]>(() =>
    builtinRecipeCacheStore.getAll(),
  )
  useEffect(() => {
    if (!supabase || builtinCatalog.length) return
    let cancelled = false
    sync
      .fetchBuiltinRecipes()
      .then(remote => {
        if (cancelled || !remote?.length) return
        builtinRecipeCacheStore.save(remote)
        setBuiltinCatalog(remote)
      })
      .catch(() => {
        /* offline — search still covers local sources */
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Local search sources — re-read when the dropdown opens or the day changes
  // so newly saved recipes / logged foods are picked up without a remount.
  const searchSources = useMemo(() => {
    const custom = recipeStore.getRecipes()
    const customIds = new Set(custom.map(r => r.id))
    // A custom recipe with defaultId is the user's fork of a built-in — the
    // fork wins, the original is excluded from search.
    const forkIds = new Set(custom.map(r => r.defaultId).filter((id): id is number => id != null))
    const hidden = new Set(hiddenRecipeStore.getAll())
    const catalog = builtinCatalog.length ? builtinCatalog : BUILTIN_RECIPES
    const recipes = [
      ...custom,
      ...catalog.filter(b => b.id == null || (!customIds.has(b.id) && !forkIds.has(b.id))),
    ].filter(r => !(r.id != null && hidden.has(r.id)))
    return {
      library: foodLib,
      history: historyFoods(store.getAll()),
      recipes,
      quickFoods: QUICK_FOODS,
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [foodLib, showSugg, day, store, builtinCatalog])

  const localHits = useMemo(() => searchLocalFoods(fName, searchSources), [fName, searchSources])
  const hitGroups = (
    [
      ['Your foods', localHits.filter(h => h.source === 'library' || h.source === 'history')],
      ['Recipes', localHits.filter(h => h.source === 'recipe')],
      ['Suggestions', localHits.filter(h => h.source === 'builtin')],
    ] as [string, LocalFoodHit[]][]
  ).filter(([, hits]) => hits.length > 0)

  const resetOnline = useCallback(() => {
    onlineAbortRef.current?.abort()
    setOnlineHits(null)
    setOnlineStatus('idle')
  }, [])

  const applySuggestion = (f: LocalFoodHit) => {
    setFName(f.n)
    setFKcal(String(f.k))
    setFPro(String(f.p))
    setFCarb(String(f.c))
    setFat(String(f.f))
    setFFiber(String(f.fi))
    setFRecipeId(f.recipeId ?? null)
    setShowSugg(false)
    resetOnline()
  }

  const searchOnline = async () => {
    const q = fName.trim()
    if (!q) return
    onlineAbortRef.current?.abort()
    const ctrl = new AbortController()
    onlineAbortRef.current = ctrl
    setOnlineStatus('searching')
    try {
      const hits = await searchUSDAFoods(q, ctrl.signal)
      if (ctrl.signal.aborted) return
      setOnlineHits(hits)
      setOnlineStatus('idle')
    } catch {
      if (!ctrl.signal.aborted) setOnlineStatus('error')
    }
  }

  const applyUsdaHit = (h: UsdaFoodHit) => {
    setFName(h.name)
    setFKcal(String(h.k))
    setFPro(String(Math.round(h.p)))
    setFCarb(String(Math.round(h.c)))
    setFat(String(Math.round(h.f)))
    setFFiber(String(Math.round(h.fi)))
    setFRecipeId(null)
    setPhotoNotes(`USDA · per ${h.srv}`)
    setPhotoConfidence('high')
    setShowSugg(false)
    resetOnline()
  }

  const estimateAI = async () => {
    const q = fName.trim()
    if (!q) return
    setOnlineStatus('estimating')
    try {
      const est = await estimateFoodMacros(q)
      if (!est) {
        setOnlineStatus('error')
        return
      }
      setFName(est.name || q)
      setFKcal(String(Math.round(est.kcal)))
      setFPro(String(Math.round(est.protein)))
      setFCarb(String(Math.round(est.carbs)))
      setFat(String(Math.round(est.fat)))
      setFFiber(String(Math.round(est.fiber)))
      setFRecipeId(null)
      setPhotoNotes(
        est.notes ? `AI estimate — ${est.notes}` : 'AI estimate — verify before logging',
      )
      setPhotoConfidence(est.confidence)
      setShowSugg(false)
      resetOnline()
    } catch {
      setOnlineStatus('error')
    }
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
    setFRecipeId(f.r ?? null)
    setFSat(f.sat ?? 0)
    setFHunger(f.hunger ?? '')
    setShowSugg(false)
    resetOnline()
  }

  const cancelEdit = () => {
    setEditIndex(null)
    setFName('')
    setFKcal('')
    setFPro('')
    setFCarb('')
    setFat('')
    setFFiber('')
    setFServings('1')
    setFSat(0)
    setFHunger('')
    setFRecipeId(null)
    setPhotoStatus('idle')
    setPhotoNotes('')
    setPhotoConfidence(null)
    resetOnline()
  }

  const handlePhotoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setPhotoStatus('detecting')
    setPhotoNotes('')
    setPhotoConfidence(null)
    try {
      const result = await analyzeImage(file, msg => {
        if (msg === 'Detecting…') setPhotoStatus('detecting')
        else if (msg === 'Reading label…') setPhotoStatus('reading')
        else setPhotoStatus('identifying')
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
    } catch (err) {
      console.error('[TrackerTab] photo analysis failed:', err)
      setPhotoStatus('error')
      setPhotoNotes(
        err instanceof Error && err.message
          ? err.message
          : 'Could not identify — fill in manually.',
      )
    }
  }, [])

  const addFood = () => {
    const nm = fName.trim()
    if (!nm || !fKcal) {
      alert('Enter a name and calories.')
      return
    }
    const srv = Math.max(0.5, parseFloat(fServings) || 1)
    const perK = parseInt(fKcal) || 0
    const perP = parseInt(fPro) || 0
    const perC = parseInt(fCarb) || 0
    const perF = parseInt(fFat) || 0
    const perFi = parseInt(fFiber) || 0
    const entry: FoodEntry = {
      n: nm,
      k: Math.round(perK * srv),
      p: Math.round(perP * srv),
      c: Math.round(perC * srv),
      f: Math.round(perF * srv),
      fi: Math.round(perFi * srv),
      ...(srv !== 1 ? { s: srv } : {}),
      ...(fRecipeId != null ? { r: fRecipeId } : {}),
      ...(fSat ? { sat: fSat } : {}),
      ...(fHunger ? { hunger: fHunger } : {}),
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
    setFName('')
    setFKcal('')
    setFPro('')
    setFCarb('')
    setFat('')
    setFFiber('')
    setFServings('1')
    setFSat(0)
    setFHunger('')
    setFRecipeId(null)
  }

  const removeFood = (i: number) => {
    if (editIndex === i) cancelEdit()
    const foods = day.foods.filter((_, j) => j !== i)
    save({ foods })
  }

  const quickAdd = (f: FoodEntry) => {
    save({ foods: [...day.foods, f] })
  }

  // ── Paste-to-log ────────────────────────────────────────────────
  // Add the reviewed paste rows: persist to the day and remember per-serving
  // macros so these foods autocomplete next time. (PasteToLog owns its own state.)
  const addParsedFoods = (parsed: QuickFood[]) => {
    const rows = parsed.filter(r => r.n.trim() && r.k > 0)
    if (!rows.length) return
    const entries: FoodEntry[] = rows.map(r => ({
      n: r.n.trim(),
      k: r.k,
      p: r.p,
      c: r.c,
      f: r.f,
      fi: r.fi,
    }))
    let lib = foodLib
    for (const r of rows) lib = libStore.upsert(r)
    setFoodLib(lib)
    save({ foods: [...day.foods, ...entries] })
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
        if (!seen.has(key)) {
          seen.add(key)
          result.push(food)
        }
        if (result.length >= 10) break
      }
      if (result.length >= 10) break
    }
    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, day])

  const saveNotes = () => {
    save({ notes: dayNotes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 1600)
  }

  // Weekly goal persists on the week's Monday anchor day (not the viewed day)
  const saveWeekGoal = (p: WeekGoalPayload) => {
    const anchorKey = dkey(mondayOf(date))
    const updated: DayData = {
      ...store.getDay(anchorKey),
      weekGoal: p.weekGoal.trim(),
      weekGoalKind: p.weekGoalKind,
      weekGoalResult: p.weekGoalResult || undefined,
      weekGoalNote: p.weekGoalNote.trim() || undefined,
    }
    store.setDay(anchorKey, updated)
    if (anchorKey === dkey(date)) setDay(updated) // keep viewed-day state in sync
    setStripKey(n => n + 1)
  }

  // Current week's goal anchor (Monday) — seeds <WeekGoal>; re-read per week.
  const weekAnchorDay = useMemo(() => store.getDay(dkey(mondayOf(date))), [date, store])
  // Last week's goal (read from the previous Monday anchor) for continuity
  const lastWeek = store.getDay(dkey(addDays(mondayOf(date), -7)))

  const goDate = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
  }

  const phaseNote = PHASE_NOTES[phase] ?? PHASE_NOTES['']

  // Fresh read of the selected day's check-in values to seed <CheckIn>. The
  // `day` state lags `date` by one render (it's loaded in an effect), so seeding
  // the date-keyed CheckIn from `day` would show the previous day's stars.
  const dayForDate = useMemo(() => store.getDay(dkey(date)), [date, store])

  // ── Oura state ──────────────────────────────────────────────────
  const [ouraConnected, setOuraConnected] = useState(false)

  // Check connection status on mount
  useEffect(() => {
    isOuraConnected()
      .then(setOuraConnected)
      .catch(() => {})
  }, [])

  // Hydration counter — persists immediately on each tap
  const adjustWater = (delta: number) => {
    const next = Math.max(0, Math.min(WATER_MAX, water + delta))
    setWater(next)
    save({ water: next })
  }

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
          Log meals, track macros and monitor your daily progress. Your data stays private and syncs
          across devices.
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
        <button onClick={() => goDate(-1)} className="date-nav-btn">
          ‹ Prev
        </button>
        <div className="date-display">
          {date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </div>
        <button onClick={() => goDate(1)} className="date-nav-btn">
          Next ›
        </button>
      </div>

      {/* Week strip — always visible */}
      <WeekStrip
        key={stripKey}
        currentDate={date}
        onSelect={d => {
          d.setHours(0, 0, 0, 0)
          setDate(d)
        }}
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
                <MacroBar
                  label="Calories"
                  val={totals.k}
                  target={activeKcalTarget}
                  color="var(--green)"
                  valColor="var(--green-light)"
                />
                <MacroBar
                  label="Protein"
                  sub="muscle retention"
                  val={totals.p}
                  target={activeProtTarget}
                  color="var(--blue)"
                  valColor="var(--blue-light)"
                />
                <MacroBar
                  label="Carbs"
                  sub="moderate-low"
                  val={totals.c}
                  target={activeCarbTarget}
                  color="var(--amber)"
                  valColor="var(--amber-light)"
                />
                <MacroBar
                  label="Fat"
                  sub="hormonal health"
                  val={totals.f}
                  target={activeFatTarget}
                  color="var(--coral)"
                  valColor="var(--coral-light)"
                />
                <MacroBar
                  label="Fiber"
                  sub="satiety on deficit"
                  val={totals.fi}
                  target={activeFiberTarget}
                  color="var(--teal)"
                  valColor="var(--teal-light)"
                />
              </div>
              <div className="flex-between mt-12 text-sm">
                <span className="text-muted">💧 Water</span>
                <div className="flex gap-8 items-center">
                  <button
                    onClick={() => adjustWater(-1)}
                    className="water-btn"
                    aria-label="Remove a glass of water"
                    disabled={water === 0}
                  >
                    –
                  </button>
                  <span
                    className="font-mono text-blue"
                    style={{ minWidth: 78, textAlign: 'center' }}
                  >
                    {water} glass{water === 1 ? '' : 'es'}
                  </span>
                  <button
                    onClick={() => adjustWater(1)}
                    className="water-btn"
                    aria-label="Add a glass of water"
                    disabled={water >= WATER_MAX}
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Food log */}
            <div className="tcard">
              <div className="tlabel text-muted2">Meals logged</div>
              <MealList
                foods={day.foods}
                editIndex={editIndex}
                onEdit={startEdit}
                onRemove={removeFood}
                onOpenRecipe={onOpenRecipe}
              />
              <div style={{ paddingTop: 12 }}>
                {/* Paste-to-log: parse a pasted block of meals into reviewable entries */}
                <PasteToLog foodLib={foodLib} onAdd={addParsedFoods} />

                {/* Hidden file input for photo capture — no `capture` attr so
                  mobile browsers offer both camera and photo library */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                {/* Photo status banner */}
                {(photoStatus !== 'idle' || photoNotes) && (
                  <div
                    style={{
                      fontSize: 11,
                      marginBottom: 8,
                      padding: '5px 9px',
                      borderRadius: 6,
                      background:
                        photoStatus === 'error' || photoConfidence === 'low'
                          ? 'rgba(184,150,58,0.08)'
                          : 'var(--bg3)',
                      border: `1px solid ${
                        photoStatus === 'error' || photoConfidence === 'low'
                          ? 'var(--amber)'
                          : 'var(--border)'
                      }`,
                      color:
                        photoStatus === 'error' || photoConfidence === 'low'
                          ? 'var(--amber-light)'
                          : 'var(--muted2)',
                      fontFamily: '"DM Mono",monospace',
                    }}
                  >
                    {photoStatus === 'detecting' && '● Detecting…'}
                    {photoStatus === 'reading' && '● Reading label…'}
                    {photoStatus === 'identifying' && '● Identifying food…'}
                    {photoStatus === 'error' && photoNotes}
                    {photoStatus === 'idle' && photoNotes}
                  </div>
                )}

                {editIndex !== null && (
                  <div className="edit-indicator">
                    <span className="text-amber font-mono">Editing: {day.foods[editIndex]?.n}</span>
                    <button onClick={cancelEdit} className="item-icon-btn text-xs">
                      Cancel
                    </button>
                  </div>
                )}

                {/* Hunger type — feed what's actually hungry (optional) */}
                <HungerCravingPicker fHunger={fHunger} onHungerChange={setFHunger} />

                <div className="flex gap-6 mb-8 items-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoStatus !== 'idle'}
                    title="Analyze food photo or nutrition label"
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      borderRadius: 7,
                      border: '1px solid var(--border)',
                      background: 'var(--bg3)',
                      color: photoStatus !== 'idle' ? 'var(--muted2)' : 'var(--teal-light)',
                      cursor: photoStatus !== 'idle' ? 'default' : 'pointer',
                      fontSize: 15,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all .15s',
                    }}
                  >
                    {photoStatus !== 'idle' ? '⏳' : '📷'}
                  </button>
                  <div className="autocomplete-wrap">
                    <input
                      className="tinput w-full"
                      value={fName}
                      onChange={e => {
                        setFName(e.target.value)
                        openSugg()
                        setFRecipeId(null)
                        resetOnline()
                      }}
                      onFocus={openSugg}
                      onBlur={closeSuggSoon}
                      placeholder="Meal name (e.g. Berry Oats)"
                    />
                    {showSugg && fName.trim().length >= 2 && (
                      <div className="autocomplete-dropdown">
                        {hitGroups.map(([label, hits]) => (
                          <Fragment key={label}>
                            <div className="autocomplete-section">{label}</div>
                            {hits.map(f => (
                              <button
                                key={`${f.source}-${f.n}`}
                                onMouseDown={() => applySuggestion(f)}
                                className="autocomplete-item"
                              >
                                {f.n}
                                <span className="autocomplete-hint">
                                  {f.k} kcal · {f.p}g P · {f.c}g C · {f.f}g F
                                </span>
                              </button>
                            ))}
                          </Fragment>
                        ))}
                        {onlineHits === null && onlineStatus === 'idle' && (
                          <button
                            className="autocomplete-item autocomplete-action"
                            onMouseDown={e => {
                              e.preventDefault()
                              searchOnline()
                            }}
                          >
                            🔍 Search online for “{fName.trim()}”
                          </button>
                        )}
                        {onlineStatus === 'searching' && (
                          <div className="autocomplete-empty">Searching USDA…</div>
                        )}
                        {onlineStatus === 'estimating' && (
                          <div className="autocomplete-empty">Estimating with AI…</div>
                        )}
                        {onlineStatus === 'error' && (
                          <button
                            className="autocomplete-item autocomplete-action autocomplete-action--warn"
                            onMouseDown={e => {
                              e.preventDefault()
                              searchOnline()
                            }}
                          >
                            ⚠ Search failed — tap to retry
                          </button>
                        )}
                        {onlineHits !== null && onlineStatus === 'idle' && (
                          <>
                            <div className="autocomplete-section">USDA results</div>
                            {onlineHits.length === 0 && (
                              <div className="autocomplete-empty">No USDA match.</div>
                            )}
                            {onlineHits.map(h => {
                              const tier = h.calPerG != null ? densityTierFor(h.calPerG) : null
                              return (
                                <button
                                  key={h.name}
                                  onMouseDown={() => applyUsdaHit(h)}
                                  className="autocomplete-item"
                                >
                                  <span>
                                    {tier && (
                                      <span
                                        className="density-dot density-dot--inline"
                                        title={DENSITY_LABELS[tier]}
                                        style={{ background: DENSITY_COLORS[tier] }}
                                      />
                                    )}
                                    {h.name}
                                  </span>
                                  <span className="autocomplete-hint">
                                    {h.srv} · {h.k} kcal · {h.p}g P · {h.c}g C · {h.f}g F
                                  </span>
                                </button>
                              )
                            })}
                            <button
                              className="autocomplete-item autocomplete-action"
                              onMouseDown={e => {
                                e.preventDefault()
                                estimateAI()
                              }}
                            >
                              ✨ Estimate with AI
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-muted2 text-2xs tracking-8 no-wrap">SRV</span>
                  <input
                    className="tnum"
                    type="number"
                    min="0.5"
                    step="0.5"
                    placeholder="1"
                    value={fServings}
                    onChange={e => setFServings(e.target.value)}
                    style={{ width: 36, textAlign: 'center' }}
                  />
                </div>
                <div className="macro-inputs-grid">
                  {(
                    [
                      ['kcal', fKcal, setFKcal],
                      ['prot', fPro, setFPro],
                      ['carb', fCarb, setFCarb],
                      ['fat', fFat, setFat],
                      ['fiber', fFiber, setFFiber],
                    ] as [string, string, (v: string) => void][]
                  ).map(([ph, val, set]) => (
                    <input
                      key={ph}
                      className={`tnum ${photoConfidence === 'low' || photoConfidence === 'medium' ? 'input-warn' : ''}`}
                      type="number"
                      min="0"
                      placeholder={ph}
                      value={val}
                      onChange={e => set(e.target.value)}
                    />
                  ))}
                </div>
                <div className="font-mono text-muted2 text-2xs mb-8">per serving</div>
                <div className="mb-10">
                  <div className="text-xs text-muted2 mb-6">
                    Satiety after this meal (optional) — where did it leave you?
                  </div>
                  <SatietyRow value={fSat} onChange={setFSat} />
                </div>
                <QuickAddRow recentMeals={recentMeals} onQuickAdd={quickAdd} />
                <button
                  onClick={addFood}
                  className={`tbtn ${editIndex !== null ? 'tbtn--amber' : 'tbtn--teal'}`}
                >
                  {editIndex !== null ? '✓ Save changes' : '+ Log food'}
                </button>
              </div>
            </div>
          </div>

          {/* Browsable craving-swap reference */}
          <CravingSwapReference />

          {/* Profile & Targets — consolidated stats module */}
          <ProfileStatsCard
            key={statsSeed}
            user={user ?? null}
            onSaved={() => setStatsSeed(n => n + 1)}
          />
        </>
      )}

      {/* ── Workout — keyed by date so the picker re-seeds on day change ── */}
      {innerTab === 'workout' && (
        <WorkoutLog
          key={dkey(date)}
          initialSession={dayForDate.workout}
          initialWkNotes={dayForDate.wkNotes}
          savedWorkout={day.workout}
          savedWkNotes={day.wkNotes}
          phaseNote={phaseNote}
          ouraConnected={ouraConnected}
          date={date}
          onSave={save}
        />
      )}

      {/* ── Meditation ── */}
      {innerTab === 'meditation' && (
        <div className="flex flex-col gap-12">
          {/* Meditation — keyed by date so the picker re-seeds on day change */}
          <MeditationLog
            key={`med-${dkey(date)}`}
            initialMedMin={dayForDate.medMin}
            initialMedStyle={dayForDate.medStyle}
            savedMedMin={day.medMin}
            savedMedStyle={day.medStyle}
            ouraConnected={ouraConnected}
            date={date}
            onSave={save}
          />

          {/* Favorite guides */}
          <MeditationGuides />

          {/* Daily check-in — keyed by date so it re-seeds its stars on day change */}
          <CheckIn
            key={`checkin-${dkey(date)}`}
            initialEnergy={dayForDate.energy}
            initialMood={dayForDate.mood}
            initialSleep={dayForDate.sleep}
            initialStress={dayForDate.stress}
            phase={phase}
            onSetPhase={setPhase}
            ouraConnected={ouraConnected}
            date={date}
            onSave={save}
          />

          {/* Reminders */}
          <RemindersSection user={user} />

          {/* Day notes */}
          <div className="tcard">
            <div className="tlabel text-muted2">Day notes</div>
            <textarea
              className="tinput resize-vertical mb-8"
              value={dayNotes}
              onChange={e => setDayNotes(e.target.value)}
              placeholder="Cravings, how the workout felt, anything worth noting..."
              rows={4}
            />
            <button onClick={saveNotes} className={`tbtn tbtn-ghost ${notesSaved ? 'saved' : ''}`}>
              {notesSaved ? 'Saved!' : 'Save notes'}
            </button>
          </div>

          {/* Weekly goal — keyed by week anchor so it re-seeds per week */}
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
      )}
    </>
  )
}
