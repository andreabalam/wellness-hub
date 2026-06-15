import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  readinessColor, readinessLabel, sleepScoreToStars, roundToMedMin,
  OURA_ACTIVITY_MAP, OURA_SESSION_MAP,
  isOuraConnected, disconnectOura,
  consumeOAuthCallback, startOuraOAuth, stressToScale,
} from '../lib/oura'
import type { OuraStress } from '../lib/oura'

// ── readinessColor ────────────────────────────────────────────────

describe('readinessColor', () => {
  it('returns green for score >= 85', () => {
    expect(readinessColor(85)).toBe('var(--green-light)')
    expect(readinessColor(100)).toBe('var(--green-light)')
  })
  it('returns teal for score 70–84', () => {
    expect(readinessColor(70)).toBe('var(--teal-light)')
    expect(readinessColor(84)).toBe('var(--teal-light)')
  })
  it('returns amber for score 50–69', () => {
    expect(readinessColor(50)).toBe('var(--amber-light)')
    expect(readinessColor(69)).toBe('var(--amber-light)')
  })
  it('returns coral for score < 50', () => {
    expect(readinessColor(49)).toBe('var(--coral-light)')
    expect(readinessColor(0)).toBe('var(--coral-light)')
  })
})

// ── readinessLabel ────────────────────────────────────────────────

describe('readinessLabel', () => {
  it('returns "Push hard" for score >= 85', () => {
    expect(readinessLabel(85)).toBe('Push hard')
    expect(readinessLabel(100)).toBe('Push hard')
  })
  it('returns "Normal training" for score 70–84', () => {
    expect(readinessLabel(70)).toBe('Normal training')
    expect(readinessLabel(84)).toBe('Normal training')
  })
  it('returns "Moderate" for score 50–69', () => {
    expect(readinessLabel(50)).toBe('Moderate')
    expect(readinessLabel(69)).toBe('Moderate')
  })
  it('returns "Recovery day" for score < 50', () => {
    expect(readinessLabel(49)).toBe('Recovery day')
    expect(readinessLabel(0)).toBe('Recovery day')
  })
})

// ── sleepScoreToStars ─────────────────────────────────────────────

describe('sleepScoreToStars', () => {
  it('returns 5 for score >= 85', () => {
    expect(sleepScoreToStars(85)).toBe(5)
    expect(sleepScoreToStars(100)).toBe(5)
  })
  it('returns 4 for score 70–84', () => {
    expect(sleepScoreToStars(70)).toBe(4)
    expect(sleepScoreToStars(84)).toBe(4)
  })
  it('returns 3 for score 55–69', () => {
    expect(sleepScoreToStars(55)).toBe(3)
    expect(sleepScoreToStars(69)).toBe(3)
  })
  it('returns 2 for score 40–54', () => {
    expect(sleepScoreToStars(40)).toBe(2)
    expect(sleepScoreToStars(54)).toBe(2)
  })
  it('returns 1 for score < 40', () => {
    expect(sleepScoreToStars(39)).toBe(1)
    expect(sleepScoreToStars(0)).toBe(1)
  })
})

// ── roundToMedMin ─────────────────────────────────────────────────

// ── stressToScale ─────────────────────────────────────────────────

describe('stressToScale', () => {
  const make = (day_summary: OuraStress['day_summary'], stress_high: number | null = null): OuraStress =>
    ({ day: '2026-06-14', stress_high, recovery_high: null, day_summary })

  it('maps the day_summary to base values', () => {
    expect(stressToScale(make('restored'))).toBe(1)
    expect(stressToScale(make('normal'))).toBe(3)
    expect(stressToScale(make('stressful'))).toBe(5)
  })

  it('returns null when there is no usable summary', () => {
    expect(stressToScale(make('no_data'))).toBeNull()
    expect(stressToScale(make(null))).toBeNull()
  })

  it('nudges up when high-stress duration is long (>=90 min)', () => {
    expect(stressToScale(make('normal', 90 * 60))).toBe(4)
    expect(stressToScale(make('stressful', 200 * 60))).toBe(5) // capped at 5
  })

  it('nudges down when high-stress duration is short (<=20 min)', () => {
    expect(stressToScale(make('normal', 10 * 60))).toBe(2)
    expect(stressToScale(make('restored', 0))).toBe(1) // never below 1
  })

  it('keeps the base value for a mid-range duration', () => {
    expect(stressToScale(make('normal', 45 * 60))).toBe(3)
  })
})

describe('roundToMedMin', () => {
  it('returns exact matches unchanged', () => {
    expect(roundToMedMin(5 * 60)).toBe(5)
    expect(roundToMedMin(10 * 60)).toBe(10)
    expect(roundToMedMin(13 * 60)).toBe(13)
    expect(roundToMedMin(15 * 60)).toBe(15)
    expect(roundToMedMin(20 * 60)).toBe(20)
  })
  it('rounds to nearest option below midpoint', () => {
    expect(roundToMedMin(7 * 60)).toBe(5)    // |5-7|=2 < |10-7|=3
    expect(roundToMedMin(11 * 60)).toBe(10)  // |10-11|=1 < |13-11|=2
  })
  it('rounds to nearest option above midpoint', () => {
    expect(roundToMedMin(12 * 60)).toBe(13)  // |13-12|=1 < |10-12|=2
    expect(roundToMedMin(18 * 60)).toBe(20)  // |20-18|=2 < |15-18|=3
  })
})

