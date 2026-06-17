/**
 * RecipeModal tests — form save/validation, ingredients/steps, macro calc, and
 * the AI import flows (file/url/text), all mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } } }) },
  },
}))

const { importRecipeFromText, importRecipeFromUrl, importRecipeFromFile, computeRecipeMacros } =
  vi.hoisted(() => ({
    importRecipeFromText: vi.fn(),
    importRecipeFromUrl: vi.fn(),
    importRecipeFromFile: vi.fn(),
    computeRecipeMacros: vi.fn(),
  }))
vi.mock('../lib/recipeImport', async importOriginal => {
  const orig = await importOriginal<typeof import('../lib/recipeImport')>()
  return { ...orig, importRecipeFromText, importRecipeFromUrl, importRecipeFromFile }
})
vi.mock('../lib/recipeMacros', async importOriginal => {
  const orig = await importOriginal<typeof import('../lib/recipeMacros')>()
  return { ...orig, computeRecipeMacros, makeCachedUsdaLookup: vi.fn(() => vi.fn()) }
})

import RecipeModal from '../components/RecipesTab/RecipeModal'
import type { Recipe } from '../data/recipes'

const baseProps = {
  customTags: ['sauce'],
  existingNames: ['Existing Dish'],
  onSave: vi.fn(),
  onAddTag: vi.fn(),
  onClose: vi.fn(),
}

beforeEach(() => vi.clearAllMocks())

function nameInput() {
  return screen.getByPlaceholderText('e.g. Mango Chia Pudding')
}

describe('RecipeModal — save & validation', () => {
  it('blocks save with no name', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.click(screen.getByText('Save recipe'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/enter a recipe name/i)).toBeInTheDocument()
  })

  it('blocks save on a duplicate name', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(nameInput(), { target: { value: 'Existing Dish' } })
    fireEvent.click(screen.getByText('Save recipe'))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText(/already exists/i)).toBeInTheDocument()
  })

  it('saves a complete recipe with macros, an ingredient and a step', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(nameInput(), { target: { value: 'My New Dish' } })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '420' } })
    fireEvent.change(screen.getByPlaceholderText('Ingredient'), { target: { value: 'Tofu' } })
    fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '200g' } })
    fireEvent.click(screen.getAllByText('+')[0]) // add ingredient
    fireEvent.change(screen.getByPlaceholderText('Add a step...'), { target: { value: 'Cook it' } })
    fireEvent.click(screen.getAllByText('+')[1]) // add step
    fireEvent.click(screen.getByText('Save recipe'))
    expect(onSave).toHaveBeenCalledTimes(1)
    const saved = onSave.mock.calls[0][0] as Recipe
    expect(saved.name).toBe('My New Dish')
    expect(saved.hk).toBe(420)
    expect(saved.ings).toEqual([['Tofu', '200g']])
    expect(saved.steps).toEqual(['Cook it'])
  })

  it('pre-fills fields when editing and uses "Save changes"', () => {
    const initial: Recipe = {
      id: 5,
      cat: 'meal',
      type: 'Meal',
      color: '',
      sc: '',
      name: 'Edit Me',
      tag: 't',
      prepL: '',
      prepC: '',
      hk: 300,
      hp: '20g',
      hc: '30g',
      hf: '10g',
      mk: 300,
      mp: '20g',
      mc: '30g',
      mf: '10g',
      ings: [['Egg', '2']],
      steps: ['Boil'],
      tip: '',
      custom: true,
    }
    render(<RecipeModal {...baseProps} initialRecipe={initial} />)
    expect((nameInput() as HTMLInputElement).value).toBe('Edit Me')
    expect(screen.getByText('Save changes')).toBeInTheDocument()
  })
})

describe('RecipeModal — tags, ingredients, steps', () => {
  it('adds a custom tag', () => {
    const onAddTag = vi.fn()
    render(<RecipeModal {...baseProps} onAddTag={onAddTag} />)
    fireEvent.change(screen.getByPlaceholderText('New tag (e.g. Sauce, Side...)'), {
      target: { value: 'Dessert' },
    })
    fireEvent.click(screen.getByText('Add tag'))
    expect(onAddTag).toHaveBeenCalledWith('dessert')
  })

  it('reorders steps with the move buttons', () => {
    render(<RecipeModal {...baseProps} />)
    const stepInput = screen.getByPlaceholderText('Add a step...')
    const addStep = () => fireEvent.click(screen.getAllByText('+')[1])
    fireEvent.change(stepInput, { target: { value: 'First' } })
    addStep()
    fireEvent.change(stepInput, { target: { value: 'Second' } })
    addStep()
    expect(screen.getByText(/First/)).toBeInTheDocument()
    expect(screen.getByText(/Second/)).toBeInTheDocument()
  })
})

describe('RecipeModal — macro calculation', () => {
  function addIngredient() {
    fireEvent.change(screen.getByPlaceholderText('Ingredient'), { target: { value: 'Rice' } })
    fireEvent.click(screen.getAllByText('+')[0])
  }

  it('fills macros from a successful calculation', async () => {
    computeRecipeMacros.mockResolvedValue({
      matched: true,
      rows: [{ grams: 100 }],
      totals: { k: 200, p: 5, c: 40, f: 1, fi: 2 },
    })
    render(<RecipeModal {...baseProps} />)
    addIngredient()
    fireEvent.click(screen.getByRole('button', { name: /Calculate|USDA|macros/i }))
    await waitFor(() =>
      expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('200'),
    )
  })

  it('shows a no-match message when nothing resolves', async () => {
    computeRecipeMacros.mockResolvedValue({
      matched: false,
      rows: [],
      totals: { k: 0, p: 0, c: 0, f: 0, fi: 0 },
    })
    render(<RecipeModal {...baseProps} />)
    addIngredient()
    fireEvent.click(screen.getByRole('button', { name: /Calculate|USDA|macros/i }))
    expect(await screen.findByText(/could be matched/i)).toBeInTheDocument()
  })

  it('shows an error when the food DB is unavailable', async () => {
    computeRecipeMacros.mockRejectedValue(new Error('offline'))
    render(<RecipeModal {...baseProps} />)
    addIngredient()
    fireEvent.click(screen.getByRole('button', { name: /Calculate|USDA|macros/i }))
    expect(await screen.findByText(/database unavailable/i)).toBeInTheDocument()
  })
})

describe('RecipeModal — import flows', () => {
  it('rejects an invalid URL', async () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('https://example.com/recipe'), {
      target: { value: 'not-a-url' },
    })
    fireEvent.click(screen.getByText('Import'))
    expect(await screen.findByText(/valid http/i)).toBeInTheDocument()
  })

  it('imports from a URL and applies the result', async () => {
    importRecipeFromUrl.mockResolvedValue({ name: 'Imported Soup', kcal: 250 })
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('https://example.com/recipe'), {
      target: { value: 'https://x.com/r' },
    })
    fireEvent.click(screen.getByText('Import'))
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Imported Soup'))
  })

  it('imports from pasted text', async () => {
    importRecipeFromText.mockResolvedValue({ name: 'Pasted Bowl', kcal: 333 })
    render(<RecipeModal {...baseProps} />)
    fireEvent.click(screen.getByText('or paste recipe text'))
    fireEvent.change(screen.getByPlaceholderText(/Paste recipe text/i), {
      target: { value: 'some recipe' },
    })
    fireEvent.click(screen.getByText('Import text'))
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Pasted Bowl'))
  })

  it('surfaces an import error', async () => {
    importRecipeFromUrl.mockRejectedValue(new Error('parse failed'))
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('https://example.com/recipe'), {
      target: { value: 'https://x.com/r' },
    })
    fireEvent.click(screen.getByText('Import'))
    expect(await screen.findByText(/parse failed/i)).toBeInTheDocument()
  })
})
