import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import ScheduleTab from './components/ScheduleTab'
import WorkoutsTab from './components/WorkoutsTab'
import RecipesTab from './components/RecipesTab'
import TrackerTab from './components/TrackerTab'
import UpdatePrompt from './components/UpdatePrompt'
import AuthButton from './components/AuthButton'
import { supabase } from './lib/supabase'
import * as sync from './lib/sync'
import { trackerStore, recipeStore, groceryStore, foodLibraryStore, scheduleStore, importRemoteData } from './hooks/useStore'

type Tab = 'tracker' | 'recipes' | 'workouts' | 'schedule'

const TABS: { id: Tab; label: string }[] = [
  { id: 'tracker',  label: '📊 Tracker' },
  { id: 'recipes',  label: '🍽 Recipes' },
  { id: 'workouts', label: '💪 Workouts' },
  { id: 'schedule', label: '📅 Schedule' },
]

export default function App() {
  const [active, setActive]       = useState<Tab>('tracker')
  const [swUpdate, setSwUpdate]   = useState<(() => void) | null>(null)
  const [user, setUser]           = useState<User | null>(null)
  const [syncing, setSyncing]     = useState(false)
  const [lastSynced, setLastSynced] = useState<Date | null>(null)

  // ── Bidirectional sync on sign-in ─────────────────────────────
  const syncAll = useCallback(async (userId: string) => {
    if (!supabase) return
    setSyncing(true)
    try {
      // Pull remote data
      const [remoteDays, remoteRecipes, remoteTags, remoteGrocery, remoteFoodLib, remoteSchedule, remoteMedGuides] = await Promise.all([
        sync.pullAllDays(userId),
        sync.pullRecipes(userId),
        sync.pullTags(userId),
        sync.pullGrocery(userId),
        sync.pullFoodLibrary(userId),
        sync.pullSchedule(userId),
        sync.pullMedGuides(userId),
      ])

      // Merge: remote wins for tracker day conflicts (another device is authoritative);
      // recipes, tags, grocery, food library are unioned so local-only items are never lost.
      const localDays = trackerStore.getAll()
      const mergedDays = { ...localDays, ...remoteDays }

      const localRecipes = recipeStore.getRecipes()
      const remoteIds    = new Set(remoteRecipes.map(r => r.id))
      const mergedRecipes = [
        ...remoteRecipes,
        ...localRecipes.filter(r => !remoteIds.has(r.id)),
      ]

      const mergedTags    = [...new Set([...recipeStore.getTags(), ...remoteTags])]
      const mergedGrocery = [...new Set([...groceryStore.getChecked(), ...remoteGrocery])]

      // Food library: remote wins per name (most recently upserted value)
      const localLib = foodLibraryStore.getAll()
      const remoteLibNames = new Set(remoteFoodLib.map(f => f.n.toLowerCase()))
      const mergedFoodLib = [
        ...remoteFoodLib,
        ...localLib.filter(f => !remoteLibNames.has(f.n.toLowerCase())),
      ]

      // Schedule: remote wins; fall back to local if no remote copy exists yet
      const localSchedule = scheduleStore.getBlocks()
      const mergedSchedule = remoteSchedule ?? localSchedule

      // Med guides: remote wins; fall back to local if no remote copy exists yet
      const localMedGuides = (() => {
        try { return JSON.parse(localStorage.getItem('whub_med_guides_v1') ?? 'null') ?? null }
        catch { return null }
      })()
      const mergedMedGuides = remoteMedGuides ?? localMedGuides

      // Write merged data to localStorage (bypasses push to avoid a loop)
      importRemoteData({
        tracker:     mergedDays,
        recipes:     mergedRecipes,
        tags:        mergedTags,
        grocery:     mergedGrocery,
        foodLibrary: mergedFoodLib,
        ...(mergedSchedule   ? { schedule:   mergedSchedule   } : {}),
        ...(mergedMedGuides  ? { medGuides:  mergedMedGuides  } : {}),
      })

      // Push merged data back so any local-only items reach Supabase
      await Promise.all([
        ...Object.entries(mergedDays).map(([date, data]) =>
          sync.pushDay(userId, date, data)
        ),
        sync.pushRecipes(userId, mergedRecipes),
        sync.pushTags(userId, mergedTags),
        sync.pushGrocery(userId, mergedGrocery),
        sync.pushFoodLibrary(userId, mergedFoodLib),
        ...(mergedSchedule  ? [sync.pushSchedule(userId, mergedSchedule)]       : []),
        ...(mergedMedGuides ? [sync.pushMedGuides(userId, mergedMedGuides)]      : []),
      ])

      setLastSynced(new Date())
    } catch (err) {
      console.warn('[sync] syncAll failed:', err)
    } finally {
      setSyncing(false)
    }
  }, [])

  // ── Auth state listener ───────────────────────────────────────
  useEffect(() => {
    if (!supabase) return

    // Check for an existing session (handles magic link redirect on page load)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        syncAll(session.user.id)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null
        setUser(nextUser)
        if (nextUser) syncAll(nextUser.id)
        else setLastSynced(null)
      }
    )
    return () => subscription.unsubscribe()
  }, [syncAll])

  // ── SW update prompt ─────────────────────────────────────────
  useEffect(() => {
    if (window.__swPendingUpdate) setSwUpdate(() => window.__swPendingUpdate!)
    window.__swOnUpdate = (cb: () => void) => setSwUpdate(() => cb)
    return () => { window.__swOnUpdate = undefined }
  }, [])

  return (
    <>
      <header className="hdr">
        <div className="hdr-top">
          <div className="htitle">My <em>Wellness Hub</em></div>
          <AuthButton
            user={user}
            syncing={syncing}
            lastSynced={lastSynced}
            onSynced={() => user && syncAll(user.id)}
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

      <div className={`view${active === 'schedule' ? ' active' : ''}`}>
        <ScheduleTab />
      </div>
      <div className={`view${active === 'workouts' ? ' active' : ''}`}>
        <WorkoutsTab />
      </div>
      <div className={`view${active === 'recipes' ? ' active' : ''}`}>
        <RecipesTab />
      </div>
      <div className={`view${active === 'tracker' ? ' active' : ''}`}>
        {active === 'tracker' && <TrackerTab />}
      </div>

      <UpdatePrompt onUpdate={swUpdate} />
    </>
  )
}
