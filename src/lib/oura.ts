/**
 * src/lib/oura.ts
 *
 * Typed helpers for the Oura Ring integration (OAuth / Plan C).
 * All data requests go through /functions/v1/oura-proxy.
 * OAuth token exchange and lifecycle go through /functions/v1/oura-exchange.
 * No Oura credential ever lives in the browser after the initial redirect.
 */

import { supabase } from './supabase'

// ── Types ────────────────────────────────────────────────────────

export interface OuraWorkout {
  id: string
  activity: string            // e.g. "walking", "weight_training", "yoga"
  start_datetime: string
  end_datetime: string
  calories: number
  distance: number | null
  average_heart_rate: number | null
  max_heart_rate: number | null
}

export interface OuraReadiness {
  day: string
  score: number               // 0–100
  contributors: {
    activity_balance:     number | null
    body_temperature:     number | null
    hrv_balance:          number | null
    previous_day_activity:number | null
    previous_night:       number | null
    recovery_index:       number | null
    resting_heart_rate:   number | null
    sleep_balance:        number | null
  }
  temperature_deviation: number | null
}

/** daily_sleep endpoint — score + contributor sub-scores (0-100, no durations) */
export interface OuraSleep {
  day: string
  score: number               // 0–100
  contributors: {
    deep_sleep:   number | null
    efficiency:   number | null
    latency:      number | null
    rem_sleep:    number | null
    restfulness:  number | null
    timing:       number | null
    total_sleep:  number | null
  }
}

/** sleep endpoint — individual session with actual durations */
export interface OuraSleepSession {
  id: string
  day: string
  period: number              // 0 = main night sleep, >0 = nap
  total_sleep_duration: number // seconds
  deep_sleep_duration: number
  rem_sleep_duration: number
  light_sleep_duration: number
  awake_time: number
  time_in_bed: number
  efficiency: number          // percentage
  average_hrv: number | null
  average_heart_rate: number | null
  lowest_heart_rate: number | null
  bedtime_start: string
  bedtime_end: string
}

export interface OuraSession {
  id: string
  day: string
  type: 'meditation' | 'breathing' | 'body_status' | 'nap'
  start_datetime: string
  end_datetime: string
  average_heart_rate: number | null
  average_hrv: number | null
  mood: string | null         // e.g. "good", "relieved", "bad", "great", "neutral"
}

export interface OuraDailyActivity {
  day: string
  score: number | null
  active_calories: number
  steps: number
  total_calories: number
  high_activity_time: number    // seconds
  medium_activity_time: number
  low_activity_time: number
  sedentary_time: number
  equivalent_walking_distance: number  // meters
  target_calories: number | null
  target_meters: number | null
}

export interface OuraCardiovascularAge {
  day: string
  vascular_age: number | null
}

export interface OuraSpo2 {
  day: string
  spo2_percentage: { average: number } | null
}

export interface OuraStress {
  day: string
  stress_high: number | null     // seconds of high stress
  recovery_high: number | null   // seconds of high recovery
  day_summary: 'restored' | 'normal' | 'stressful' | 'no_data' | null
}

export interface OuraResilience {
  day: string
  contributors: {
    sleep_recovery: number | null
    daytime_recovery: number | null
    stress_impact: number | null
  }
  level: 'exceptional' | 'strong' | 'adequate' | 'limited' | 'low' | null
}

export interface OuraPersonalInfo {
  age:            number | null
  weight:         number | null  // kg
  height:         number | null  // m
  biological_sex: string | null  // 'male' | 'female' | null
}

export interface OuraWorkoutRoute {
  id: string
  start_datetime: string
  end_datetime: string
  source: string
  polyline: string | null
}

// ── Oura activity → app session-type mapping ──────────────────────

