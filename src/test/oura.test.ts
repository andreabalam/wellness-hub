import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  readinessColor,
  readinessLabel,
  roundToMedMin,
  OURA_ACTIVITY_MAP,
  OURA_SESSION_MAP,
  isOuraConnected,
  disconnectOura,
  consumeOAuthCallback,
  startOuraOAuth,
} from '../lib/oura'

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
  it('returns "Good to train" for score 70–84', () => {
    expect(readinessLabel(70)).toBe('Good to train')
    expect(readinessLabel(84)).toBe('Good to train')
  })
  it('returns "Go easy" for score 50–69', () => {
    expect(readinessLabel(50)).toBe('Go easy')
    expect(readinessLabel(69)).toBe('Go easy')
  })
  it('returns "Recovery day" for score < 50', () => {
    expect(readinessLabel(49)).toBe('Recovery day')
    expect(readinessLabel(0)).toBe('Recovery day')
  })
})

// ── roundToMedMin ─────────────────────────────────────────────────

describe('roundToMedMin', () => {
  it('returns exact matches unchanged', () => {
    expect(roundToMedMin(5 * 60)).toBe(5)
    expect(roundToMedMin(10 * 60)).toBe(10)
    expect(roundToMedMin(13 * 60)).toBe(13)
    expect(roundToMedMin(15 * 60)).toBe(15)
    expect(roundToMedMin(20 * 60)).toBe(20)
  })
  it('rounds to nearest option below midpoint', () => {
    expect(roundToMedMin(7 * 60)).toBe(5) // |5-7|=2 < |10-7|=3
    expect(roundToMedMin(11 * 60)).toBe(10) // |10-11|=1 < |13-11|=2
  })
  it('rounds to nearest option above midpoint', () => {
    expect(roundToMedMin(12 * 60)).toBe(13) // |13-12|=1 < |10-12|=2
    expect(roundToMedMin(18 * 60)).toBe(20) // |20-18|=2 < |15-18|=3
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
    try {
      startOuraOAuth()
    } catch {
      /* jsdom navigation not implemented */
    }
    const state = sessionStorage.getItem('oura_oauth_state')
    const uri = sessionStorage.getItem('oura_oauth_pending_uri')
    expect(state).not.toBeNull()
    expect(state).toHaveLength(36) // UUID format
    expect(uri).not.toBeNull()
  })

  it('generates a unique state on each call', () => {
    try {
      startOuraOAuth()
    } catch {
      /* ignore navigation */
    }
    const first = sessionStorage.getItem('oura_oauth_state')
    sessionStorage.clear()
    try {
      startOuraOAuth()
    } catch {
      /* ignore navigation */
    }
    const second = sessionStorage.getItem('oura_oauth_state')
    expect(first).not.toBe(second)
  })
})
