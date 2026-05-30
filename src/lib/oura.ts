/**
 * src/lib/oura.ts
 *
 * Typed helpers for the Oura Ring integration (Plan B — Edge Function proxy).
 * All requests go through /functions/v1/oura-proxy; the PAT never touches
 * the browser after the initial save.
 *
 * Plan C migration note:
 *   Only the Edge Function changes (PAT → OAuth tokens).
 *   This file and all UI components stay the same.
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
  hrv_balance_score: number
  recovery_index_score: number
  temperature_deviation: number | null
}

export interface OuraSleep {
  day: string
  score: number               // 0–100
  total_sleep_duration: number  // seconds
  deep_sleep_duration: number
  rem_sleep_duration: number
  efficiency: number          // percentage
  average_hrv: number | null
}

export interface OuraSession {
  id: string
  type: 'meditation' | 'breathing' | 'body_status' | 'nap'
  start_datetime: string
  end_datetime: string
  average_heart_rate: number | null
  average_hrv: number | null
  mood: string | null         // e.g. "good", "relieved", "bad"
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

// ── PAT management (reads/writes public.user_settings) ───────────

export async function saveOuraPat(pat: string): Promise<void> {
  if (!supabase) throw new Error('Supabase not configured')
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not signed in')
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, oura_pat: pat, updated_at: new Date().toISOString() })
  if (error) throw error
}

export async function getOuraPat(): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('user_settings')
    .select('oura_pat')
    .maybeSingle()
  if (error || !data) return null
  return data.oura_pat ?? null
}

export async function clearOuraPat(): Promise<void> {
  if (!supabase) return
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, oura_pat: null, updated_at: new Date().toISOString() })
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
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `Oura error ${res.status}`)
  }

  const json = await res.json()
  return (json.data ?? []) as T[]
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

export async function fetchOuraSessions(date: string): Promise<OuraSession[]> {
  return proxyFetch<OuraSession>('session', date)
}

/** Calls personal_info endpoint — used by "Test connection" button */
export async function testOuraConnection(): Promise<boolean> {
  if (!supabase) return false
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return false

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const res = await fetch(
    `${supabaseUrl}/functions/v1/oura-proxy?endpoint=personal_info`,
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  )
  return res.ok
}
