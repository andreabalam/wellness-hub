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

  it('edits a single-serving food without dividing macros', () => {
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    logFood('Single', '250') // 1 serving (default)
    fireEvent.click(container.querySelector('.food-edit-btn') as HTMLElement)
    expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('250')
  })

  it('removes a logged food', () => {
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    logFood('Toast', '120')
    expect(screen.getByText('Toast')).toBeInTheDocument()
    fireEvent.click(container.querySelector('.food-remove-btn') as HTMLElement)
    expect(screen.queryByText('Toast')).not.toBeInTheDocument()
  })

  it('logs a recipe with its latest macros after the recipe is edited', () => {
    const recipe = {
      id: 42,
      cat: 'lunch',
      type: 'bowl',
      color: 'var(--teal)',
      sc: '',
      name: 'Power Bowl',
      tag: '',
      prepL: '',
      prepC: '',
      custom: true,
      hk: 300,
      hp: '20g',
      hc: '30g',
      hf: '10g',
      hfi: '5g',
      mk: 300,
      mp: '20g',
      mc: '30g',
      mf: '10g',
      ings: [] as [string, string][],
      steps: [] as string[],
      tip: '',
    }
    ls['whub_custom_recipes_v1'] = JSON.stringify([recipe])

    render(<TrackerTab user={FAKE_USER} />)
    const nameInput = screen.getByPlaceholderText('Meal name (e.g. Berry Oats)')
    fireEvent.focus(nameInput)
    fireEvent.change(nameInput, { target: { value: 'Power' } })

    // Edit the recipe's macros in the store after the suggestion has rendered.
    ls['whub_custom_recipes_v1'] = JSON.stringify([{ ...recipe, hk: 500, hp: '40g' }])

    // Select the recipe suggestion, then log it.
    fireEvent.mouseDown(screen.getByText('Power Bowl').closest('button') as HTMLElement)
    fireEvent.click(screen.getByText('+ Log food'))

    // The logged entry reflects the edited recipe (500 kcal · 40g P), not 300.
    expect(screen.getByText(/500 kcal · 40g P/)).toBeInTheDocument()
  })

  it('shows the recipe link on a meal matching a custom recipe by name', () => {
    const recipe = {
      id: 42,
      cat: 'lunch',
      type: 'bowl',
      color: 'var(--teal)',
      sc: '',
      name: 'Power Bowl',
      tag: '',
      prepL: '',
      prepC: '',
      custom: true,
      hk: 300,
      hp: '20g',
      hc: '30g',
      hf: '10g',
      hfi: '5g',
      mk: 300,
      mp: '20g',
      mc: '30g',
      mf: '10g',
      ings: [] as [string, string][],
      steps: [] as string[],
      tip: '',
    }
    ls['whub_custom_recipes_v1'] = JSON.stringify([recipe])

    render(<TrackerTab user={FAKE_USER} />)
    // Log it by typing the name manually (no suggestion → no recipe id on the entry).
    logFood('Power Bowl', '300')
    // The 📖 link still appears because the name matches a custom recipe.
    expect(screen.getByTitle('Open recipe')).toBeInTheDocument()
  })
})
