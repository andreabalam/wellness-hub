import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import ScheduleTab from './components/ScheduleTab'
import WorkoutsTab from './components/WorkoutsTab'
import RecipesTab from './components/RecipesTab'
import type { OpenRecipeRequest } from './components/RecipesTab'
import TrackerTab from './components/TrackerTab'
import OuraTab from './components/OuraTab'
import UpdatePrompt from './components/UpdatePrompt'
import AuthButton from './components/AuthButton'
import ErrorBoundary from './components/ErrorBoundary'
import SharedRecipeView from './components/SharedRecipeView'
import { parseShareRoute } from './lib/recipeShare'
import { supabase } from './lib/supabase'
import { consumeOAuthCallback } from './lib/oura'
import * as sync from './lib/sync'
import type { MedGuide } from './lib/sync'
import { safeGet } from './lib/storage'
import { reportError } from './lib/errorLog'
import { showToast } from './lib/toast'
import { ToastHost } from './components/common'
import {
  trackerStore,
  recipeStore,
  groceryStore,
  foodLibraryStore,
  scheduleStore,
  groceryCatalogStore,
  remindersStore,
  importRemoteData,
  MED_GUIDES_KEY,
  exportAllData,
  importAllData,
  userSettingsStore,
  bodyStatsStore,
  workoutPlanStore,
  syncStatusStore,
} from './hooks/useStore'

type Tab = 'tracker' | 'recipes' | 'workouts' | 'schedule' | 'oura'

// Consume the OAuth callback once at module load — before React mounts.
// Must live outside any component: React StrictMode calls useState lazy
// initializers twice in development, which would remove oura_oauth_state
// on the first invocation so the second invocation fails the CSRF check.
const _initialTab: Tab = consumeOAuthCallback() ? 'oura' : 'tracker'

const TABS: { id: Tab; label: string }[] = [
  { id: 'tracker', label: '📊 Tracker' },
  { id: 'recipes', label: '🍽 Recipes' },
  { id: 'workouts', label: '💪 Workouts' },
  { id: 'schedule', label: '📅 Schedule' },
  { id: 'oura', label: '🫀 Oura' },
]

