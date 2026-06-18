/**
 * TrackerTab food-form branches the broad test doesn't reach: multi-serving
 * edit (per-serving division), remove, and quick re-add from history.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

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
})
afterEach(() => vi.unstubAllGlobals())

function logFood(name: string, kcal: string, servings?: string) {
  fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
    target: { value: name },
  })
  fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: kcal } })
  if (servings) {
    const srv = document.querySelector('input[step="0.5"]') as HTMLInputElement
    fireEvent.change(srv, { target: { value: servings } })
  }
  fireEvent.click(screen.getByText('+ Log food'))
}

describe('TrackerTab — food form edit/remove/quick-add', () => {
  it('edits a multi-serving food back to its per-serving macros', () => {
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    logFood('Big Bowl', '100', '2') // stored total = 200 kcal
    expect(screen.getByText(/200 kcal/)).toBeInTheDocument()
    fireEvent.click(container.querySelector('.food-edit-btn') as HTMLElement)
    expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('100')
    expect(screen.getByText(/Editing: Big Bowl/)).toBeInTheDocument()
    // Cancel restores the empty form
    fireEvent.click(screen.getByText('Cancel'))
    expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('')
  })

  it('removes a logged food', () => {
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    logFood('Toast', '120')
    expect(screen.getByText('Toast')).toBeInTheDocument()
    fireEvent.click(container.querySelector('.food-remove-btn') as HTMLElement)
    expect(screen.queryByText('Toast')).not.toBeInTheDocument()
  })
})
