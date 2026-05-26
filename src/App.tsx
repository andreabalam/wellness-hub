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
import { trackerStore, recipeStore, groceryStore, importRemoteData } from './hooks/useStore'

type Tab = 'schedule' | 'workouts' | 'recipes' | 'tracker'

const TABS: { id: Tab; label: string }[] = [
  { id: 'schedule', label: '📅 Schedule' },
  { id: 'workouts', label: '💪 Workouts' },
  { id: 'recipes',  label: '🍽 Recipes' },
  { id: 'tracker',  label: '📊 Tracker' },
]

export default function App() {
  const [active, setActive]       = useState<Tab>('schedule')
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
      const [remoteDays, remoteRecipes, remoteTags, remoteGrocery] = await Promise.all([
        sync.pullAllDays(userId),
        sync.pullRecipes(userId),
        sync.pullTags(userId),
        sync.pullGrocery(userId),
      ])

      // Merge: remote wins for tracker day conflicts (another device is authoritative);
      // recipes, tags, grocery are unioned so local-only items are never lost.
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

      // Write merged data to localStorage (bypasses push to avoid a loop)
      importRemoteData({
        tracker: mergedDays,
        recipes: mergedRecipes,
        tags:    mergedTags,
        grocery: mergedGrocery,
      })

      // Push merged data back so any local-only items reach Supabase
      await Promise.all([
        ...Object.entries(mergedDays).map(([date, data]) =>
          sync.pushDay(userId, date, data)
        ),
        sync.pushRecipes(userId, mergedRecipes),
        sync.pushTags(userId, mergedTags),
        sync.pushGrocery(userId, mergedGrocery),
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