export default function App() {
  const [active, setActive] = useState<Tab>(_initialTab)
  // Lazy-init from window so we avoid setState inside the effect below
  const [swUpdate, setSwUpdate] = useState<(() => void) | null>(
    () => window.__swPendingUpdate ?? null,
  )

  // DEV-only: E2E tests can inject a mock user via localStorage.__e2e_user__
  // so auth-gated components render without a real Supabase session.
  const e2eUser = import.meta.env.DEV
    ? (() => {
        try {
          return JSON.parse(sessionStorage.getItem('__e2e_user__') ?? 'null') as User | null
        } catch {
          return null
        }
      })()
    : null

  const [user, setUser] = useState<User | null>(e2eUser)
  // Shared-recipe deep link (#/r/<token>) — renders a standalone view when present
  const [shareToken, setShareToken] = useState<string | null>(() => parseShareRoute(location.hash))
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)
  // True when local writes failed to reach Supabase and are awaiting the next
  // sync. Persisted in localStorage so it survives reloads (offline edits).
  const [syncPending, setSyncPending] = useState(() => syncStatusStore.isPending())
  useEffect(() => syncStatusStore.subscribe(setSyncPending), [])
  // Guards against overlapping syncAll runs (sign-in + manual "sync now" +
  // auth-change can fire close together) which could interleave reads/writes.
  const syncInFlight = useRef(false)
  // Incremented after each syncAll — used as TrackerTab key so it remounts fresh
  // and reads the synced localStorage data rather than keeping its pre-sync state.
  const [syncVersion, setSyncVersion] = useState(0)

  // Tracker 📖 badge → switch to Recipes and expand the linked recipe
  const [recipeOpenReq, setRecipeOpenReq] = useState<OpenRecipeRequest | null>(null)
  const openRecipe = useCallback((id: number | undefined, name: string) => {
    setRecipeOpenReq({ id, name, seq: Date.now() })
    setActive('recipes')
  }, [])

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
      if (ok) location.reload()
      else
        showToast(
          'Import failed. Make sure you are using a backup file exported from this Hub.',
          'error',
        )
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Bidirectional sync on sign-in ─────────────────────────────
  const syncAll = useCallback(async (userId: string) => {
    if (!supabase) return
    if (syncInFlight.current) return // A5: never let two syncAll runs interleave
    syncInFlight.current = true
    setSyncing(true)
    try {
      // ── Pull phase ─────────────────────────────────────────────
      const [
        remoteDays,
        remoteTags,
        remoteGrocery,
        remoteFoodLib,
        remoteWeekSchedule,
        remoteMedGuides,
        remoteGroceryCatalog,
        remoteReminders,
      ] = await Promise.all([
        sync.pullAllDays(userId),
        sync.pullTags(userId),
        sync.pullGrocery(userId),
        sync.pullFoodLibrary(userId),
        sync.pullWeekSchedule(userId),
        sync.pullMedGuides(userId),
        sync.pullUserGroceryCatalog(userId),
        sync.fetchReminders(userId),
      ])

      // Merge: remote wins for tracker day conflicts (another device is authoritative);
      // tags, grocery, and food library are unioned so local-only items are never lost.
      const mergedTags = [...new Set([...recipeStore.getTags(), ...remoteTags])]
      const mergedGrocery = [...new Set([...groceryStore.getChecked(), ...remoteGrocery])]

      // Food library: remote wins per name (most recently upserted value)
      const localLib = foodLibraryStore.getAll()
      const remoteLibNames = new Set(remoteFoodLib.map(f => f.n.toLowerCase()))
      const mergedFoodLib = [
        ...remoteFoodLib,
        ...localLib.filter(f => !remoteLibNames.has(f.n.toLowerCase())),
      ]

      // Week schedule: remote wins; fall back to local if no remote copy exists yet
      const localWeekSchedule = scheduleStore.getWeek()
      const mergedWeekSchedule = remoteWeekSchedule ?? localWeekSchedule

      // Med guides: remote wins; fall back to local if no remote copy exists yet
      const localMedGuides = safeGet<MedGuide[] | null>(MED_GUIDES_KEY, null)
      const mergedMedGuides = remoteMedGuides ?? localMedGuides

      // Reminders: union by id — remote wins per id, local-only reminders are kept
      const localReminders = remindersStore.getAll()
      const remoteReminderIds = new Set(remoteReminders.map(r => r.id))
      const mergedReminders = [
        ...remoteReminders,
        ...localReminders.filter(r => !remoteReminderIds.has(r.id)),
      ]

      // Grocery catalog: remote wins per id; local-only items are kept
      const localCatalog = groceryCatalogStore.getAll()
      const remoteIds = new Set((remoteGroceryCatalog ?? []).map(i => i.id))
      const mergedGroceryCatalog =
        remoteGroceryCatalog !== null
          ? [...(remoteGroceryCatalog ?? []), ...localCatalog.filter(i => !remoteIds.has(i.id))]
          : localCatalog

      // A5: re-read tracker days right before writing so a day edited during the
      // pull window survives. Remote still wins same-day conflicts (the rule),
      // but a brand-new local-only edit is no longer clobbered by stale state.
      const mergedDays = { ...trackerStore.getAll(), ...remoteDays }

      // Write merged data to localStorage (bypasses push to avoid a loop)
      importRemoteData({
        tracker: mergedDays,
        tags: mergedTags,
        grocery: mergedGrocery,
        foodLibrary: mergedFoodLib,
        ...(mergedWeekSchedule ? { weekSchedule: mergedWeekSchedule } : {}),
        ...(mergedMedGuides ? { medGuides: mergedMedGuides } : {}),
        ...(mergedGroceryCatalog.length ? { groceryCatalog: mergedGroceryCatalog } : {}),
        reminders: mergedReminders,
      })

      // User settings / body stats / workout plan: remote wins; settings push
      // happens only when there's no remote copy yet (included in the push batch).
      const remoteSettings = await sync.fetchUserSettings(userId).catch(() => null)
      if (remoteSettings) userSettingsStore.importFromRemote(remoteSettings)
      const remoteBodyStats = await sync.fetchUserBodyStats(userId).catch(() => null)
      if (remoteBodyStats) bodyStatsStore.importFromRemote(remoteBodyStats)
      const remoteWorkoutPlan = await sync.fetchUserWorkoutPlan(userId).catch(() => null)
      if (remoteWorkoutPlan) workoutPlanStore.importFromRemote(remoteWorkoutPlan)

      // ── Push phase ── push merged data back so local-only items reach Supabase.
      // A4: a failure here flips the pending flag (rather than being swallowed) so
      // the UI can show "changes not synced" and the next syncAll reconciles it.
      try {
        await Promise.all([
          ...Object.entries(mergedDays).map(([date, data]) => sync.pushDay(userId, date, data)),
          sync.pushTags(userId, mergedTags),
          sync.pushGrocery(userId, mergedGrocery),
          sync.pushFoodLibrary(userId, mergedFoodLib),
          ...(mergedWeekSchedule ? [sync.pushWeekSchedule(userId, mergedWeekSchedule)] : []),
          ...(mergedMedGuides ? [sync.pushMedGuides(userId, mergedMedGuides)] : []),
          ...(mergedGroceryCatalog.length
            ? [sync.pushUserGroceryCatalog(userId, mergedGroceryCatalog)]
            : []),
          ...mergedReminders.map(r => sync.upsertReminder(userId, r)),
          ...(remoteSettings ? [] : [sync.upsertUserSettings(userId, userSettingsStore.get())]),
        ])
        syncStatusStore.clear() // everything confirmed in the cloud
      } catch (pushErr) {
        reportError('syncAll:push', pushErr)
        syncStatusStore.markPending()
      }

      setLastSynced(new Date())
      setSyncVersion(v => v + 1)
    } catch (err) {
      showToast(reportError('syncAll:pull', err), 'error')
    } finally {
      setSyncing(false)
      syncInFlight.current = false
    }
  }, [])

  // ── Auth state listener ───────────────────────────────────────
  useEffect(() => {
    if (!supabase || e2eUser) return // skip for DEV mock user

    // Check for an existing session (handles magic link redirect on page load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        syncAll(session.user.id)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null
      setUser(nextUser)
      if (nextUser) syncAll(nextUser.id)
      else setLastSynced(null)
    })
    return () => subscription.unsubscribe()
  }, [syncAll, e2eUser])

  // ── SW update prompt ─────────────────────────────────────────
  useEffect(() => {
    // window.__swPendingUpdate is read once at mount via lazy useState above.
    // Here we only wire up the callback for future SW updates.
    window.__swOnUpdate = (cb: () => void) => setSwUpdate(() => cb)
    return () => {
      window.__swOnUpdate = undefined
    }
  }, [])

  // ── Shared-recipe deep link routing ──────────────────────────
  useEffect(() => {
    const onHash = () => setShareToken(parseShareRoute(location.hash))
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  if (shareToken) {
    return (
      <ErrorBoundary name="SharedRecipe">
        <SharedRecipeView
          token={shareToken}
          user={user}
          onExit={() => {
            location.hash = ''
            setShareToken(null)
          }}
        />
        <AuthButton
          user={user}
          syncing={syncing}
          lastSynced={lastSynced}
          syncPending={syncPending}
          onSynced={() => user && syncAll(user.id)}
          onExport={handleExport}
          onImportFile={handleImport}
        />
      </ErrorBoundary>
    )
  }

  return (
    <>
      <header className="hdr">
        <div className="hdr-top">
          <div className="htitle">
            My <em>Wellness Hub</em>
          </div>
          <AuthButton
            user={user}
            syncing={syncing}
            lastSynced={lastSynced}
            syncPending={syncPending}
            onSynced={() => user && syncAll(user.id)}
            onExport={handleExport}
            onImportFile={handleImport}
          />
        </div>
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab${active === t.id ? ' active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <ErrorBoundary name="Schedule">
        <div className={`view${active === 'schedule' ? ' active' : ''}`}>
          <ScheduleTab user={user} />
        </div>
      </ErrorBoundary>
      <ErrorBoundary name="Workouts">
        <div className={`view${active === 'workouts' ? ' active' : ''}`}>
          <WorkoutsTab user={user} />
        </div>
      </ErrorBoundary>
      <ErrorBoundary name="Recipes">
        <div className={`view${active === 'recipes' ? ' active' : ''}`}>
          <RecipesTab user={user} openRequest={recipeOpenReq} />
        </div>
      </ErrorBoundary>
      <ErrorBoundary name="Tracker">
        <div className={`view${active === 'tracker' ? ' active' : ''}`}>
          {active === 'tracker' && (
            <TrackerTab key={syncVersion} user={user} onOpenRecipe={openRecipe} />
          )}
        </div>
      </ErrorBoundary>

      <ErrorBoundary name="Oura">
        <div className={`view${active === 'oura' ? ' active' : ''}`}>
          <OuraTab user={user} />
        </div>
      </ErrorBoundary>

      <UpdatePrompt onUpdate={swUpdate} />
      <ToastHost />
    </>
  )
}