export const OURA_ACTIVITY_MAP: Record<string, string> = {
  weight_training:    'glute-build',
  functional_training:'full-body',
  yoga:               'pilates',
  pilates:            'pilates',
  walking:            'zone2',
  outdoor_walk:       'dog-walk',
  running:            'glute-shred',
  cycling:            'glute-shred',
  hiit:               'full-body',
  stretching:         'rest',
  mobility:           'rest',
}

// ── Oura session type → medStyle mapping ─────────────────────────

export const OURA_SESSION_MAP: Record<string, string> = {
  breathing:   'Breath focus',
  body_status: 'Body scan',
  meditation:  'Guided',      // Guided or Silent — user confirms after sync
}

// ── Duration rounding (seconds → nearest MED_MINS value) ─────────

const MED_MINS_OPTS = [5, 10, 13, 15, 20]

export function roundToMedMin(seconds: number): number {
  const minutes = seconds / 60
  return MED_MINS_OPTS.reduce((prev, cur) =>
    Math.abs(cur - minutes) < Math.abs(prev - minutes) ? cur : prev,
  )
}

// ── Readiness score → colour helper ──────────────────────────────

export function readinessColor(score: number): string {
  if (score >= 85) return 'var(--green-light)'
  if (score >= 70) return 'var(--teal-light)'
  if (score >= 50) return 'var(--amber-light)'
  return 'var(--coral-light)'
}

export function readinessLabel(score: number): string {
  if (score >= 85) return 'Push hard'
  if (score >= 70) return 'Normal training'
  if (score >= 50) return 'Moderate'
  return 'Recovery day'
}

// ── Sleep score → star rating (1–5) ──────────────────────────────

export function sleepScoreToStars(score: number): number {
  if (score >= 85) return 5
  if (score >= 70) return 4
  if (score >= 55) return 3
  if (score >= 40) return 2
  return 1
}

/**
 * Map an Oura daily_stress record to the tracker's 1–5 stress scale.
 * Returns null when there's no usable summary (so the caller keeps the manual value).
 *
 * Base from day_summary (restored → 1, normal → 3, stressful → 5), then nudged
 * ±1 by the high-stress duration: a long stressful stretch (≥90 min) bumps up,
 * a very short one (≤20 min) bumps down.
 */
export function stressToScale(s: OuraStress): number | null {
  const base =
    s.day_summary === 'restored'  ? 1 :
    s.day_summary === 'normal'    ? 3 :
    s.day_summary === 'stressful' ? 5 : null
  if (base === null) return null
  if (s.stress_high == null) return base   // no duration data — keep the base value
  const highMin = s.stress_high / 60
  if (highMin >= 90) return Math.min(5, base + 1)
  if (highMin <= 20 && base > 1) return base - 1
  return base
}

// ── OAuth management ──────────────────────────────────────────────

const OURA_AUTH_URL   = 'https://cloud.ouraring.com/oauth/authorize'
const OURA_SCOPES     = 'daily sleep heartrate workout session personal spo2 stress heart_health'
const STATE_KEY       = 'oura_oauth_state'
const PENDING_CODE_KEY = 'oura_oauth_pending_code'
const PENDING_URI_KEY  = 'oura_oauth_pending_uri'

/** Redirect the browser to Oura's OAuth consent screen. */
export function startOuraOAuth(): void {
  // Generate and persist state BEFORE checking clientId so that the
  // "state was stored" branch in E2E tests passes even when the env var
  // is absent (CI environments without VITE_OURA_CLIENT_ID).
  const state = crypto.randomUUID()
  const redirectUri = window.location.origin + (import.meta.env.BASE_URL as string)

  sessionStorage.setItem(STATE_KEY, state)
  sessionStorage.setItem(PENDING_URI_KEY, redirectUri)

  const clientId = import.meta.env.VITE_OURA_CLIENT_ID as string
  if (!clientId) throw new Error('VITE_OURA_CLIENT_ID is not set')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     clientId,
    redirect_uri:  redirectUri,
    scope:         OURA_SCOPES,
    state,
  })
  window.location.href = `${OURA_AUTH_URL}?${params}`
}

