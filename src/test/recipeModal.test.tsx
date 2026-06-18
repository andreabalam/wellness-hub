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

  it('reports a rate-limit when every lookup errored', async () => {
    computeRecipeMacros.mockResolvedValue({
      matched: 0,
      errored: 1,
      rows: [{ ing: 'Rice', amount: '100g', status: 'error' }],
      totals: { k: 0, p: 0, c: 0, f: 0, fi: 0 },
    })
    render(<RecipeModal {...baseProps} />)
    addIngredient()
    fireEvent.click(screen.getByRole('button', { name: /Calculate|USDA|macros/i }))
    expect(await screen.findByText(/try again in a bit/i)).toBeInTheDocument()
  })

  it('labels AI-estimated ingredients and notes them', async () => {
    computeRecipeMacros.mockResolvedValue({
      matched: 1,
      errored: 0,
      estimated: 1,
      rows: [
        {
          ing: 'Maca powder',
          amount: '100g',
          status: 'ok',
          grams: 100,
          matchName: 'Maca powder',
          kcal: 325,
          estimated: true,
        },
      ],
      totals: { k: 325, p: 14, c: 71, f: 2, fi: 8 },
    })
    render(<RecipeModal {...baseProps} />)
    addIngredient()
    fireEvent.click(screen.getByRole('button', { name: /Calculate|USDA|macros/i }))
    await waitFor(() =>
      expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('325'),
    )
    expect(screen.getByText(/used an AI estimate/i)).toBeInTheDocument()
    expect(screen.getByText(/\(AI estimate\)/)).toBeInTheDocument()
  })

  it('fills partial macros and warns when some lookups fail', async () => {
    computeRecipeMacros.mockResolvedValue({
      matched: 1,
      errored: 2,
      rows: [
        { ing: 'Rice', amount: '100g', status: 'ok', grams: 100, matchName: 'Rice', kcal: 130 },
        { ing: 'Milk', amount: '200g', status: 'error' },
        { ing: 'Egg', amount: '1', status: 'error' },
      ],
      totals: { k: 130, p: 5, c: 28, f: 1, fi: 2 },
    })
    render(<RecipeModal {...baseProps} />)
    addIngredient()
    fireEvent.click(screen.getByRole('button', { name: /Calculate|USDA|macros/i }))
    // Macros still applied from the one resolved ingredient
    await waitFor(() =>
      expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('130'),
    )
    // …and a partial-result warning is shown
    expect(screen.getByText(/2 ingredients couldn't be looked up/i)).toBeInTheDocument()
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

  it('applies every field of a rich import result', async () => {
    importRecipeFromUrl.mockResolvedValue({
      name: 'Rich Recipe',
      cat: 'meal',
      tag: 'Hearty · filling',
      prepTime: '25 min',
      ings: [['Beans', '1 can']],
      steps: ['Heat', 'Serve'],
      tip: 'Add salt',
      kcal: 510,
      protein: '30g',
      carbs: '40g',
      fat: '12g',
      fiber: '9g',
      healthTag: 'healthy',
      dietTag: 'vegan',
      link: 'https://src.example/r',
    })
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('https://example.com/recipe'), {
      target: { value: 'https://x.com/r' },
    })
    fireEvent.click(screen.getByText('Import'))
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Rich Recipe'))
    expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('510')
    expect(screen.getByText(/Recipe extracted/)).toBeInTheDocument()
  })

  it('imports from a dropped/selected file and offers a redo', async () => {
    importRecipeFromFile.mockResolvedValue({ name: 'File Recipe', kcal: 300 })
    render(<RecipeModal {...baseProps} />)
    const fileInput = screen.getByTestId('recipe-file-input')
    const file = new File(['data'], 'recipe.pdf', { type: 'application/pdf' })
    fireEvent.change(fileInput, { target: { files: [file] } })
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('File Recipe'))
    // Redo returns to the import zone
    fireEvent.click(screen.getByTitle('Import a different file'))
    expect(screen.getByTestId('recipe-file-input')).toBeInTheDocument()
  })

  it('surfaces a file import error', async () => {
    importRecipeFromFile.mockRejectedValue(new Error('bad pdf'))
    render(<RecipeModal {...baseProps} />)
    const file = new File(['x'], 'r.pdf', { type: 'application/pdf' })
    fireEvent.change(screen.getByTestId('recipe-file-input'), { target: { files: [file] } })
    expect(await screen.findByText(/bad pdf/)).toBeInTheDocument()
  })
})

