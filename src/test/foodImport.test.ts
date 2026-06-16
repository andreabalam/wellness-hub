/**
 * Unit tests for src/lib/foodImport.ts
 * Covers the offline parser (parseFoodLogLocal) and the AI helper's guard
 * when no Supabase client is configured (the unit-test environment).
 */
import { describe, it, expect } from 'vitest'
import { parseFoodLog, parseFoodLogLocal } from '../lib/foodImport'
import type { QuickFood } from '../data/tracker'

const LIB: QuickFood[] = [
  { n: 'Berry Oats', k: 350, p: 18, c: 42, f: 12, fi: 9 },
  { n: 'Green Smoothie', k: 390, p: 35, c: 56, f: 9, fi: 8 },
]

describe('parseFoodLogLocal', () => {
  it('parses an explicit "Name k p c f fi" row', () => {
    const rows = parseFoodLogLocal('Chicken Bowl 420 38 30 14 6', [])
    expect(rows).toEqual([{ n: 'Chicken Bowl', k: 420, p: 38, c: 30, f: 14, fi: 6 }])
  })

  it('fills missing trailing macros with zero', () => {
    const rows = parseFoodLogLocal('Toast 120', [])
    expect(rows).toEqual([{ n: 'Toast', k: 120, p: 0, c: 0, f: 0, fi: 0 }])
  })

  it('strips bullet and numbered-list markers', () => {
    const rows = parseFoodLogLocal('- Toast 120\n1. Eggs 150 13 1 10 0', [])
    expect(rows.map(r => r.n)).toEqual(['Toast', 'Eggs'])
  })

  it('matches a bare name against the food library (case-insensitive)', () => {
    const rows = parseFoodLogLocal('berry oats\nGreen Smoothie', LIB)
    expect(rows).toEqual([
      { n: 'Berry Oats', k: 350, p: 18, c: 42, f: 12, fi: 9 },
      { n: 'Green Smoothie', k: 390, p: 35, c: 56, f: 9, fi: 8 },
    ])
  })

  it('skips lines it cannot read', () => {
    const rows = parseFoodLogLocal('Breakfast:\nsome unknown dish\nToast 120', LIB)
    expect(rows).toEqual([{ n: 'Toast', k: 120, p: 0, c: 0, f: 0, fi: 0 }])
  })

  it('returns an empty array for blank input', () => {
    expect(parseFoodLogLocal('   \n\n', LIB)).toEqual([])
  })

  it('handles comma-separated macros', () => {
    const rows = parseFoodLogLocal('Salad 200, 5, 20, 10, 4', [])
    expect(rows).toEqual([{ n: 'Salad', k: 200, p: 5, c: 20, f: 10, fi: 4 }])
  })
})

describe('parseFoodLog', () => {
  it('rejects empty input', async () => {
    await expect(parseFoodLog('   ')).rejects.toThrow(/paste some food text/i)
  })

  it('rejects when the parse cannot complete (no client or failed call)', async () => {
    // In unit tests there is no reachable edge function, so this always rejects.
    await expect(parseFoodLog('Toast and eggs')).rejects.toThrow()
  })
})
