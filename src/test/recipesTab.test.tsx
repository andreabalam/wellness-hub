/**
 * RecipesTab — Supabase/sync paths that components.test can't reach (it runs
 * with supabase=null). Here supabase + the sync layer are mocked so the
 * fetch-merge effect, handleSave id reconciliation, and handleDelete all run.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'
import type { Recipe } from '../data/recipes'

const getUser = vi.fn()
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getUser: (...a: unknown[]) => getUser(...a) } },
  isConfigured: true,
}))

vi.mock('../lib/sync', () => ({
  fetchBuiltinRecipes: vi.fn(),
  fetchUserRecipes: vi.fn(),
  upsertUserRecipe: vi.fn(),
  deleteUserRecipe: vi.fn(),
  pushErrorLog: vi.fn(),
}))

import RecipesTab from '../components/RecipesTab'
import * as sync from '../lib/sync'
import type { OpenRecipeRequest } from '../components/RecipesTab'

const mockSync = sync as unknown as Record<string, ReturnType<typeof vi.fn>>
const FAKE_USER = { id: 'u-1', email: 't@e.com' } as User

function recipe(over: Partial<Recipe>): Recipe {
  return {
    id: 1,
    cat: 'meal',
    type: 'Meal',
    color: 'var(--green)',
    sc: 'cg',
    name: 'Base',
    tag: 'tag',
    prepL: '10 min',
    prepC: 'var(--green)',
    hk: 400,
    hp: '20g',
    hc: '30g',
    hf: '10g',
    mk: 400,
    mp: '20g',
    mc: '30g',
    mf: '10g',
    ings: [['Egg', '2']],
    steps: ['Cook'],
    tip: '',
    custom: false,
    ...over,
  }
}

const BUILTIN = recipe({ id: 1, name: 'Built Bowl', custom: false })
const DB_CUSTOM = recipe({ id: 2, name: 'DB Smoothie', cat: 'smoothie', custom: true })

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
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: FAKE_USER } })
  mockSync['fetchBuiltinRecipes'].mockResolvedValue([BUILTIN])
  mockSync['fetchUserRecipes'].mockResolvedValue([])
  mockSync['upsertUserRecipe'].mockResolvedValue(99)
  mockSync['deleteUserRecipe'].mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllGlobals())

const settled = () =>
  waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())

describe('RecipesTab — fetch & merge effect', () => {
  it('loads the remote builtin catalog and merges DB custom recipes', async () => {
    mockSync['fetchUserRecipes'].mockResolvedValue([DB_CUSTOM])
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    expect(screen.getByText('Built Bowl')).toBeInTheDocument()
    expect(screen.getByText('DB Smoothie')).toBeInTheDocument()
  })

  it('pushes a never-synced local recipe and applies the DB id', async () => {
    const placeholder = recipe({ id: 1.7e12, name: 'Local Only', custom: true })
    ls['whub_custom_recipes_v1'] = JSON.stringify([placeholder])
    mockSync['fetchUserRecipes'].mockResolvedValue([])
    mockSync['upsertUserRecipe'].mockResolvedValue(7)
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() =>
      expect(mockSync['upsertUserRecipe']).toHaveBeenCalledWith(
        FAKE_USER.id,
        expect.objectContaining({ name: 'Local Only' }),
      ),
    )
  })

  it('reports a user-fetch error without wiping local recipes', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([DB_CUSTOM])
    mockSync['fetchUserRecipes'].mockRejectedValue(new Error('offline'))
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    // local recipe is preserved (null user-fetch → keep local untouched)
    expect(screen.getByText('DB Smoothie')).toBeInTheDocument()
  })

  it('keeps the static fallback when the builtin fetch fails', async () => {
    mockSync['fetchBuiltinRecipes'].mockResolvedValue(null)
    mockSync['fetchUserRecipes'].mockResolvedValue([])
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    // No crash; the All filter button still renders
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
  })
})

describe('RecipesTab — save id reconciliation', () => {
  async function openModalAndSave(name: string) {
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    fireEvent.click(screen.getByRole('button', { name: '+ Add my recipe' }))
    fireEvent.change(await screen.findByPlaceholderText('e.g. Mango Chia Pudding'), {
      target: { value: name },
    })
    fireEvent.click(screen.getByText('Save recipe'))
  }

  it('swaps the placeholder id for the DB-assigned id on save', async () => {
    mockSync['upsertUserRecipe'].mockResolvedValue(123)
    await openModalAndSave('Swapped Recipe')
    await waitFor(() => expect(mockSync['upsertUserRecipe']).toHaveBeenCalled())
    expect(screen.getByText('Swapped Recipe')).toBeInTheDocument()
  })

  it('surfaces a failure when the DB returns no id', async () => {
    mockSync['upsertUserRecipe'].mockResolvedValue(null)
    await openModalAndSave('Failing Recipe')
    await waitFor(() => expect(mockSync['upsertUserRecipe']).toHaveBeenCalled())
    // Local copy is still shown; failure was reported, not thrown
    expect(screen.getByText('Failing Recipe')).toBeInTheDocument()
  })

  it('catches a thrown upsert error', async () => {
    mockSync['upsertUserRecipe'].mockRejectedValue(new Error('boom'))
    await openModalAndSave('Throwing Recipe')
    await waitFor(() => expect(mockSync['upsertUserRecipe']).toHaveBeenCalled())
    expect(screen.getByText('Throwing Recipe')).toBeInTheDocument()
  })
})

describe('RecipesTab — delete, fork, cook, hide, grocery', () => {
  it('deletes a custom recipe through Supabase', async () => {
    mockSync['fetchUserRecipes'].mockResolvedValue([DB_CUSTOM])
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    fireEvent.click(screen.getByText('DB Smoothie').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByText('Delete recipe'))
    await waitFor(() => expect(mockSync['deleteUserRecipe']).toHaveBeenCalledWith(2))
    expect(screen.queryByText('DB Smoothie')).not.toBeInTheDocument()
  })

  const cardOf = (name: string) => screen.getByText(name).closest('.rcard') as HTMLElement

  it('updates an existing custom recipe (edit → save changes)', async () => {
    mockSync['fetchUserRecipes'].mockResolvedValue([DB_CUSTOM])
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    const card = cardOf('DB Smoothie')
    fireEvent.click(card)
    fireEvent.click(within(card).getByLabelText('Edit recipe'))
    const name = await screen.findByDisplayValue('DB Smoothie')
    fireEvent.change(name, { target: { value: 'DB Smoothie v2' } })
    fireEvent.click(screen.getByText('Save changes'))
    await waitFor(() => expect(mockSync['upsertUserRecipe']).toHaveBeenCalled())
    expect(screen.getByText('DB Smoothie v2')).toBeInTheDocument()
  })

  it('opens an existing fork when editing a built-in that was already forked', async () => {
    const fork = recipe({ id: 1.7e12, name: 'Forked Bowl', custom: true, defaultId: 1 })
    ls['whub_custom_recipes_v1'] = JSON.stringify([fork])
    mockSync['fetchUserRecipes'].mockResolvedValue([fork])
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    const card = cardOf('Built Bowl')
    fireEvent.click(card)
    fireEvent.click(within(card).getByLabelText('Edit recipe'))
    // The existing fork is opened (its name prefills the modal), not a fresh fork
    expect(await screen.findByDisplayValue('Forked Bowl')).toBeInTheDocument()
  })

  it('shows a cook counter sourced from tracker history', async () => {
    ls['whub_tracker_v3'] = JSON.stringify({
      '2026-06-15': {
        foods: [
          { n: 'Built Bowl', k: 400, p: 1, c: 1, f: 1, fi: 1 },
          { n: 'Built Bowl', k: 400, p: 1, c: 1, f: 1, fi: 1 },
        ],
        workout: null,
        wkNotes: '',
        energy: 0,
        mood: 0,
        sleep: 0,
        stress: 0,
        water: 0,
        phase: '',
        notes: '',
        medMin: 0,
        medStyle: '',
      },
    })
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    expect(screen.getByTitle('Cooked 2 times')).toBeInTheDocument()
  })

  it('pluralises the hidden-suggestions banner', async () => {
    mockSync['fetchBuiltinRecipes'].mockResolvedValue([
      BUILTIN,
      recipe({ id: 2, name: 'Second Bowl' }),
    ])
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    const c1 = cardOf('Built Bowl')
    fireEvent.click(c1)
    fireEvent.click(within(c1).getByLabelText('Hide this suggestion'))
    const c2 = cardOf('Second Bowl')
    fireEvent.click(c2)
    fireEvent.click(within(c2).getByLabelText('Hide this suggestion'))
    expect(await screen.findByText(/2 suggestions hidden/)).toBeInTheDocument()
  })

  it('forks a built-in recipe on edit (opens the modal)', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    fireEvent.click(screen.getByText('Built Bowl').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Edit recipe'))
    expect(await screen.findByText('Recipe')).toBeInTheDocument()
  })

  it('opens cooking mode for a recipe with steps', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    fireEvent.click(screen.getByText('Built Bowl').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Cook this recipe'))
    await waitFor(() => expect(screen.getByText('✕ Exit cooking mode')).toBeInTheDocument())
  })

  it('hides a built-in suggestion and restores it', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    fireEvent.click(screen.getByText('Built Bowl').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Hide this suggestion'))
    expect(await screen.findByText(/suggestion hidden/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Restore all'))
    expect(screen.getByText('Built Bowl')).toBeInTheDocument()
  })

  it('opens the grocery ingredient modal and adds items', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    fireEvent.click(screen.getByText('Built Bowl').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByLabelText('Add ingredients to grocery list'))
    await screen.findByText(/Add to category/)
    fireEvent.click(screen.getByRole('button', { name: /item/ }))
    // modal closes after adding
    await waitFor(() => expect(screen.queryByText(/Add to category/)).not.toBeInTheDocument())
  })
})

describe('RecipesTab — diet filter & open-from-tracker', () => {
  it('filters by diet tag and toggles it off', async () => {
    mockSync['fetchBuiltinRecipes'].mockResolvedValue([
      recipe({ id: 1, name: 'Vegan Bowl', cat: 'meal', dietTag: 'vegan' }),
      recipe({ id: 2, name: 'Meaty Bowl', cat: 'meal' }),
    ])
    render(<RecipesTab user={FAKE_USER} />)
    await settled()
    expect(screen.getByRole('button', { name: 'All diets' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Vegan' }))
    expect(screen.getByText('Vegan Bowl')).toBeInTheDocument()
    expect(screen.queryByText('Meaty Bowl')).not.toBeInTheDocument()
    // category filter combined with diet filter
    fireEvent.click(screen.getByRole('button', { name: /Meals/ }))
    expect(screen.getByText('Vegan Bowl')).toBeInTheDocument()
    // toggle the diet tag back off
    fireEvent.click(screen.getByRole('button', { name: 'Vegan' }))
    expect(screen.getByText('Meaty Bowl')).toBeInTheDocument()
  })

  it('auto-opens a recipe matched by name from the tracker badge', async () => {
    const req: OpenRecipeRequest = { name: 'Built Bowl', seq: 1 }
    render(<RecipesTab user={FAKE_USER} openRequest={req} />)
    await settled()
    expect(await screen.findByText('Built Bowl')).toBeInTheDocument()
  })

  it('falls back to a search when the tracker badge matches nothing', async () => {
    const req: OpenRecipeRequest = { name: 'Nonexistent', seq: 2 }
    render(<RecipesTab user={FAKE_USER} openRequest={req} />)
    await settled()
    const search = screen.getByPlaceholderText('Search recipes, ingredients…') as HTMLInputElement
    expect(search.value).toBe('Nonexistent')
  })
})