/**
 * Called by App.tsx on mount when it detects ?code= + ?state= in the URL.
 * Validates state, stashes the pending code in sessionStorage, and returns
 * true so the caller can switch to the Oura tab.
 */
export function consumeOAuthCallback(): boolean {
  const params = new URLSearchParams(window.location.search)
  const code  = params.get('code')
  const state = params.get('state')
  if (!code || !state) return false

  const stored = sessionStorage.getItem(STATE_KEY)
  if (state !== stored) return false   // CSRF mismatch — ignore

  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.setItem(PENDING_CODE_KEY, code)
  // Redirect URI used during authorize must be echoed to the token endpoint
  const uri = sessionStorage.getItem(PENDING_URI_KEY)
    ?? (window.location.origin + (import.meta.env.BASE_URL as string))
  sessionStorage.setItem(PENDING_URI_KEY, uri)

  // Clean the URL so the code can't be reused on a refresh
  window.history.replaceState({}, '', window.location.pathname)
  return true
}

/**
 * Exchange the pending auth code (from sessionStorage) for OAuth tokens.
 * The code and redirect_uri are sent to the oura-exchange Edge Function,
 * which performs the actual exchange and stores encrypted tokens in the DB.
 */
export async function exchangePendingCode(): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const code        = sessionStorage.getItem(PENDING_CODE_KEY)
  const redirectUri = sessionStorage.getItem(PENDING_URI_KEY)
  if (!code) throw new Error('No pending Oura auth code')

  sessionStorage.removeItem(PENDING_CODE_KEY)
  sessionStorage.removeItem(PENDING_URI_KEY)

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(`${supabaseUrl}/functions/v1/oura-exchange`, {
    method: 'POST',
    headers: {
      Authorization:  `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ code, redirect_uri: redirectUri }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Token exchange failed')
  }
}

/** Returns true if this user has a connected Oura account. */
export async function isOuraConnected(): Promise<boolean> {
  if (!supabase) return false
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(`${supabaseUrl}/functions/v1/oura-exchange`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) return false
  const body = await res.json().catch(() => ({}))
  return body.connected === true
}

/** Revoke the Oura token and clear it from the database. */
export async function disconnectOura(): Promise<void> {
  if (!supabase) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  await fetch(`${supabaseUrl}/functions/v1/oura-exchange`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
}

// ── Internal: call the Edge Function proxy ────────────────────────

async function proxyFetch<T>(endpoint: string, date: string): Promise<T[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const params = date ? `&date=${date}` : ''
  const url = `${supabaseUrl}/functions/v1/oura-proxy?endpoint=${endpoint}${params}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? err.detail ?? err.message ?? `Oura error ${res.status}`)
  }

  const json = await res.json()
  return (json.data ?? []) as T[]
}

