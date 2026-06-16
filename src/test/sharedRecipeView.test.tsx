/**
 * Component test for SharedRecipeView — the standalone landing page rendered
 * for shared-recipe deep links (#/r/<token>).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import type { Recipe } from '../data/recipes'
import { encodeRecipe } from '../lib/recipeShare'

// ── localStorage mock (mirrors components.test.tsx) ───────────────
const ls: Record<string, string> = {}
beforeEach(() => {
  Object.keys(ls).forEach(k => delete ls[k])
  vi.stubGlobal('localStorage', {
    getItem:    (k: string) => ls[k] ?? null,
    setItem:    (k: string, v: string) => { ls[k] = v },
    removeItem: (k: string) => { delete ls[k] },
    clear:      () => Object.keys(ls).forEach(k => delete ls[k]),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

import SharedRecipeView from '../components/SharedRecipeView'
import { recipeStore } from '../hooks/useStore'
import * as sync from '../lib/sync'

const RECIPE: Recipe = {
  id: 1, cat: 'breakfast', type: 'Breakfast', color: 'var(--green)', sc: 'sc-green',
  name: 'Shared Avocado Toast', tag: 'Quick',
  prepL: '10 min', prepC: 'var(--green)',
  hk: 320, hp: '8g', hc: '30g', hf: '18g',
  mk: 320, mp: '8g', mc: '30g', mf: '18g',
  ings: [['Avocado', '1']], steps: ['Mash', 'Toast'], tip: '',
}

const USER = { id: 'user-123' } as User

describe('SharedRecipeView', () => {
  it('decodes the token and renders the recipe', async () => {
    const token = await encodeRecipe(RECIPE)
    render(<SharedRecipeView token={token} user={null} onExit={() => {}} />)
    await waitFor(() => expect(screen.getByText('Shared Avocado Toast')).toBeInTheDocument())
    // Signed-out users are prompted to sign in rather than shown an import button
    expect(screen.getByText(/sign in/i)).toBeInTheDocument()
  })

  it('shows an error for a malformed token', async () => {
    render(<SharedRecipeView token="garbage-token" user={null} onExit={() => {}} />)
    await waitFor(() => expect(screen.getByText(/invalid or damaged/i)).toBeInTheDocument())
  })

  it('imports the recipe for a signed-in user', async () => {
    const addSpy = vi.spyOn(recipeStore, 'addRecipe').mockImplementation(() => {})
    vi.spyOn(recipeStore, 'getRecipes').mockReturnValue([])
    vi.spyOn(recipeStore, 'saveRecipes').mockImplementation(() => {})
    const upsertSpy = vi.spyOn(sync, 'upsertUserRecipe').mockResolvedValue(999)

    const token = await encodeRecipe(RECIPE)
    render(<SharedRecipeView token={token} user={USER} onExit={() => {}} />)
    const btn = await screen.findByRole('button', { name: /import to my recipes/i })
    fireEvent.click(btn)

    await waitFor(() => expect(screen.getByText(/added to your recipes/i)).toBeInTheDocument())
    expect(addSpy).toHaveBeenCalledTimes(1)
    // Imported recipe gets a fresh local identity, never the sharer's
    expect(addSpy.mock.calls[0][0]).toMatchObject({ name: 'Shared Avocado Toast', source: 'user', custom: true })
    expect(upsertSpy).toHaveBeenCalledWith('user-123', expect.objectContaining({ name: 'Shared Avocado Toast' }))
  })

  it('calls onExit when "Open Wellness Hub" is clicked', async () => {
    const onExit = vi.fn()
    const token = await encodeRecipe(RECIPE)
    render(<SharedRecipeView token={token} user={null} onExit={onExit} />)
    const exit = await screen.findByRole('button', { name: /open wellness hub/i })
    fireEvent.click(exit)
    expect(onExit).toHaveBeenCalled()
  })
})
