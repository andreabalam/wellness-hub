/**
 * TrackerTab food-photo analysis flow — drives the photoStatus/photoConfidence
 * branches (progress callbacks, low-confidence styling, error handling) that the
 * broad tracker test doesn't reach.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

const analyzeImage = vi.fn()
vi.mock('../lib/analyzeFood', () => ({ analyzeImage: (...a: unknown[]) => analyzeImage(...a) }))

import TrackerTab from '../components/TrackerTab'

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
  vi.stubGlobal('alert', vi.fn())
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

function photoInput(container: HTMLElement) {
  return container.querySelector('input[type="file"]') as HTMLInputElement
}
const file = () => new File(['img'], 'food.jpg', { type: 'image/jpeg' })

describe('TrackerTab — photo analysis', () => {
  it('fills the form from a low-confidence analysis (progress callbacks)', async () => {
    analyzeImage.mockImplementation(async (_f: File, onProgress: (m: string) => void) => {
      onProgress('Reading label…')
      onProgress('Identifying food…')
      return {
        name: 'Mystery Snack',
        kcal: 180,
        protein: 4,
        carbs: 20,
        fat: 8,
        fiber: 2,
        servings: 1,
        notes: 'Low confidence — double-check.',
        confidence: 'low',
      }
    })
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(photoInput(container), { target: { files: [file()] } })
    await waitFor(() =>
      expect(
        (screen.getByPlaceholderText('Meal name (e.g. Berry Oats)') as HTMLInputElement).value,
      ).toBe('Mystery Snack'),
    )
    expect(screen.getByText(/Low confidence/)).toBeInTheDocument()
  })

  it('shows an error message when analysis throws', async () => {
    analyzeImage.mockRejectedValue(new Error('Could not detect food'))
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(photoInput(container), { target: { files: [file()] } })
    expect(await screen.findByText('Could not detect food')).toBeInTheDocument()
  })

  it('falls back to a generic message when the error has none', async () => {
    analyzeImage.mockRejectedValue(new Error(''))
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(photoInput(container), { target: { files: [file()] } })
    expect(await screen.findByText(/fill in manually/)).toBeInTheDocument()
  })
})