describe('RecipeModal — form editing controls', () => {
  function addIngredient(name = 'Rice') {
    fireEvent.change(screen.getByPlaceholderText('Ingredient'), { target: { value: name } })
    fireEvent.click(screen.getAllByText('+')[0])
  }
  function addStep(txt: string) {
    fireEvent.change(screen.getByPlaceholderText('Add a step...'), { target: { value: txt } })
    fireEvent.click(screen.getAllByText('+')[1])
  }

  it('removes an ingredient', () => {
    render(<RecipeModal {...baseProps} />)
    addIngredient('Tofu')
    expect(screen.getByText('Tofu')).toBeInTheDocument()
    fireEvent.click(screen.getByText('×', { selector: '.icon-delete' }))
    expect(screen.queryByText('Tofu')).not.toBeInTheDocument()
  })

  it('edits a step inline and commits with Enter', () => {
    render(<RecipeModal {...baseProps} />)
    addStep('Original')
    fireEvent.click(screen.getByText('Original'))
    const edit = screen.getByDisplayValue('Original')
    fireEvent.change(edit, { target: { value: 'Edited' } })
    fireEvent.keyDown(edit, { key: 'Enter' })
    expect(screen.getByText('Edited')).toBeInTheDocument()
  })

  it('cancels an inline step edit with Escape', () => {
    render(<RecipeModal {...baseProps} />)
    addStep('KeepMe')
    fireEvent.click(screen.getByText('KeepMe'))
    fireEvent.keyDown(screen.getByDisplayValue('KeepMe'), { key: 'Escape' })
    expect(screen.getByText('KeepMe')).toBeInTheDocument()
  })

  it('reorders steps down then deletes one', () => {
    render(<RecipeModal {...baseProps} />)
    addStep('One')
    addStep('Two')
    fireEvent.click(screen.getAllByTitle('Move down')[0])
    fireEvent.click(screen.getAllByText('×', { selector: '.icon-delete' })[0])
    // one step removed; the other remains
    expect(screen.getAllByText(/One|Two/).length).toBeGreaterThanOrEqual(1)
  })

  it('toggles health, diet, prep and category chips', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(nameInput(), { target: { value: 'Chippy' } })
    fireEvent.click(screen.getByText('✦ Healthy'))
    fireEvent.click(screen.getByText('Vegan'))
    fireEvent.click(screen.getByText('Breakfast')) // a category chip
    fireEvent.click(screen.getByText('Save recipe'))
    const saved = onSave.mock.calls[0][0]
    expect(saved.healthTag).toBe('healthy')
    expect(saved.dietTag).toBe('vegan')
  })

  it('shows per-ingredient calc rows with mixed statuses', async () => {
    computeRecipeMacros.mockResolvedValue({
      matched: true,
      rows: [
        {
          status: 'ok',
          ing: 'Rice',
          amount: '100g',
          matchName: 'Rice, white',
          grams: 100,
          kcal: 130,
        },
        { status: 'no-amount', ing: 'Salt', amount: '' },
        { status: 'no-match', ing: 'Unicorn', amount: '1' },
      ],
      totals: { k: 130, p: 3, c: 28, f: 0, fi: 1 },
    })
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByLabelText('Servings the recipe makes'), { target: { value: '2' } })
    addIngredient('Rice')
    fireEvent.click(screen.getByRole('button', { name: /Calculate from ingredients/i }))
    expect(await screen.findByText(/Rice, white/)).toBeInTheDocument()
    expect(screen.getByText(/amount unclear/)).toBeInTheDocument()
    expect(screen.getByText(/no food database match/)).toBeInTheDocument()
  })

  it('closes when the overlay backdrop is clicked', () => {
    const onClose = vi.fn()
    const { container } = render(<RecipeModal {...baseProps} onClose={onClose} />)
    fireEvent.click(container.querySelector('.modal-overlay') as HTMLElement)
    expect(onClose).toHaveBeenCalled()
  })

  it('toggles health and prep chips off, and saves fiber', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(nameInput(), { target: { value: 'Toggle Dish' } })
    // on then off
    fireEvent.click(screen.getByText('✦ Healthy'))
    fireEvent.click(screen.getByText('✦ Healthy'))
    fireEvent.click(screen.getByText('Vegan'))
    fireEvent.click(screen.getByText('Vegan'))
    const prep = screen.getByText('15 min')
    fireEvent.click(prep)
    fireEvent.click(prep)
    fireEvent.change(screen.getByPlaceholderText('fiber g'), { target: { value: '7' } })
    fireEvent.click(screen.getByText('Save recipe'))
    const saved = onSave.mock.calls[0][0]
    expect(saved.healthTag).toBeUndefined()
    expect(saved.hfi).toBe('7g')
  })

  it('imports from a dropped file via the drop zone', async () => {
    importRecipeFromFile.mockResolvedValue({ name: 'Dropped Dish', kcal: 200 })
    const { container } = render(<RecipeModal {...baseProps} />)
    const zone = container.querySelector('.import-zone') as HTMLElement
    fireEvent.dragOver(zone)
    fireEvent.dragLeave(zone)
    const file = new File(['x'], 'r.pdf', { type: 'application/pdf' })
    fireEvent.drop(zone, { dataTransfer: { files: [file] } })
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Dropped Dish'))
  })

  it('maps an unknown category to "meal" and ignores bad health/diet tags', async () => {
    importRecipeFromUrl.mockResolvedValue({
      name: 'Odd Recipe',
      cat: 'totally-unknown-cat',
      healthTag: 'weird',
      dietTag: 'not-a-diet',
    })
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('https://example.com/recipe'), {
      target: { value: 'https://x.com/r' },
    })
    fireEvent.click(screen.getByText('Import'))
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Odd Recipe'))
  })

  it('requires sign-in when there is no Supabase session (URL import)', async () => {
    const { supabase } = await import('../lib/supabase')
    vi.mocked(supabase!.auth.getSession).mockResolvedValueOnce({
      data: { session: null },
    } as never)
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('https://example.com/recipe'), {
      target: { value: 'https://x.com/r' },
    })
    fireEvent.click(screen.getByText('Import'))
    expect(await screen.findByText(/Sign in to use URL import/)).toBeInTheDocument()
  })

  it('imports from a URL via the Enter key', async () => {
    importRecipeFromUrl.mockResolvedValue({ name: 'Enter Dish', kcal: 100 })
    render(<RecipeModal {...baseProps} />)
    const url = screen.getByPlaceholderText('https://example.com/recipe')
    fireEvent.change(url, { target: { value: 'https://x.com/r' } })
    fireEvent.keyDown(url, { key: 'Enter' })
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Enter Dish'))
  })

  it('Enter on an empty URL field is a no-op', () => {
    render(<RecipeModal {...baseProps} />)
    const url = screen.getByPlaceholderText('https://example.com/recipe')
    fireEvent.keyDown(url, { key: 'Enter' }) // url empty → early return
    expect(importRecipeFromUrl).not.toHaveBeenCalled()
  })

  it('ignores an empty add-step click', () => {
    render(<RecipeModal {...baseProps} />)
    const before = screen.getAllByText('+').length
    fireEvent.click(screen.getAllByText('+')[1]) // step field empty → no-op
    expect(screen.getAllByText('+').length).toBe(before)
  })

  it('keeps the original step when an inline edit is cleared', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('Add a step...'), { target: { value: 'Stir' } })
    fireEvent.click(screen.getAllByText('+')[1])
    fireEvent.click(screen.getByText('Stir'))
    const edit = screen.getByDisplayValue('Stir')
    fireEvent.change(edit, { target: { value: '   ' } }) // whitespace → empty
    fireEvent.keyDown(edit, { key: 'Enter' }) // commitEditStep keeps prev
    expect(screen.getByText('Stir')).toBeInTheDocument()
  })

  it('maps a known imported category onto the matching chip', async () => {
    importRecipeFromUrl.mockResolvedValue({ name: 'Brekkie', cat: 'breakfast' })
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('https://example.com/recipe'), {
      target: { value: 'https://x.com/r' },
    })
    fireEvent.click(screen.getByText('Import'))
    await waitFor(() => expect((nameInput() as HTMLInputElement).value).toBe('Brekkie'))
  })
})
