/**
 * src/hooks/useCyclePhase.ts
 *
 * Cycle-phase estimate for a date, shared by the Tracker and Workouts tabs.
 * Oura's API doesn't expose Cycle Insights, so the inputs are the user's
 * Oura period tags and nightly temperature deviations (see lib/cyclePhase).
 *
 * Both are fetched together (~10 weeks) and cached in localStorage for 6 h,
 * so switching tabs doesn't refetch. Manual "Menstrual" days from the tracker
 * are always included, so the estimate works without Oura too.
 */
import { useEffect, useMemo, useState } from 'react'
import { estimatePhase } from '../lib/cyclePhase'
import type { PhaseSuggestion, TempReading } from '../lib/cyclePhase'
import { fetchOuraReadinessRange, fetchOuraTags, isPeriodTag } from '../lib/oura'
import type { OuraReadiness } from '../lib/oura'
import { safeGet, safeSet } from '../lib/storage'
import { dkey } from '../components/TrackerTab/dateKey'
import { trackerStore } from './useStore'

export const CYCLE_CACHE_KEY = 'whub_oura_cycle_v1'
/** Written by WorkoutLog's per-day readiness auto-fetch; used as an offline fallback. */
const READINESS_CACHE_KEY = 'whub_oura_readiness_v1'
const MAX_AGE_MS = 6 * 60 * 60 * 1000
const LOOKBACK_DAYS = 70

interface CycleCache {
  fetchedAt: number
  tagDays: string[]
  temps: TempReading[]
  /** Connection predates the `tag` scope — period tags return 403 */
  tagScopeMissing: boolean
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dkey(d)
}

function readCache(): CycleCache | null {
  return safeGet<CycleCache | null>(CYCLE_CACHE_KEY, null)
}

/**
 * @param trackerRev  any value that changes when tracker phases are edited
 *                    (e.g. the viewed day's phase) so the estimate recomputes.
 */
export function useCyclePhase(date: Date, ouraConnected: boolean, trackerRev?: unknown) {
  const [cache, setCache] = useState<CycleCache | null>(readCache)

  useEffect(() => {
    if (!ouraConnected) return
    const cached = readCache()
    if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return
    const start = daysAgo(LOOKBACK_DAYS)
    const end = daysAgo(0)
    void Promise.allSettled([fetchOuraTags(start, end), fetchOuraReadinessRange(start, end)]).then(
      ([tags, readiness]) => {
        // Both failed (offline, proxy down) — keep the old cache and retry next mount.
        if (tags.status === 'rejected' && readiness.status === 'rejected') return
        const next: CycleCache = {
          fetchedAt: Date.now(),
          tagDays:
            tags.status === 'fulfilled'
              ? tags.value.filter(isPeriodTag).map(t => t.start_day)
              : (cached?.tagDays ?? []),
          temps:
            readiness.status === 'fulfilled'
              ? readiness.value
                  .filter(r => r.temperature_deviation != null)
                  .map(r => ({ date: r.day, dev: r.temperature_deviation as number }))
              : (cached?.temps ?? []),
          tagScopeMissing:
            tags.status === 'rejected' && /403|scope|forbidden/i.test(String(tags.reason)),
        }
        safeSet(CYCLE_CACHE_KEY, next)
        setCache(next)
      },
    )
  }, [ouraConnected])

  const dateKey = dkey(date)
  const suggestion: PhaseSuggestion | null = useMemo(() => {
    // trackerRev is only a recompute trigger — tracker days are read fresh below.
    void trackerRev
    const temps = new Map((cache?.temps ?? []).map(t => [t.date, t.dev]))
    // Fill gaps from the per-day readiness cache (covers offline / failed range fetches).
    const perDay = safeGet<Record<string, OuraReadiness>>(READINESS_CACHE_KEY, {})
    for (const [day, r] of Object.entries(perDay)) {
      if (!temps.has(day) && r.temperature_deviation != null)
        temps.set(day, r.temperature_deviation)
    }
    return estimatePhase(
      dateKey,
      cache?.tagDays ?? [],
      trackerStore.getAll(),
      [...temps].map(([d, dev]) => ({ date: d, dev })),
    )
  }, [dateKey, cache, trackerRev])

  return { suggestion, tagScopeMissing: ouraConnected && !!cache?.tagScopeMissing }
}
