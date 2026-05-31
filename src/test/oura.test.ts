import { describe, it, expect } from 'vitest'
import {
  readinessColor, readinessLabel, sleepScoreToStars, roundToMedMin,
  OURA_ACTIVITY_MAP, OURA_SESSION_MAP,
  getOuraPat, saveOuraPat, clearOuraPat, testOuraConnection,
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

describe('getOuraPat', () => {
  it('returns null when no user is signed in', async () => {
    expect(await getOuraPat()).toBeNull()
  })
})

describe('saveOuraPat', () => {
  it('rejects when not authenticated (no session or Supabase not configured)', async () => {
    // CI has no .env.local so supabase is null → "Supabase not configured"
    // Locally supabase is non-null but there is no session → "Not signed in"
    await expect(saveOuraPat('tok')).rejects.toThrow(
      /Not signed in|Supabase not configured/
    )
  })
})

describe('clearOuraPat', () => {
  it('resolves without error when no user is signed in', async () => {
    await expect(clearOuraPat()).resolves.toBeUndefined()
  })
})

describe('testOuraConnection', () => {
  it('returns false when no session exists', async () => {
    expect(await testOuraConnection()).toBe(false)
  })
})
