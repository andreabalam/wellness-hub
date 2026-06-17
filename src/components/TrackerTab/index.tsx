import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react'
import type { User } from '@supabase/supabase-js'
import {
  useTrackerStore,
  useFoodLibraryStore,
  bodyStatsStore,
  MED_GUIDES_KEY,
  useUserSettingsStore,
  recipeStore,
  hiddenRecipeStore,
  builtinRecipeCacheStore,
} from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import type { MedGuide } from '../../lib/sync'
import { macrosFromKcal } from '../../lib/stats'
import ProfileStatsCard from './ProfileStatsCard'
import {
  QUICK_FOODS,
  SESSION_OPTS,
  MED_MINS,
  MED_STYLES,
  PHASE_NOTES,
  WATER_MAX,
  HUNGER_TYPES,
  hungerIcon,
  hungerLabel,
  WEEK_GOAL_SUGGESTIONS,
} from '../../data/tracker'
import type {
  DayData,
  FoodEntry,
  QuickFood,
  WeekGoalKind,
  WeekGoalResult,
} from '../../data/tracker'
import { CRAVING_TYPES, swapsFor } from '../../data/swaps'
import type { CravingType } from '../../data/swaps'
import { BUILTIN_RECIPES } from '../../data/recipes'
import type { Recipe } from '../../data/recipes'
import { searchLocalFoods, historyFoods } from '../../lib/localFoodSearch'
import type { LocalFoodHit } from '../../lib/localFoodSearch'
import { searchUSDAFoods, estimateFoodMacros } from '../../lib/foodSearch'
import type { UsdaFoodHit } from '../../lib/foodSearch'
import {
  isOuraConnected,
  fetchOuraWorkouts,
  fetchOuraReadiness,
  fetchOuraSessions,
  fetchOuraSleep,
  fetchOuraStress,
  OURA_ACTIVITY_MAP,
  OURA_SESSION_MAP,
  roundToMedMin,
  readinessColor,
  readinessLabel,
  sleepScoreToStars,
  stressToScale,
} from '../../lib/oura'
import type { OuraReadiness } from '../../lib/oura'
import { safeGet, safeSet } from '../../lib/storage'
import { reportError } from '../../lib/errorLog'
import { showToast } from '../../lib/toast'
import { densityTierFor, DENSITY_COLORS, DENSITY_LABELS } from '../../lib/density'
import { analyzeImage } from '../../lib/analyzeFood'
import type { PhotoAnalysisResult } from '../../lib/analyzeFood'
import { parseFoodLog, parseFoodLogLocal } from '../../lib/foodImport'
import RemindersSection from './RemindersSection'
import MacroBar from './MacroBar'
import StarRow from './StarRow'
import SatietyRow from './SatietyRow'
import WeekStrip from './WeekStrip'
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

