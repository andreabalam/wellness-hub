import { useEffect, useState } from 'react'
import { dayWorkoutSessions } from '../data/tracker'
import { importOuraWorkouts, lastImported } from '../lib/ouraImport'
import { reportError } from '../lib/errorLog'
import { showToast } from '../lib/toast'
import { trackerStore } from './useStore'

/** Auto-imports in flight by date — Today and Train both mount on today's date. */
const inFlight = new Map<string, Promise<number | null>>()

/**
 * Oura workout import for one day, shared by Today and Train: a silent
 * policy-gated import whenever the day is shown, plus a forced `sync()` for
 * the manual button. Writes go straight to trackerStore; subscribers
 * (useStoreRev) pick them up.
 */
export function useOuraWorkoutSync(dateKey: string, connected: boolean) {
  const [syncing, setSyncing] = useState(false)
  // Bumped after each attempt so lastSynced (read from the import stamp) refreshes
  const [, setChecked] = useState(0)

  /** Import and save; returns how many sessions were added, or null if nothing changed. */
  const run = async (force: boolean): Promise<number | null> => {
    const day = trackerStore.getDay(dateKey)
    const before = dayWorkoutSessions(day)
    const merged = await importOuraWorkouts(dateKey, before, force)
    if (!merged) return null
    trackerStore.setDay(dateKey, {
      ...trackerStore.getDay(dateKey),
      wkSessions: merged,
      workout: merged[0]?.type ?? null,
    })
    return merged.length - before.length
  }

  useEffect(() => {
    if (!connected) return
    let auto = inFlight.get(dateKey)
    if (!auto) {
      auto = run(false).finally(() => inFlight.delete(dateKey))
      inFlight.set(dateKey, auto)
      // Toast once per import; errors stay silent — manual sync surfaces them
      auto.then(
        added => {
          if (added && added > 0)
            showToast(`${added} workout${added === 1 ? '' : 's'} imported from Oura`, 'info')
        },
        () => {},
      )
    }
    auto.then(() => setChecked(n => n + 1)).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, connected])

  const sync = async () => {
    setSyncing(true)
    try {
      const added = await run(true)
      showToast(
        added == null
          ? 'Oura workouts are up to date'
          : added > 0
            ? `${added} workout${added === 1 ? '' : 's'} imported from Oura`
            : 'Oura workouts updated',
        'info',
      )
    } catch (err: unknown) {
      showToast(reportError('oura-sync:workout', err), 'error')
    } finally {
      setChecked(n => n + 1)
      setSyncing(false)
    }
  }

  return { syncing, lastSynced: lastImported(dateKey, 'wk'), sync }
}
