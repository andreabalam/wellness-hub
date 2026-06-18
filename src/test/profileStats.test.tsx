/**
 * ProfileStatsCard — the Oura auto-fill path and the inch-unit fieldsFromStore
 * conversion, neither reached by the broad WorkoutsTab test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

const fetchOuraPersonalInfo = vi.fn()
const fetchOuraTdeeAvg = vi.fn()
vi.mock('../lib/oura', async importOriginal => {
  const orig = await importOriginal<typeof import('../lib/oura')>()
  return {
    ...orig,
    fetchOuraPersonalInfo: (...a: unknown[]) => fetchOuraPersonalInfo(...a),
    fetchOuraTdeeAvg: (...a: unknown[]) => fetchOuraTdeeAvg(...a),
  }
})

import ProfileStatsCard from '../components/TrackerTab/ProfileStatsCard'

const FAKE_USER = { id: 'u-1' } as User

const ls: Record<string, string> = {}
beforeEach(() => {
  Object.keys(ls).forEach(k => delete ls[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => ls[k] ?? null,
    setItem: (k: string, v: string) => {
      ls[k] = v
    },
    removeItem: (k: string) => {
      delete ls[k]
    },
    clear: () => Object.keys(ls).forEach(k => delete ls[k]),
  })
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

describe('ProfileStatsCard — Oura fill & inch units', () => {
  it('fills the form fields from the Oura profile + TDEE', async () => {
    fetchOuraPersonalInfo.mockResolvedValue({
      weight: 62,
      height: 1.7,
      age: 31,
      biological_sex: 'female',
    })
    fetchOuraTdeeAvg.mockResolvedValue(2150)
    render(<ProfileStatsCard user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    fireEvent.click(screen.getByRole('button', { name: /Fill from Oura/i }))
    await waitFor(() => expect(screen.getByDisplayValue('62')).toBeInTheDocument())
    expect(screen.getByDisplayValue('31')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2150')).toBeInTheDocument()
  })

  it('ignores a no-op unit click and converts empty fields without error', () => {
    render(<ProfileStatsCard user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    // Already cm — clicking cm is a no-op (early return)
    fireEvent.click(screen.getByRole('button', { name: 'cm' }))
    // Switch to inches with empty waist/glutes → conversion guards the empty case
    fireEvent.click(screen.getByRole('button', { name: 'in' }))
    expect(screen.getByPlaceholderText('30')).toBeInTheDocument()
    // Back to cm (now a real switch) with still-empty fields
    fireEvent.click(screen.getByRole('button', { name: 'cm' }))
    expect(screen.getByPlaceholderText('75')).toBeInTheDocument()
  })

  it('silently handles an Oura fetch failure', async () => {
    fetchOuraPersonalInfo.mockRejectedValue(new Error('no oura'))
    fetchOuraTdeeAvg.mockRejectedValue(new Error('no oura'))
    render(<ProfileStatsCard user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    fireEvent.click(screen.getByRole('button', { name: /Fill from Oura/i }))
    // Form stays open, no crash
    await waitFor(() => expect(screen.getByText('Measurements')).toBeInTheDocument())
  })

  it('pre-fills measurements converted to inches from stored cm values', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 60,
      heightM: 1.65,
      age: 31,
      biologicalSex: 'female',
      waistCm: 76.2, // → 30 in
      glutesCm: 93.98, // → 37 in
      measurementUnit: 'in',
      bodyFatPct: 22,
      cycleType: 'none',
      equipment: 'full gym',
      chronotype: 'morning',
      fatLossRateKg: 0.5,
      macroSplit: 'balanced',
      tdeeKcal: 2000,
      kcalTarget: 1700,
      protRange: '',
      fatLossGoal: '',
    })
    render(<ProfileStatsCard user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /Edit/i }))
    // waist 76.2cm → 30.0in shown in the inch-unit field
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
    expect(screen.getByDisplayValue('37')).toBeInTheDocument()
  })
})