const WEEK_RESULT_LABEL: Record<string, string> = { yes: 'Yes', partial: 'Partially', no: 'No' }

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
  {
    title: 'Guided Meditation · Session 1',
    url: 'https://www.youtube.com/watch?v=_nfMuLIpRus&list=PLSGCbLKMPkC1I1jnlSKIqCllxhRu2fNTN&index=1',
  },
  {
    title: 'Guided Meditation · Session 2',
    url: 'https://www.youtube.com/watch?v=UFFx_b-rpOE&list=PLSGCbLKMPkC1I1jnlSKIqCllxhRu2fNTN&index=2',
  },
]
function loadGuides(): MedGuide[] {
  return safeGet<MedGuide[]>(MED_GUIDES_KEY, DEFAULT_GUIDES)
}
async function saveGuides(g: MedGuide[]) {
  safeSet(MED_GUIDES_KEY, g)
  if (!supabase) return
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user)
      sync.pushMedGuides(user.id, g).catch(() => {
        /* offline */
      })
  } catch {
    /* ignore */
  }
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
  const [craving, setCraving] = useState<CravingType | null>(null)
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

  // Paste-to-log: parse a pasted text block into reviewable food entries.
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [pasteStatus, setPasteStatus] = useState<'idle' | 'parsing' | 'error'>('idle')
  const [pasteError, setPasteError] = useState('')
  const [pasteRows, setPasteRows] = useState<QuickFood[] | null>(null)

  const [selSession, setSess] = useState<string | null>(null)
  const [wkNotes, setWkNotes] = useState('')
  const [wkSaved, setWkSaved] = useState(false)
  const [medMin, setMedMin] = useState(0)
  const [medStyle, setMedStyle] = useState('')
  const [medSaved, setMedSaved] = useState(false)
  const [energy, setEnergy] = useState(0)
  const [mood, setMood] = useState(0)
  const [sleep, setSleep] = useState(0)
  const [stress, setStress] = useState(0)
  const [water, setWater] = useState(0)
  const [phase, setPhase] = useState('')
  const [dayNotes, setDayNotes] = useState('')
  const [notesSaved, setNotesSaved] = useState(false)
  const [checkInSaved, setCheckInSaved] = useState(false)
  const [weekGoal, setWeekGoal] = useState('')
  const [weekGoalKind, setWeekGoalKind] = useState<WeekGoalKind>('goal')
  const [weekGoalResult, setWeekGoalResult] = useState<WeekGoalResult | ''>('')
  const [weekGoalNote, setWeekGoalNote] = useState('')
  const [weekSaved, setWeekSaved] = useState(false)
  const [stripKey, setStripKey] = useState(0)
  const [innerTab, setInnerTab] = useState<'food' | 'workout' | 'meditation'>('food')

  // Meditation guides
  const [guides, setGuides] = useState<MedGuide[]>(loadGuides)
  const [newGuideTitle, setNewGuideTitle] = useState('')
  const [newGuideUrl, setNewGuideUrl] = useState('')
  const [showAddGuide, setShowAddGuide] = useState(false)

  const loadDate = useCallback(
    (d: Date) => {
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
      setStress(data.stress ?? 0)
      setWater(data.water ?? 0)
      setPhase(data.phase ?? '')
      setDayNotes(data.notes ?? '')
      // Weekly goal lives on the week's Monday anchor day
      const wk = store.getDay(dkey(mondayOf(d)))
      setWeekGoal(wk.weekGoal ?? '')
      setWeekGoalKind(wk.weekGoalKind ?? 'goal')
      setWeekGoalResult(wk.weekGoalResult ?? '')
      setWeekGoalNote(wk.weekGoalNote ?? '')
      setWkSaved(!!data.workout)
      setMedSaved(!!data.medMin)
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
  const closePaste = () => {
    setPasteOpen(false)
    setPasteText('')
    setPasteRows(null)
    setPasteStatus('idle')
    setPasteError('')
  }

  const runParse = async () => {
    const text = pasteText.trim()
    if (!text) return
    setPasteStatus('parsing')
    setPasteError('')
    try {
      const rows = await parseFoodLog(text)
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('No foods found in that text')
      setPasteRows(rows)
      setPasteStatus('idle')
    } catch (err) {
      // Fall back to the offline parser (explicit macros + food-library matches).
      const local = parseFoodLogLocal(text, foodLib)
      if (local.length) {
        setPasteRows(local)
        setPasteStatus('idle')
      } else {
        setPasteStatus('error')
        setPasteError(
          err instanceof Error ? err.message : 'Could not read any foods from that text.',
        )
      }
    }
  }

  const updatePasteRow = (i: number, patch: Partial<QuickFood>) => {
    setPasteRows(rows => rows?.map((r, j) => (j === i ? { ...r, ...patch } : r)) ?? rows)
  }

  const removePasteRow = (i: number) => {
    setPasteRows(rows => rows?.filter((_, j) => j !== i) ?? rows)
  }

  const addParsedFoods = () => {
    const rows = (pasteRows ?? []).filter(r => r.n.trim() && r.k > 0)
    if (!rows.length) return
    const entries: FoodEntry[] = rows.map(r => ({
      n: r.n.trim(),
      k: r.k,
      p: r.p,
      c: r.c,
      f: r.f,
      fi: r.fi,
    }))
    // Remember per-serving macros so these foods autocomplete next time.
    let lib = foodLib
    for (const r of rows) lib = libStore.upsert(r)
    setFoodLib(lib)
    save({ foods: [...day.foods, ...entries] })
    closePaste()
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

  const logWorkout = () => {
    if (!selSession) {
      alert('Select a session type first.')
      return
    }
    save({ workout: selSession, wkNotes })
    setWkSaved(true)
  }

  const logMed = () => {
    if (!medMin) {
      alert('Select a duration first.')
      return
    }
    save({ medMin, medStyle })
    setMedSaved(true)
    setTimeout(() => setMedSaved(false), 1600)
  }

  const saveCheckIn = () => {
    save({ energy, mood, sleep, stress, phase })
    setCheckInSaved(true)
    setTimeout(() => setCheckInSaved(false), 1600)
  }

  const saveNotes = () => {
    save({ notes: dayNotes })
    setNotesSaved(true)
    setTimeout(() => setNotesSaved(false), 1600)
  }

  // Weekly goal persists on the week's Monday anchor day (not the viewed day)
  const saveWeekGoal = () => {
    const anchorKey = dkey(mondayOf(date))
    const updated: DayData = {
      ...store.getDay(anchorKey),
      weekGoal: weekGoal.trim(),
      weekGoalKind,
      weekGoalResult: weekGoalResult || undefined,
      weekGoalNote: weekGoalNote.trim() || undefined,
    }
    store.setDay(anchorKey, updated)
    if (anchorKey === dkey(date)) setDay(updated) // keep viewed-day state in sync
    setStripKey(n => n + 1)
    setWeekSaved(true)
    setTimeout(() => setWeekSaved(false), 1600)
  }

  // Last week's goal (read from the previous Monday anchor) for continuity
  const lastWeek = store.getDay(dkey(addDays(mondayOf(date), -7)))

  const addGuide = () => {
    const url = newGuideUrl.trim()
    if (!url) return
    const title = newGuideTitle.trim() || url
    const updated = [...guides, { title, url }]
    setGuides(updated)
    saveGuides(updated)
    setNewGuideTitle('')
    setNewGuideUrl('')
    setShowAddGuide(false)
  }

  const removeGuide = (i: number) => {
    const updated = guides.filter((_, j) => j !== i)
    setGuides(updated)
    saveGuides(updated)
  }

  const goDate = (delta: number) => {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d)
  }

  const phaseNote = PHASE_NOTES[phase] ?? PHASE_NOTES['']

  // ── Oura state ──────────────────────────────────────────────────
  const [ouraConnected, setOuraConnected] = useState(false)
  const [readiness, setReadiness] = useState<OuraReadiness | null>(null)
  const [wkSyncing, setWkSyncing] = useState(false)
  const [medSyncing, setMedSyncing] = useState(false)
  const [ouraHRV, setOuraHRV] = useState<number | null>(null)
  const [ouraHR, setOuraHR] = useState<number | null>(null)
  const [ouraMood, setOuraMood] = useState<string | null>(null)
  const [ouraActualMin, setOuraActualMin] = useState<number | null>(null)

  // Check connection status on mount
  useEffect(() => {
    isOuraConnected()
      .then(setOuraConnected)
      .catch(() => {})
  }, [])

  // Load readiness from cache on date change; auto-fetch from Oura if not cached
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setOuraHRV(null)
    setOuraHR(null)
    setOuraMood(null)
    setOuraActualMin(null)
    const dateStr = dkey(date)
    const cached = getCachedReadiness(dateStr)
    if (cached) {
      setReadiness(cached)
    } else {
      setReadiness(null)
      if (ouraConnected) {
        fetchOuraReadiness(dateStr)
          .then(data => {
            if (data) {
              setCachedReadiness(dateStr, data)
              setReadiness(data)
            }
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
      if (readinessData) {
        setCachedReadiness(dkey(date), readinessData)
        setReadiness(readinessData)
      }
      if (workouts.length === 0) {
        if (!readinessData) showToast('No Oura data found for this date.', 'info')
        return
      }
      const w = workouts[0]
      const mapped = OURA_ACTIVITY_MAP[w.activity] ?? null
      if (mapped) setSess(mapped)
      const dMin = Math.round(
        (new Date(w.end_datetime).getTime() - new Date(w.start_datetime).getTime()) / 60000,
      )
      const hrNote = w.average_heart_rate ? ` · avg HR ${w.average_heart_rate} bpm` : ''
      setWkNotes(`Oura: ${w.activity.replace(/_/g, ' ')} · ${dMin} min${hrNote}`)
    } catch (err: unknown) {
      showToast(reportError('oura-sync:workout', err), 'error')
    } finally {
      setWkSyncing(false)
    }
  }

  const syncMedFromOura = async () => {
    setMedSyncing(true)
    try {
      const sessions = await fetchOuraSessions(dkey(date))
      const med = sessions.find(s => s.type !== 'nap')
      if (!med) {
        showToast('No meditation session found for this date in Oura.', 'info')
        return
      }
      const dSec =
        (new Date(med.end_datetime).getTime() - new Date(med.start_datetime).getTime()) / 1000
      setMedMin(roundToMedMin(dSec))
      if (OURA_SESSION_MAP[med.type]) setMedStyle(OURA_SESSION_MAP[med.type])
      setOuraHRV(med.average_hrv)
      setOuraHR(med.average_heart_rate)
      setOuraMood(med.mood)
      setOuraActualMin(Math.round(dSec / 60))
    } catch (err: unknown) {
      showToast(reportError('oura-sync:meditation', err), 'error')
    } finally {
      setMedSyncing(false)
    }
  }

  // Auto-populate sleep stars from Oura when switching to check-in view
  const syncSleepFromOura = useCallback(async () => {
    if (!ouraConnected || sleep > 0) return // don't overwrite manually-set value
    try {
      const data = await fetchOuraSleep(dkey(date))
      if (data) setSleep(sleepScoreToStars(data.score))
    } catch {
      /* silent — sleep sync is best-effort */
    }
  }, [ouraConnected, sleep, date])

  // Auto-populate the stress scale from Oura daily_stress (same lazy pattern as sleep)
  const syncStressFromOura = useCallback(async () => {
    if (!ouraConnected || stress > 0) return // don't overwrite a manual/already-set value
    try {
      const data = await fetchOuraStress(dkey(date))
      const scaled = data && stressToScale(data)
      if (scaled) setStress(scaled)
    } catch {
      /* silent — stress sync is best-effort */
    }
  }, [ouraConnected, stress, date])

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
              <div className="mb-12" style={{ minHeight: 30 }}>
                {day.foods.length === 0 ? (
                  <div className="text-base text-muted2 italic" style={{ padding: '3px 0' }}>
                    No meals logged yet.
                  </div>
                ) : (
                  day.foods.map((f, i) => (
                    <div
                      key={i}
                      className={`food-log-item ${editIndex === i ? 'food-log-item--editing' : ''}`}
                    >
                      <div className="flex-1">
                        <div className="text-base text-default">
                          {f.n}
                          {f.r != null ? (
                            <button
                              className="recipe-link-badge"
                              title="Open recipe"
                              onClick={() => onOpenRecipe?.(f.r, f.n)}
                            >
                              📖
                            </button>
                          ) : null}
                          {f.s && f.s !== 1 ? (
                            <span className="text-muted2 text-2xs" style={{ marginLeft: 5 }}>
                              ×{f.s} srv
                            </span>
                          ) : null}
                          {f.sat ? (
                            <button
                              className="satiety-badge"
                              title="Satiety — tap to edit"
                              onClick={() => startEdit(i)}
                            >
                              🍽 {f.sat}/7
                            </button>
                          ) : null}
                          {f.hunger ? (
                            <span className="hunger-tag" title={`${hungerLabel(f.hunger)} hunger`}>
                              {hungerIcon(f.hunger)}
                            </span>
                          ) : null}
                        </div>
                        <div className="food-log-meta">
                          {f.k} kcal · {f.p}g P · {f.c}g C · {f.f}g F
                          {f.fi ? ` · ${f.fi}g fiber` : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => startEdit(i)}
                        title="Edit"
                        className={`food-edit-btn ${editIndex === i ? 'active' : ''}`}
                      >
                        ✏
                      </button>
                      <button onClick={() => removeFood(i)} className="food-remove-btn">
                        ×
                      </button>
                    </div>
                  ))
                )}
              </div>
              <div style={{ paddingTop: 12 }}>
                {/* Paste-to-log: parse a pasted block of meals into reviewable entries */}
                {!pasteOpen ? (
                  <button
                    onClick={() => setPasteOpen(true)}
                    className="paste-log-toggle"
                    data-testid="paste-log-toggle"
                  >
                    📋 Paste meals to log
                  </button>
                ) : (
                  <div className="paste-log-panel">
                    {pasteRows === null ? (
                      <>
                        <textarea
                          className="tinput resize-vertical w-full"
                          rows={5}
                          value={pasteText}
                          onChange={e => setPasteText(e.target.value)}
                          placeholder={
                            'Paste meals — one per line. e.g.\nGreek yogurt with berries\nChicken salad, 420 cal\nBerry Oats 350 18 42 12 9'
                          }
                          disabled={pasteStatus === 'parsing'}
                          data-testid="paste-log-input"
                        />
                        {pasteStatus === 'error' && (
                          <div className="paste-log-error" role="alert">
                            {pasteError}
                          </div>
                        )}
                        <div className="flex gap-6 justify-end mt-8">
                          <button onClick={closePaste} className="paste-log-cancel">
                            Cancel
                          </button>
                          <button
                            onClick={runParse}
                            disabled={pasteStatus === 'parsing' || !pasteText.trim()}
                            className="tbtn tbtn--teal"
                            style={{ width: 'auto' }}
                          >
                            {pasteStatus === 'parsing' ? 'Parsing…' : 'Parse'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="text-xs text-muted2 mb-6">
                          Review and edit before logging:
                        </div>
                        {pasteRows.length === 0 ? (
                          <div className="text-2xs text-muted2 italic mb-8">
                            Nothing left to add.
                          </div>
                        ) : (
                          pasteRows.map((r, i) => (
                            <div key={i} className="paste-log-row">
                              <input
                                className="tinput flex-1"
                                value={r.n}
                                onChange={e => updatePasteRow(i, { n: e.target.value })}
                                placeholder="Food name"
                              />
                              <div className="paste-log-macros">
                                {(
                                  [
                                    ['kcal', 'k'],
                                    ['P', 'p'],
                                    ['C', 'c'],
                                    ['F', 'f'],
                                    ['Fi', 'fi'],
                                  ] as [string, keyof QuickFood][]
                                ).map(([ph, key]) => (
                                  <input
                                    key={key}
                                    className="tnum"
                                    type="number"
                                    min="0"
                                    placeholder={ph}
                                    value={r[key] as number}
                                    onChange={e =>
                                      updatePasteRow(i, {
                                        [key]: Math.max(0, parseInt(e.target.value) || 0),
                                      })
                                    }
                                  />
                                ))}
                              </div>
                              <button
                                onClick={() => removePasteRow(i)}
                                className="food-remove-btn"
                                title="Remove"
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                        <div className="flex gap-6 justify-end mt-8">
                          <button onClick={closePaste} className="paste-log-cancel">
                            Cancel
                          </button>
                          <button
                            onClick={addParsedFoods}
                            disabled={!pasteRows.some(r => r.n.trim() && r.k > 0)}
                            className="tbtn tbtn--teal"
                            style={{ width: 'auto' }}
                            data-testid="paste-log-add"
                          >
                            + Add {pasteRows.filter(r => r.n.trim() && r.k > 0).length} food
                            {pasteRows.filter(r => r.n.trim() && r.k > 0).length === 1 ? '' : 's'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}

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
                <div className="mb-8">
                  <div className="text-xs text-muted2 mb-6">What kind of hunger? (optional)</div>
                  <div className="flex flex-wrap gap-6">
                    {HUNGER_TYPES.map(h => (
                      <button
                        key={h.id}
                        onClick={() => {
                          setFHunger(fHunger === h.id ? '' : h.id)
                          setCraving(null)
                        }}
                        className={`hunger-chip${fHunger === h.id ? ' active' : ''}`}
                      >
                        {h.icon} {h.label}
                      </button>
                    ))}
                  </div>
                  {(fHunger === 'mouth' || fHunger === 'emotional') && (
                    <div className="craving-helper">
                      <div className="text-2xs text-muted2 mb-6">
                        Craving something? A swap can hit the same note:
                      </div>
                      <div className="flex flex-wrap gap-6">
                        {CRAVING_TYPES.map(c => (
                          <button
                            key={c}
                            onClick={() => setCraving(craving === c ? null : c)}
                            className={`craving-chip${craving === c ? ' active' : ''}`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                      {craving && (
                        <ul className="swap-list">
                          {swapsFor(craving).map((s, i) => (
                            <li key={i}>
                              <span className="swap-from">{s.from}</span> →{' '}
                              <span className="swap-to">{s.to}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

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
                <div className="text-xs text-muted2 mb-6">Quick-add from recent meals:</div>
                <div className="flex flex-wrap gap-6 mb-8">
                  {recentMeals.length === 0 ? (
                    <span className="text-muted2 italic text-2xs">
                      Meals you log will appear here.
                    </span>
                  ) : (
                    recentMeals.map((f, i) => (
                      <button key={i} onClick={() => quickAdd(f)} className="quick-food-btn">
                        {f.n} ({f.k}
                        {f.s && f.s !== 1 ? ` ×${f.s}srv` : ''})
                      </button>
                    ))
                  )}
                </div>
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
          <details className="swap-reference tcard">
            <summary>🔁 Craving swaps — lower-density picks that hit the same note</summary>
            {CRAVING_TYPES.map(c => (
              <div key={c}>
                <div className="swap-group-title">{c}</div>
                <ul className="swap-list">
                  {swapsFor(c).map((s, i) => (
                    <li key={i}>
                      <span className="swap-from">{s.from}</span> →{' '}
                      <span className="swap-to">{s.to}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </details>

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
            <div className="tlabel" style={{ color: 'var(--coral)', marginBottom: 0 }}>
              Workout log · 4:30 PM
            </div>
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
            <div
              className="readiness-badge"
              style={{ border: `1px solid ${readinessColor(readiness.score)}40` }}
            >
              <div
                className="readiness-score flex-center"
                style={{
                  background: `${readinessColor(readiness.score)}20`,
                  border: `2px solid ${readinessColor(readiness.score)}`,
                  color: readinessColor(readiness.score),
                }}
              >
                {readiness.score}
              </div>
              <div>
                <div
                  className="text-sm font-600"
                  style={{ color: readinessColor(readiness.score) }}
                >
                  {readinessLabel(readiness.score)}
                </div>
                <div className="font-mono text-muted2 text-2xs">
                  HRV balance {readiness.contributors.hrv_balance} · Recovery{' '}
                  {readiness.contributors.recovery_index}
                </div>
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
              >
                {s.label}
              </button>
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
          <textarea
            className="tinput resize-vertical mb-8"
            value={wkNotes}
            onChange={e => setWkNotes(e.target.value)}
            placeholder="How did it feel? PRs? Modifications?"
            rows={3}
          />
          <button onClick={logWorkout} className="tbtn tbtn--coral">
            + Log workout
          </button>
        </div>
      )}

      {/* ── Meditation ── */}
      {innerTab === 'meditation' && (
        <div className="flex flex-col gap-12">
          {/* Meditation */}
          <div className="tcard">
            <div className="flex-between mb-6">
              <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>
                Meditation · 8:45 AM
              </div>
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
                {ouraHR !== null && (
                  <span className="oura-badge oura-badge--green">HR {ouraHR} bpm</span>
                )}
                {ouraActualMin !== null && ouraActualMin !== medMin && (
                  <span
                    className="oura-badge oura-badge--muted"
                    title={`Actual: ${ouraActualMin} min — rounded to nearest option`}
                  >
                    actual {ouraActualMin} min
                  </span>
                )}
                {ouraMood && (
                  <span className="oura-badge oura-badge--purple">feeling: {ouraMood}</span>
                )}
              </div>
            )}

            <div className="text-sm text-muted mb-10 lh-15">
              Optimal post-CAR window. Even 13 minutes measurably improves focus and working memory
              for hours.
            </div>
            <div className="text-sm text-muted mb-6">Duration:</div>
            <div className="flex flex-wrap gap-6 mb-10">
              {MED_MINS.map(m => (
                <button
                  key={m}
                  onClick={() => setMedMin(medMin === m ? 0 : m)}
                  className={`med-min-btn ${medMin === m ? 'active' : ''}`}
                >
                  {m} min
                </button>
              ))}
            </div>
            <div className="text-sm text-muted mb-6">Style:</div>
            <div className="flex flex-wrap gap-6 mb-10">
              {MED_STYLES.map(s => (
                <button
                  key={s}
                  onClick={() => setMedStyle(medStyle === s ? '' : s)}
                  className={`med-style-btn ${medStyle === s ? 'active' : ''}`}
                >
                  {s}
                </button>
              ))}
            </div>
            {day.medMin > 0 && (
              <div className="med-done">
                Done: {day.medMin} min{day.medStyle ? ` - ${day.medStyle}` : ''}
              </div>
            )}
            <button onClick={logMed} className={`tbtn btn-gold ${medSaved ? 'saved' : ''}`}>
              {medSaved ? 'Saved!' : 'Log meditation'}
            </button>
          </div>

          {/* Favorite guides */}
          <div className="tcard">
            <div className="flex-between mb-10">
              <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>
                Favorite Guides
              </div>
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
                  <span className="text-base" style={{ color: 'var(--gold)' }}>
                    ▶
                  </span>
                  <a href={g.url} target="_blank" rel="noopener noreferrer" className="guide-link">
                    {g.title}
                  </a>
                  <button
                    onClick={() => removeGuide(i)}
                    title="Remove"
                    className="item-icon-btn text-lg"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            {showAddGuide && (
              <div className="flex flex-col gap-6">
                <input
                  className="tinput"
                  value={newGuideTitle}
                  onChange={e => setNewGuideTitle(e.target.value)}
                  placeholder="Title (e.g. Morning Calm · 13 min)"
                />
                <input
                  className="tinput"
                  value={newGuideUrl}
                  onChange={e => setNewGuideUrl(e.target.value)}
                  placeholder="URL"
                  onKeyDown={e => e.key === 'Enter' && addGuide()}
                />
                <button onClick={addGuide} className="tbtn btn-gold">
                  Add guide
                </button>
              </div>
            )}
          </div>

          {/* Daily check-in */}
          <div
            className="tcard"
            onFocus={() => {
              syncSleepFromOura()
              syncStressFromOura()
            }}
            onMouseEnter={() => {
              syncSleepFromOura()
              syncStressFromOura()
            }}
          >
            <div className="tlabel" style={{ color: 'var(--purple)' }}>
              Daily check-in
            </div>
            <div className="flex flex-col gap-12">
              <div>
                <div className="text-sm text-muted mb-6">Energy ⚡</div>
                <StarRow
                  value={energy}
                  onChange={setEnergy}
                  emoji="E"
                  lowLabel="Drained"
                  highLabel="Peaked"
                />
              </div>
              <div>
                <div className="text-sm text-muted mb-6">Mood 😊</div>
                <StarRow
                  value={mood}
                  onChange={setMood}
                  emoji="M"
                  lowLabel="Low"
                  highLabel="Bright"
                />
              </div>
              <div>
                <div className="text-sm text-muted mb-6">Sleep 🌙</div>
                <StarRow
                  value={sleep}
                  onChange={setSleep}
                  emoji="Z"
                  lowLabel="Poor"
                  highLabel="Restorative"
                />
              </div>
              <div>
                <div className="text-sm text-muted mb-6">
                  Stress 🧠
                  {ouraConnected && (
                    <span className="text-2xs text-muted2" style={{ marginLeft: 6 }}>
                      auto from Oura · tap to override
                    </span>
                  )}
                </div>
                <StarRow
                  value={stress}
                  onChange={setStress}
                  emoji="S"
                  lowLabel="Calm"
                  highLabel="Stressed"
                />
              </div>
              <div>
                <div className="text-sm text-muted mb-6">Cycle phase</div>
                <div className="flex gap-6 flex-wrap">
                  {(['Menstrual', 'Follicular', 'Ovulatory', 'Luteal', 'Unsure'] as const).map(
                    (p, i) => {
                      const colors = [
                        'var(--purple)',
                        'var(--green)',
                        'var(--teal)',
                        'var(--amber)',
                        'var(--muted2)',
                      ]
                      const active = phase === p
                      return (
                        <button
                          key={p}
                          onClick={() => setPhase(active ? '' : p)}
                          className="phase-btn"
                          style={{
                            border: `1px solid ${active ? colors[i] : 'var(--border)'}`,
                            background: active ? `${colors[i]}20` : 'var(--bg3)',
                            color: active ? colors[i] : 'var(--muted)',
                          }}
                        >
                          {p}
                        </button>
                      )
                    },
                  )}
                </div>
              </div>
              <button
                onClick={saveCheckIn}
                className={`tbtn ${checkInSaved ? 'tbtn--green' : 'tbtn--secondary'}`}
              >
                {checkInSaved ? 'Saved!' : 'Save check-in'}
              </button>
            </div>
          </div>

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

          {/* Weekly goal / experiment */}
          <div className="tcard">
            <div className="flex-between mb-8">
              <div className="tlabel" style={{ color: 'var(--green-light)', marginBottom: 0 }}>
                Weekly goal
              </div>
              <div className="flex gap-6">
                {(['goal', 'experiment'] as WeekGoalKind[]).map(k => (
                  <button
                    key={k}
                    onClick={() => setWeekGoalKind(k)}
                    className={`rfbtn${weekGoalKind === k ? ' active' : ''}`}
                    style={{ textTransform: 'capitalize' }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </div>

            {lastWeek.weekGoal && (
              <div className="last-week-note">
                Last week: “{lastWeek.weekGoal}”
                {lastWeek.weekGoalResult ? ` — ${WEEK_RESULT_LABEL[lastWeek.weekGoalResult]}` : ''}
              </div>
            )}

            <div className="text-sm text-muted mb-6">
              {weekGoalKind === 'goal' ? "This week's SMART goal" : 'Experiment — “If I…, then…”'}
            </div>
            <textarea
              className="tinput resize-vertical mb-8"
              rows={2}
              value={weekGoal}
              onChange={e => setWeekGoal(e.target.value)}
              placeholder={
                weekGoalKind === 'goal'
                  ? 'e.g. Protein at every meal'
                  : 'e.g. If I prep 3 lunches on Sunday, then I eat out less'
              }
            />

            {!weekGoal && (
              <div className="flex flex-wrap gap-6 mb-8">
                {WEEK_GOAL_SUGGESTIONS.map(s => (
                  <button key={s} onClick={() => setWeekGoal(s)} className="quick-food-btn">
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div className="text-sm text-muted mb-6">
              {weekGoalKind === 'goal' ? 'Did you hit it?' : 'Result'}
            </div>
            <div className="flex gap-6 mb-8">
              {(['yes', 'partial', 'no'] as WeekGoalResult[]).map(r => (
                <button
                  key={r}
                  onClick={() => setWeekGoalResult(weekGoalResult === r ? '' : r)}
                  className={`rfbtn${weekGoalResult === r ? ' active' : ''}`}
                >
                  {WEEK_RESULT_LABEL[r]}
                </button>
              ))}
            </div>

            <textarea
              className="tinput resize-vertical mb-8"
              rows={2}
              value={weekGoalNote}
              onChange={e => setWeekGoalNote(e.target.value)}
              placeholder="Reflection — what worked, what got in the way…"
            />

            <button
              onClick={saveWeekGoal}
              className={`tbtn tbtn--secondary ${weekSaved ? 'saved' : ''}`}
            >
              {weekSaved ? 'Saved!' : 'Save weekly'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