// ── Maps ──────────────────────────────────────────────────────────

describe('OURA_ACTIVITY_MAP', () => {
  it('maps weight_training to glute-build', () => {
    expect(OURA_ACTIVITY_MAP['weight_training']).toBe('glute-build')
  })
  it('maps yoga to pilates', () => {
    expect(OURA_ACTIVITY_MAP['yoga']).toBe('pilates')
  })
  it('maps walking to zone2', () => {
    expect(OURA_ACTIVITY_MAP['walking']).toBe('zone2')
  })
  it('maps outdoor_walk to dog-walk', () => {
    expect(OURA_ACTIVITY_MAP['outdoor_walk']).toBe('dog-walk')
  })
  it('maps hiit to full-body', () => {
    expect(OURA_ACTIVITY_MAP['hiit']).toBe('full-body')
  })
  it('maps stretching to rest', () => {
    expect(OURA_ACTIVITY_MAP['stretching']).toBe('rest')
  })
})

describe('OURA_SESSION_MAP', () => {
  it('maps breathing to Breath focus', () => {
    expect(OURA_SESSION_MAP['breathing']).toBe('Breath focus')
  })
  it('maps body_status to Body scan', () => {
    expect(OURA_SESSION_MAP['body_status']).toBe('Body scan')
  })
  it('maps meditation to Guided', () => {
    expect(OURA_SESSION_MAP['meditation']).toBe('Guided')
  })
})

// ── Network-boundary guards (real Supabase client, no signed-in user) ───────
// .env.local provides real env vars so supabase is non-null, but there is
// no authenticated session — each function's "no user" guard is exercised.

describe('isOuraConnected', () => {
  it('returns false when Supabase is not configured or no session', async () => {
    // CI has no .env.local → supabase is null → returns false immediately
    // Locally supabase is non-null but no session → returns false
    expect(await isOuraConnected()).toBe(false)
  })
})

describe('disconnectOura', () => {
  it('resolves without error when no session is present', async () => {
    await expect(disconnectOura()).resolves.toBeUndefined()
  })
})

// ── consumeOAuthCallback ──────────────────────────────────────────

describe('consumeOAuthCallback', () => {
  beforeEach(() => {
    sessionStorage.clear()
    window.history.pushState({}, '', '/')
  })

  it('returns false when URL has no code or state', () => {
    expect(consumeOAuthCallback()).toBe(false)
  })

  it('returns false when state param does not match sessionStorage', () => {
    sessionStorage.setItem('oura_oauth_state', 'expected')
    window.history.pushState({}, '', '/?code=abc&state=wrong')
    expect(consumeOAuthCallback()).toBe(false)
    // stored state must NOT be consumed on mismatch
    expect(sessionStorage.getItem('oura_oauth_state')).toBe('expected')
  })

  it('returns false when code is absent but state is present', () => {
    sessionStorage.setItem('oura_oauth_state', 'some-state')
    window.history.pushState({}, '', '/?state=some-state')
    expect(consumeOAuthCallback()).toBe(false)
  })

  it('returns true, stores pending code, and clears URL when state matches', () => {
    sessionStorage.setItem('oura_oauth_state', 'correct')
    window.history.pushState({}, '', '/?code=auth-code-123&state=correct')
    expect(consumeOAuthCallback()).toBe(true)
    expect(sessionStorage.getItem('oura_oauth_pending_code')).toBe('auth-code-123')
    expect(sessionStorage.getItem('oura_oauth_state')).toBeNull()
    expect(window.location.search).toBe('')
  })

  it('preserves an existing pending_uri in sessionStorage', () => {
    sessionStorage.setItem('oura_oauth_state', 's')
    sessionStorage.setItem('oura_oauth_pending_uri', 'https://example.com/')
    window.history.pushState({}, '', '/?code=c&state=s')
    consumeOAuthCallback()
    expect(sessionStorage.getItem('oura_oauth_pending_uri')).toBe('https://example.com/')
  })
})

// ── startOuraOAuth ────────────────────────────────────────────────

describe('startOuraOAuth', () => {
  beforeEach(() => {
    sessionStorage.clear()
    // startOuraOAuth guards against a missing client ID before writing to
    // sessionStorage, so the env var must be set for the writes to happen.
    vi.stubEnv('VITE_OURA_CLIENT_ID', 'test-client-id')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('stores a random OAuth state and redirect URI in sessionStorage', () => {
    // May throw in jsdom when trying to navigate cross-origin — that's fine:
    // sessionStorage writes happen before the navigation line.
    try { startOuraOAuth() } catch { /* jsdom navigation not implemented */ }
    const state = sessionStorage.getItem('oura_oauth_state')
    const uri   = sessionStorage.getItem('oura_oauth_pending_uri')
    expect(state).not.toBeNull()
    expect(state).toHaveLength(36)   // UUID format
    expect(uri).not.toBeNull()
  })

  it('generates a unique state on each call', () => {
    try { startOuraOAuth() } catch { /* ignore navigation */ }
    const first = sessionStorage.getItem('oura_oauth_state')
    sessionStorage.clear()
    try { startOuraOAuth() } catch { /* ignore navigation */ }
    const second = sessionStorage.getItem('oura_oauth_state')
    expect(first).not.toBe(second)
  })
})
