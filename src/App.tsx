import { useState, useEffect, useCallback, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import WorkoutsTab from './components/WorkoutsTab'
import RecipesTab from './components/RecipesTab'
import type { OpenRecipeRequest } from './components/RecipesTab'
import TrackerTab from './components/TrackerTab'
import TodayTab from './components/TodayTab'
import InsightsTab from './components/InsightsTab'
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

type Tab = 'today' | 'food' | 'workouts' | 'insights'

// Consume the OAuth callback once at module load — before React mounts.
// Must live outside any component: React StrictMode calls useState lazy
// initializers twice in development, which would remove oura_oauth_state
// on the first invocation so the second invocation fails the CSRF check.
const _initialTab: Tab = consumeOAuthCallback() ? 'insights' : 'today'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'today', icon: '☀️', label: 'Today' },
  { id: 'food', icon: '🍎', label: 'Food' },
  { id: 'workouts', icon: '💪', label: 'Train' },
  { id: 'insights', icon: '📈', label: 'Insights' },
]

type FoodView = 'log' | 'recipes'

export default function App() {
  const [active, setActive] = useState<Tab>(_initialTab)
  // Food tab: the day's log or the recipe library (with grocery list)
  const [foodView, setFoodView] = useState<FoodView>('log')
  // Day viewed in Today and Food — shared so switching tabs keeps the same day
  const [dayDate, setDayDate] = useState(() => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  })
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

  // Food log 📖 badge → switch to Food › Recipes and expand the linked recipe
  const [recipeOpenReq, setRecipeOpenReq] = useState<OpenRecipeRequest | null>(null)
  const openRecipe = useCallback((id: number | undefined, name: string) => {
    setRecipeOpenReq({ id, name, seq: Date.now() })
    setActive('food')
    setFoodView('recipes')
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

      // Grocery catalog: remote wins per id; local-only items are kept.
      // A final name-based dedup pass removes any duplicates created by earlier
      // seeding sessions that used random IDs (same item name, different id).
      const localCatalog = groceryCatalogStore.getAll()
      const remoteIds = new Set((remoteGroceryCatalog ?? []).map(i => i.id))
      const rawMergedCatalog =
        remoteGroceryCatalog !== null
          ? [...(remoteGroceryCatalog ?? []), ...localCatalog.filter(i => !remoteIds.has(i.id))]
          : localCatalog
      const seenCatalogNames = new Set<string>()
      const mergedGroceryCatalog = rawMergedCatalog.filter(i => {
        const key = i.n.trim().toLowerCase()
        if (seenCatalogNames.has(key)) return false
        seenCatalogNames.add(key)
        return true
      })

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
        <nav className="tabs" role="tablist" aria-label="Main sections">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active === t.id}
              aria-controls={`panel-${t.id}`}
              className={`tab${active === t.id ? ' active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              <span className="tab__icon" aria-hidden="true">
                {t.icon}
              </span>{' '}
              <span className="tab__label">{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <ErrorBoundary name="Workouts">
        <div
          role="tabpanel"
          id="panel-workouts"
          aria-labelledby="tab-workouts"
          hidden={active !== 'workouts'}
          className={`view${active === 'workouts' ? ' active' : ''}`}
        >
          <WorkoutsTab user={user} />
        </div>
      </ErrorBoundary>
      {/* Today and Food mount only while active (date calculations on load) */}
      <ErrorBoundary name="Today">
        <div
          role="tabpanel"
          id="panel-today"
          aria-labelledby="tab-today"
          hidden={active !== 'today'}
          className={`view${active === 'today' ? ' active' : ''}`}
        >
          {active === 'today' && (
            <TodayTab
              key={syncVersion}
              user={user}
              date={dayDate}
              onDateChange={setDayDate}
              onOpenFood={() => setActive('food')}
              onOpenTrain={() => setActive('workouts')}
            />
          )}
        </div>
      </ErrorBoundary>
      <ErrorBoundary name="Food">
        <div
          role="tabpanel"
          id="panel-food"
          aria-labelledby="tab-food"
          hidden={active !== 'food'}
          className={`view${active === 'food' ? ' active' : ''}`}
        >
          <div className="segmented food-switch" role="tablist" aria-label="Food">
            {(['log', 'recipes'] as const).map(v => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={foodView === v}
                className={`segmented__btn${foodView === v ? ' active' : ''}`}
                onClick={() => setFoodView(v)}
              >
                {v === 'log' ? 'Log' : 'Recipes & grocery'}
              </button>
            ))}
          </div>
          {active === 'food' && foodView === 'log' && (
            <TrackerTab
              key={syncVersion}
              user={user}
              onOpenRecipe={openRecipe}
              date={dayDate}
              onDateChange={setDayDate}
            />
          )}
          {/* Recipes stay mounted (search, filters and open cards survive switching) */}
          <div hidden={foodView !== 'recipes'}>
            <RecipesTab user={user} openRequest={recipeOpenReq} />
          </div>
        </div>
      </ErrorBoundary>

      <ErrorBoundary name="Insights">
        <div
          role="tabpanel"
          id="panel-insights"
          aria-labelledby="tab-insights"
          hidden={active !== 'insights'}
          className={`view${active === 'insights' ? ' active' : ''}`}
        >
          {/* Mounted only while active: roll-ups read every tracker day */}
          {active === 'insights' && <InsightsTab key={syncVersion} user={user} />}
        </div>
      </ErrorBoundary>

      <UpdatePrompt onUpdate={swUpdate} />
      <ToastHost />
    </>
  )
}