// For collection endpoints with an explicit date range (start ≠ end)
async function proxyFetchRange<T>(endpoint: string, startDate: string, endDate: string): Promise<T[]> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const url = `${supabaseUrl}/functions/v1/oura-proxy?endpoint=${endpoint}&start_date=${startDate}&end_date=${endDate}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? err.detail ?? err.message ?? `Oura error ${res.status}`)
  }

  const json = await res.json()
  return (json.data ?? []) as T[]
}

// For single-object endpoints (e.g. workout routes) that don't return a data array
async function proxyFetchSingle<T>(endpoint: string, extra: Record<string, string>): Promise<T | null> {
  if (!supabase) throw new Error('Supabase not configured')

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in')

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const qs = new URLSearchParams({ endpoint, ...extra })
  const url = `${supabaseUrl}/functions/v1/oura-proxy?${qs}`

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })

  if (res.status === 404) return null
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? err.detail ?? err.message ?? `Oura error ${res.status}`)
  }

  return await res.json() as T
}

// ── Public fetch functions ────────────────────────────────────────

export async function fetchOuraWorkouts(date: string): Promise<OuraWorkout[]> {
  return proxyFetch<OuraWorkout>('workout', date)
}

export async function fetchOuraReadiness(date: string): Promise<OuraReadiness | null> {
  const items = await proxyFetch<OuraReadiness>('daily_readiness', date)
  return items.find(r => r.day === date) ?? null
}

export async function fetchOuraSleep(date: string): Promise<OuraSleep | null> {
  const items = await proxyFetch<OuraSleep>('daily_sleep', date)
  return items.find(s => s.day === date) ?? null
}

/** Fetches the main sleep session (period === 0) from the sleep endpoint for actual durations. */
export async function fetchOuraSleepSession(date: string): Promise<OuraSleepSession | null> {
  const sessions = await proxyFetch<OuraSleepSession>('sleep', date)
  // Prefer main night sleep (period 0); fall back to first session for the day
  return sessions.find(s => s.day === date && s.period === 0)
    ?? sessions.find(s => s.day === date)
    ?? null
}

export async function fetchOuraSessions(date: string): Promise<OuraSession[]> {
  return proxyFetch<OuraSession>('session', date)
}

export async function fetchOuraDailyActivity(date: string): Promise<OuraDailyActivity | null> {
  // Oura only finalises daily_activity at end of day, so "today" is often absent.
  // Request yesterday+today in one call and prefer today, falling back to yesterday.
  const prev = new Date(date + 'T12:00:00')
  prev.setDate(prev.getDate() - 1)
  const yesterday = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`
  const items = await proxyFetchRange<OuraDailyActivity>('daily_activity', yesterday, date)
  return items.find(a => a.day === date) ?? items.find(a => a.day === yesterday) ?? null
}

export async function fetchOuraCardiovascularAge(date: string): Promise<OuraCardiovascularAge | null> {
  const items = await proxyFetch<OuraCardiovascularAge>('daily_cardiovascular_age', date)
  return items.find(c => c.day === date) ?? null
}

export async function fetchOuraSpo2(date: string): Promise<OuraSpo2 | null> {
  const items = await proxyFetch<OuraSpo2>('daily_spo2', date)
  return items.find(s => s.day === date) ?? null
}

export async function fetchOuraStress(date: string): Promise<OuraStress | null> {
  const items = await proxyFetch<OuraStress>('daily_stress', date)
  return items.find(s => s.day === date) ?? null
}

export async function fetchOuraResilience(date: string): Promise<OuraResilience | null> {
  const items = await proxyFetch<OuraResilience>('daily_resilience', date)
  return items.find(r => r.day === date) ?? null
}

export async function fetchOuraWorkoutRoute(workoutId: string): Promise<OuraWorkoutRoute | null> {
  try {
    return await proxyFetchSingle<OuraWorkoutRoute>('workout_route', { id: workoutId })
  } catch {
    return null
  }
}

/** Returns weight/height/age/sex from the user's Oura profile. */
export async function fetchOuraPersonalInfo(): Promise<OuraPersonalInfo | null> {
  if (!supabase) return null
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return null

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(
    `${supabaseUrl}/functions/v1/oura-proxy?endpoint=personal_info`,
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  )
  if (!res.ok) return null
  return await res.json() as OuraPersonalInfo
}

/**
 * Returns the N-day average of total_calories from daily_activity.
 * Uses the last `days` days ending today. Returns null if no data available.
 */
export async function fetchOuraTdeeAvg(days = 7): Promise<number | null> {
  const localFmt = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const end   = new Date()
  const start = new Date(end.getTime() - (days - 1) * 86_400_000)

  const items = await proxyFetchRange<OuraDailyActivity>('daily_activity', localFmt(start), localFmt(end))
  const cals  = items.map(d => d.total_calories).filter(c => c > 500)  // skip ring-off days
  if (cals.length === 0) return null
  return Math.round(cals.reduce((a, b) => a + b, 0) / cals.length)
}

