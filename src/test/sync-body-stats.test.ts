/**
 * Tests for sync.ts fetchUserBodyStats — specifically the graceful
 * fallback when the measurement columns (waist_cm, glutes_cm, measurement_unit)
 * haven't been added to the DB yet (Supabase error code 42703).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Supabase mock using vi.hoisted so factory can reference the fns ──

const { mockSingle, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq     = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom   = vi.fn(() => ({ select: mockSelect }))
  return { mockSingle, mockFrom }
})

vi.mock('../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

import { fetchUserBodyStats } from '../lib/sync'

// ── Fixtures ──────────────────────────────────────────────────────

const USER_ID = 'user-abc'

const fullRow = {
  weight_kg: 65, body_fat_pct: 22, height_m: 1.65,
  age: 30, biological_sex: 'female',
  cycle_type: 'regular', equipment: 'Bodyweight only',
  tdee_kcal: 1800, kcal_target: 1400,
  prot_range: '100–120g', fat_loss_goal: '0.5 kg/wk',
  chronotype: 'bear', fat_loss_rate_kg: 0.5, macro_split: 'balanced',
  waist_cm: 76, glutes_cm: 98, measurement_unit: 'cm',
}

const coreRow = (({ waist_cm: _w, glutes_cm: _g, measurement_unit: _m, ...rest }) => rest)(fullRow)

beforeEach(() => { vi.clearAllMocks() })

// ── Success path ──────────────────────────────────────────────────

describe('fetchUserBodyStats — success', () => {
  it('returns parsed UserBodyStats when all columns exist', async () => {
    mockSingle.mockResolvedValue({ data: fullRow, error: null })
    const result = await fetchUserBodyStats(USER_ID)
    expect(result).not.toBeNull()
    expect(result!.weightKg).toBe(65)
    expect(result!.waistCm).toBe(76)
    expect(result!.glutesCm).toBe(98)
    expect(result!.measurementUnit).toBe('cm')
    expect(result!.cycleType).toBe('regular')
    expect(result!.macroSplit).toBe('balanced')
  })

  it('maps empty measurement_unit string to "cm"', async () => {
    mockSingle.mockResolvedValue({ data: { ...fullRow, measurement_unit: '' }, error: null })
    const result = await fetchUserBodyStats(USER_ID)
    expect(result!.measurementUnit).toBe('cm')
  })

  it('returns null when no row found (data is null)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: null })
    const result = await fetchUserBodyStats(USER_ID)
    expect(result).toBeNull()
  })

  it('returns null on a generic Supabase error (non-42703)', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: '22000', message: 'some db error' } })
    const result = await fetchUserBodyStats(USER_ID)
    expect(result).toBeNull()
    // Only one query attempted — no retry for non-42703
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})

// ── 42703 fallback — migration columns missing ────────────────────

describe('fetchUserBodyStats — 42703 column-not-found fallback', () => {
  it('retries with core columns when initial query returns 42703', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column does not exist' } })
      .mockResolvedValueOnce({ data: coreRow, error: null })
    const result = await fetchUserBodyStats(USER_ID)
    expect(result).not.toBeNull()
    expect(result!.weightKg).toBe(65)
    // Measurement fields default to 0 / 'cm' when absent from DB row
    expect(result!.waistCm).toBe(0)
    expect(result!.glutesCm).toBe(0)
    expect(result!.measurementUnit).toBe('cm')
  })

  it('queries user_body_stats twice on 42703 (full query + fallback)', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column does not exist' } })
      .mockResolvedValueOnce({ data: coreRow, error: null })
    await fetchUserBodyStats(USER_ID)
    expect(mockFrom).toHaveBeenCalledTimes(2)
    expect(mockFrom).toHaveBeenCalledWith('user_body_stats')
  })

  it('returns null when both full-column and core-column queries fail', async () => {
    mockSingle
      .mockResolvedValueOnce({ data: null, error: { code: '42703', message: 'column does not exist' } })
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116', message: 'no rows' } })
    const result = await fetchUserBodyStats(USER_ID)
    expect(result).toBeNull()
  })

  it('does NOT retry for non-42703 errors', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { code: '23505', message: 'unique violation' } })
    const result = await fetchUserBodyStats(USER_ID)
    expect(result).toBeNull()
    expect(mockFrom).toHaveBeenCalledTimes(1)
  })
})
