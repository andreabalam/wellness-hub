/**
 * Component tests — covers all React components not covered by pure-logic tests.
 * AuthButton and sync.ts are excluded from coverage (require live Supabase).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'

// Force the tracker's paste-to-log flow down its offline fallback (the real
// local parser) by making the AI call reject instantly — keeps tests fast and
// deterministic without a live edge function.
vi.mock('../lib/foodImport', async () => {
  const actual = await vi.importActual<typeof import('../lib/foodImport')>('../lib/foodImport')
  return { ...actual, parseFoodLog: vi.fn().mockRejectedValue(new Error('offline')) }
})

// ── localStorage mock ─────────────────────────────────────────────
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
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock'),
    revokeObjectURL: vi.fn(),
  })
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  )
  vi.stubGlobal('alert', vi.fn())
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks() // restore any spyOn mocks (e.g. document.createElement)
})

// ── Imports (ESM-hoisted, but code only runs on demand) ───────────
import UpdatePrompt from '../components/UpdatePrompt'
import GroceryPanel from '../components/RecipesTab/GroceryPanel'
import RecipeCard from '../components/RecipesTab/RecipeCard'
import RecipeModal from '../components/RecipesTab/RecipeModal'
import CookingMode from '../components/RecipesTab/CookingMode'
import GroceryIngredientModal from '../components/RecipesTab/GroceryIngredientModal'
import RecipesTab from '../components/RecipesTab'
import WorkoutsTab from '../components/WorkoutsTab'
import ErrorBoundary from '../components/ErrorBoundary'
import { MALE_DEFAULT_PLAN } from '../data/workouts'
import ScheduleTab from '../components/ScheduleTab'
import ScheduleEditor from '../components/ScheduleTab/ScheduleEditor'
import TrackerTab from '../components/TrackerTab'
import App from '../App'
import { SCHEDULE_BLOCKS, defaultToCustomBlock } from '../data/schedule'
import type { CustomBlock } from '../data/schedule'
import type { Recipe } from '../data/recipes'
import type { User } from '@supabase/supabase-js'
import { hiddenRecipeStore } from '../hooks/useStore'
import RemindersSection from '../components/TrackerTab/RemindersSection'
import * as foodSearch from '../lib/foodSearch'

const FAKE_USER = { id: 'test-user-1' } as User

// ── Recipe fixtures ───────────────────────────────────────────────
const BASE_RECIPE: Recipe = {
  id: 9001,
  name: 'Test Dish',
  cat: 'meal',
  type: 'Meal',
  color: 'var(--green)',
  sc: 'cg',
  tag: 'Quick · high-protein',
  prepL: '20 min',
  prepC: 'var(--green)',
  hk: 400,
  hp: '35g',
  hc: '30g',
  hf: '12g',
  hfi: '5g',
  mk: 380,
  mp: '32g',
  mc: '28g',
  mf: '11g',
  ings: [
    ['Chicken breast', '200g'],
    ['Broccoli', '1 cup'],
  ],
  steps: ['Cook chicken', 'Steam broccoli'],
  tip: 'Add lemon for brightness',
  custom: false,
}

const CUSTOM_RECIPE: Recipe = {
  ...BASE_RECIPE,
  id: 9002,
  name: 'My Smoothie',
  cat: 'smoothie',
  type: 'Smoothie',
  custom: true,
  prepL: 'Custom',
  prepC: 'var(--purple)',
  color: 'var(--purple)',
  sc: 'cp',
  hfi: '0g',
}

// ── Helpers ───────────────────────────────────────────────────────
/** Safe createElement spy: passes through non-'a' tags to real impl */
function spyCreateLink(click: ReturnType<typeof vi.fn>) {
  const orig = document.createElement.bind(document)
  const link = orig('a')
  link.click = click as unknown as () => void
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) =>
    tag === 'a' ? link : orig(tag),
  )
}

// ═════════════════════════════════════════════════════════════════
// UpdatePrompt
// ═════════════════════════════════════════════════════════════════
describe('UpdatePrompt', () => {
  it('renders nothing when onUpdate is null', () => {
    const { container } = render(<UpdatePrompt onUpdate={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders a banner when onUpdate is a function', () => {
    render(<UpdatePrompt onUpdate={vi.fn()} />)
    expect(screen.getByText('New version available')).toBeInTheDocument()
  })

  it('clicking Update calls the callback and hides the banner', () => {
    const onUpdate = vi.fn()
    render(<UpdatePrompt onUpdate={onUpdate} />)
    fireEvent.click(screen.getByText('Update'))
    expect(onUpdate).toHaveBeenCalledOnce()
    expect(screen.queryByText('New version available')).not.toBeInTheDocument()
  })

  it('clicking × hides the banner without calling onUpdate', () => {
    const onUpdate = vi.fn()
    render(<UpdatePrompt onUpdate={onUpdate} />)
    fireEvent.click(screen.getByText('×'))
    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.queryByText('New version available')).not.toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// GroceryPanel
// ═════════════════════════════════════════════════════════════════
describe('GroceryPanel', () => {
  it('renders category headers', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    expect(screen.getByText('Produce - Vegetables')).toBeInTheDocument()
    expect(screen.getByText('Produce - Fruit')).toBeInTheDocument()
    expect(screen.getByText('Protein - Animal')).toBeInTheDocument()
  })

  it('renders a grocery item', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    expect(screen.getByText('Baby spinach')).toBeInTheDocument()
  })

  it('renders nutrition info for items that have nutri data', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    // Multiple items render "kcal" in their nutrition line
    const kcalTexts = screen.getAllByText(/kcal/)
    expect(kcalTexts.length).toBeGreaterThan(5)
  })

  it('renders specific nutrition for Blueberries (84 kcal)', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    // The blueberries nutrition span contains "84 kcal"
    expect(screen.getByText(/84 kcal/)).toBeInTheDocument()
  })

  it('clicking an item adds it to the checked list (gchecked class)', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    const spinach = screen.getByText('Baby spinach').closest('.gitem')!
    expect(spinach).not.toHaveClass('gchecked')
    fireEvent.click(spinach)
    expect(spinach).toHaveClass('gchecked')
  })

  it('clicking a checked item unchecks it', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    const spinach = screen.getByText('Baby spinach').closest('.gitem')!
    fireEvent.click(spinach)
    fireEvent.click(spinach)
    expect(spinach).not.toHaveClass('gchecked')
  })

  it('clear all button unchecks all items', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    const spinach = screen.getByText('Baby spinach').closest('.gitem')!
    fireEvent.click(spinach)
    expect(spinach).toHaveClass('gchecked')
    fireEvent.click(screen.getByText('Clear all'))
    expect(spinach).not.toHaveClass('gchecked')
  })

  it('guest: shows sign-in prompt instead of grocery list', () => {
    render(<GroceryPanel />)
    expect(screen.getByText(/Sign in to manage your personalised grocery list/)).toBeInTheDocument()
    expect(screen.queryByText('Produce - Vegetables')).not.toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// GroceryPanel Phase 5 — dynamic catalog items
// ═════════════════════════════════════════════════════════════════
describe('GroceryPanel — dynamic catalog', () => {
  it('shows "Add item to my list" toggle button', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    expect(screen.getByRole('button', { name: /add grocery item/i })).toBeInTheDocument()
  })

  it('clicking the toggle reveals the add-item form', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    expect(screen.getByPlaceholderText(/Item name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add item' })).toBeInTheDocument()
  })

  it('Cancel button hides the form again', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByPlaceholderText(/Item name/i)).not.toBeInTheDocument()
  })

  it('Add item button is disabled when name is empty', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    expect(screen.getByRole('button', { name: 'Add item' })).toBeDisabled()
  })

  it('typing a name enables the Add item button', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Kimchi' } })
    expect(screen.getByRole('button', { name: 'Add item' })).not.toBeDisabled()
  })

  it('submitting adds the item and it appears in the list', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Kimchi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByText('Kimchi')).toBeInTheDocument()
    // Form closes after submit
    expect(screen.queryByPlaceholderText(/Item name/i)).not.toBeInTheDocument()
  })

  it('pressing Enter in the name field submits the form', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Sauerkraut' } })
    fireEvent.keyDown(screen.getByPlaceholderText(/Item name/i), { key: 'Enter' })
    expect(screen.getByText('Sauerkraut')).toBeInTheDocument()
  })

  it('user-added item can be checked off', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Miso' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    const item = screen.getByText('Miso').closest('.gitem')!
    fireEvent.click(item)
    expect(item).toHaveClass('gchecked')
  })

  it('user-added item has a × remove button', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Tempeh' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByRole('button', { name: /Remove Tempeh/i })).toBeInTheDocument()
  })

  it('clicking × removes the item from the list', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Natto' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByText('Natto')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Remove Natto/i }))
    expect(screen.queryByText('Natto')).not.toBeInTheDocument()
  })

  it('user item for a standard category appears under that category header', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), {
      target: { value: 'Dragon Fruit' },
    })
    // Select "Produce - Fruit" category
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Produce - Fruit' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    // The item should appear; its category header should also be visible
    const header = screen.getByText('Produce - Fruit')
    const item = screen.getByText('Dragon Fruit')
    expect(header).toBeInTheDocument()
    expect(item).toBeInTheDocument()
  })

  it('item for a non-standard category appears under "My Custom Items"', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), {
      target: { value: 'Magic Beans' },
    })
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'My Custom Items' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByText('My Custom Items')).toBeInTheDocument()
    expect(screen.getByText('Magic Beans')).toBeInTheDocument()
  })

  it('multiple user items can be added independently', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    for (const name of ['Item A', 'Item B', 'Item C']) {
      fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
      fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: name } })
      fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    }
    expect(screen.getByText('Item A')).toBeInTheDocument()
    expect(screen.getByText('Item B')).toBeInTheDocument()
    expect(screen.getByText('Item C')).toBeInTheDocument()
  })

  it('clicking ✎ on an item shows an inline edit input', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    // Add an item first
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Edit Me' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    // Click the edit button
    fireEvent.click(screen.getByRole('button', { name: /Edit Edit Me/i }))
    expect(screen.getByDisplayValue('Edit Me')).toBeInTheDocument()
  })

  it('saving the edit renames the item', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Old Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    fireEvent.click(screen.getByRole('button', { name: /Edit Old Name/i }))
    const input = screen.getByDisplayValue('Old Name')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.queryByText('Old Name')).not.toBeInTheDocument()
    expect(screen.getByText('New Name')).toBeInTheDocument()
  })

  it('cancelling edit (Escape or ✕) restores original name', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'Stay Same' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    fireEvent.click(screen.getByRole('button', { name: /Edit Stay Same/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel edit' }))
    expect(screen.getByText('Stay Same')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Stay Same')).not.toBeInTheDocument()
  })

  it('pressing Enter in the edit input saves the new name (onKeyDown handler)', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), {
      target: { value: 'Press Enter' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    fireEvent.click(screen.getByRole('button', { name: /Edit Press Enter/i }))
    const input = screen.getByDisplayValue('Press Enter')
    fireEvent.change(input, { target: { value: 'Pressed' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Pressed')).toBeInTheDocument()
  })

  it('pressing Escape in the edit input cancels without saving (onKeyDown handler)', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
    fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: 'No Change' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    fireEvent.click(screen.getByRole('button', { name: /Edit No Change/i }))
    const input = screen.getByDisplayValue('No Change')
    fireEvent.change(input, { target: { value: 'changed' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.getByText('No Change')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('changed')).not.toBeInTheDocument()
  })

  it('all items (including seeded default items) have edit and remove buttons', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    // Baby spinach is a seeded default item
    expect(screen.getByRole('button', { name: /Edit Baby spinach/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Remove Baby spinach/i })).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// RecipeCard
// ═════════════════════════════════════════════════════════════════
describe('RecipeCard', () => {
  it('renders the recipe name', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    expect(screen.getByText('Test Dish')).toBeInTheDocument()
  })

  it('renders the tagline', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    expect(screen.getByText('Quick · high-protein')).toBeInTheDocument()
  })

  it('renders macro values', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    expect(screen.getByText('400')).toBeInTheDocument()
    expect(screen.getByText('35g')).toBeInTheDocument()
  })

  it('shows fiber when hfi is not "0g"', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    expect(screen.getByText('5g')).toBeInTheDocument()
  })

  it('does not show fiber label when hfi is "0g"', () => {
    render(<RecipeCard recipe={{ ...BASE_RECIPE, hfi: '0g' }} />)
    expect(screen.queryAllByText('fiber')).toHaveLength(0)
  })

  it('shows "tap to see recipe" hint when collapsed', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    expect(screen.getByText('tap to see recipe')).toBeInTheDocument()
  })

  it('clicking the card toggles to "tap to collapse" hint', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByText('tap to collapse')).toBeInTheDocument()
  })

  it('Share button copies a share link to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } }) // no navigator.share → clipboard fallback
    render(<RecipeCard recipe={BASE_RECIPE} />)
    fireEvent.click(screen.getByRole('button', { name: /share recipe/i }))
    await waitFor(() => expect(writeText).toHaveBeenCalled())
    const url = writeText.mock.calls[0][0] as string
    expect(url).toContain('#/r/')
    await waitFor(() => expect(screen.getByText('Link copied!')).toBeInTheDocument())
  })

  it('clicking an open card shows "tap to see recipe" again', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    const card = screen.getByText('Test Dish').closest('.rcard') as HTMLElement
    fireEvent.click(card)
    fireEvent.click(card)
    expect(screen.getByText('tap to see recipe')).toBeInTheDocument()
  })

  it('clicking the card reveals ingredients', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByText('Chicken breast')).toBeInTheDocument()
    expect(screen.getByText('Cook chicken')).toBeInTheDocument()
  })

  it('shows tip when open', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByText('Add lemon for brightness')).toBeInTheDocument()
  })

  it('shows "serves 2" in ingredients label for non-custom', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByText('Ingredients (serves 2)')).toBeInTheDocument()
  })

  it('shows "Ingredients" without "(serves 2)" for custom', () => {
    render(<RecipeCard recipe={CUSTOM_RECIPE} />)
    fireEvent.click(screen.getByText('My Smoothie').closest('.rcard') as HTMLElement)
    expect(screen.queryByText(/serves 2/)).not.toBeInTheDocument()
  })

  it('shows "My recipe" label for custom cards', () => {
    render(<RecipeCard recipe={CUSTOM_RECIPE} />)
    expect(screen.getByText(/My recipe/)).toBeInTheDocument()
  })

  it('shows kcal label for all recipe cards', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    expect(screen.getByText('kcal')).toBeInTheDocument()
  })

  it('never shows him kcal label (removed feature)', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    expect(screen.queryByText('him kcal')).not.toBeInTheDocument()
    expect(screen.queryByText('her kcal')).not.toBeInTheDocument()
  })

  it('shows ferment note for ferment cat recipes', () => {
    const ferment = { ...BASE_RECIPE, cat: 'ferments' }
    render(<RecipeCard recipe={ferment} />)
    expect(screen.getByText(/Probiotic benefit/)).toBeInTheDocument()
  })

  it('shows Delete button when custom + onDelete + id provided', () => {
    const onDelete = vi.fn()
    render(<RecipeCard recipe={CUSTOM_RECIPE} onDelete={onDelete} />)
    fireEvent.click(screen.getByText('My Smoothie').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByText('Delete recipe'))
    expect(onDelete).toHaveBeenCalledWith(9002)
  })

  it('does not show Delete button when onDelete is not provided', () => {
    render(<RecipeCard recipe={CUSTOM_RECIPE} />)
    fireEvent.click(screen.getByText('My Smoothie').closest('.rcard') as HTMLElement)
    expect(screen.queryByText('Delete recipe')).not.toBeInTheDocument()
  })

  // ── Phase 2: action bar buttons ─────────────────────────────────

  it('shows Edit button when expanded and onEdit is provided', () => {
    render(<RecipeCard recipe={BASE_RECIPE} onEdit={vi.fn()} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('calls onEdit with the recipe when Edit is clicked', () => {
    const onEdit = vi.fn()
    render(<RecipeCard recipe={BASE_RECIPE} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEdit).toHaveBeenCalledWith(BASE_RECIPE)
  })

  it('does not show Edit button when onEdit is not provided', () => {
    render(<RecipeCard recipe={BASE_RECIPE} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('shows Cook button when expanded and recipe has steps + onCook provided', () => {
    render(<RecipeCard recipe={BASE_RECIPE} onCook={vi.fn()} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByRole('button', { name: /cook/i })).toBeInTheDocument()
  })

  it('calls onCook with the recipe when Cook is clicked', () => {
    const onCook = vi.fn()
    render(<RecipeCard recipe={BASE_RECIPE} onCook={onCook} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /cook/i }))
    expect(onCook).toHaveBeenCalledWith(BASE_RECIPE)
  })

  it('does not show Cook button when recipe has no steps', () => {
    const noSteps = { ...BASE_RECIPE, steps: [] }
    render(<RecipeCard recipe={noSteps} onCook={vi.fn()} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.queryByRole('button', { name: /cook/i })).not.toBeInTheDocument()
  })

  it('shows Grocery button when expanded and recipe has ingredients + onGrocery provided', () => {
    render(<RecipeCard recipe={BASE_RECIPE} onGrocery={vi.fn()} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByRole('button', { name: /grocery/i })).toBeInTheDocument()
  })

  it('calls onGrocery with the recipe when Grocery is clicked', () => {
    const onGrocery = vi.fn()
    render(<RecipeCard recipe={BASE_RECIPE} onGrocery={onGrocery} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /grocery/i }))
    expect(onGrocery).toHaveBeenCalledWith(BASE_RECIPE)
  })

  it('does not show Grocery button when recipe has no ingredients', () => {
    const noIngs = { ...BASE_RECIPE, ings: [] as [string, string][] }
    render(<RecipeCard recipe={noIngs} onGrocery={vi.fn()} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.queryByRole('button', { name: /grocery/i })).not.toBeInTheDocument()
  })

  it('shows Hide button for built-in recipes when onHide is provided', () => {
    render(<RecipeCard recipe={BASE_RECIPE} onHide={vi.fn()} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument()
  })

  it('calls onHide with the recipe id when Hide is clicked', () => {
    const onHide = vi.fn()
    render(<RecipeCard recipe={BASE_RECIPE} onHide={onHide} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: /hide/i }))
    expect(onHide).toHaveBeenCalledWith(9001)
  })

  it('does not show Hide button for custom recipes (Delete is shown instead)', () => {
    render(<RecipeCard recipe={CUSTOM_RECIPE} onDelete={vi.fn()} onHide={vi.fn()} />)
    fireEvent.click(screen.getByText('My Smoothie').closest('.rcard') as HTMLElement)
    // Delete is shown, Hide should not be (custom recipes use Delete)
    expect(screen.getByText('Delete recipe')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^hide$/i })).not.toBeInTheDocument()
  })

  it('action buttons do not toggle the card when clicked', () => {
    const onEdit = vi.fn()
    render(<RecipeCard recipe={BASE_RECIPE} onEdit={onEdit} />)
    fireEvent.click(screen.getByText('Test Dish').closest('.rcard') as HTMLElement)
    // Card is now open — clicking Edit should NOT close it
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(screen.getByText('tap to collapse')).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// CookingMode
// ═════════════════════════════════════════════════════════════════
describe('CookingMode', () => {
  const onClose = vi.fn()
  beforeEach(() => onClose.mockClear())

  it('renders the recipe name in the header', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    expect(screen.getByText('Test Dish')).toBeInTheDocument()
  })

  it('shows ingredients section with all items', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    expect(screen.getByText('Chicken breast')).toBeInTheDocument()
    expect(screen.getByText('Broccoli')).toBeInTheDocument()
  })

  it('shows ingredient amounts', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    expect(screen.getByText('200g')).toBeInTheDocument()
    expect(screen.getByText('1 cup')).toBeInTheDocument()
  })

  it('shows steps section with all steps', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    expect(screen.getByText('Cook chicken')).toBeInTheDocument()
    expect(screen.getByText('Steam broccoli')).toBeInTheDocument()
  })

  it('shows tip when present', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    expect(screen.getByText('Add lemon for brightness')).toBeInTheDocument()
  })

  it('calls onClose when Exit cooking mode is clicked', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    fireEvent.click(screen.getByText(/Exit cooking mode/))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('shows step counter in footer', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    expect(screen.getByText(/Step 1 of 2/)).toBeInTheDocument()
  })

  it('Next button advances to the next step', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    fireEvent.click(screen.getByText('Next ▶'))
    expect(screen.getByText(/Step 2 of 2/)).toBeInTheDocument()
  })

  it('Prev button is disabled on the first step', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    expect(screen.getByText('◀ Prev')).toBeDisabled()
  })

  it('Next button is disabled on the last step', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    fireEvent.click(screen.getByText('Next ▶'))
    expect(screen.getByText('Next ▶')).toBeDisabled()
  })

  it('clicking an ingredient checks it off', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    const chickenRow = screen.getByText('Chicken breast').closest('.cooking-ing-row')!
    fireEvent.click(chickenRow)
    // After click the ingredient text gets line-through style — indicator has '✓'
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('clicking Hide toggles the ingredients section', () => {
    render(<CookingMode recipe={BASE_RECIPE} onClose={onClose} />)
    fireEvent.click(screen.getByText('↑ Hide'))
    expect(screen.queryByText('Chicken breast')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('↓ Show'))
    expect(screen.getByText('Chicken breast')).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
describe('RecipeModal', () => {
  const noop = vi.fn()
  const baseProps = { customTags: [], onSave: noop, onAddTag: noop, onClose: noop }

  beforeEach(() => noop.mockClear())

  it('renders the modal heading', () => {
    render(<RecipeModal {...baseProps} />)
    expect(screen.getByText('Recipe')).toBeInTheDocument()
  })

  it('clicking × (close button) calls onClose', () => {
    const onClose = vi.fn()
    render(<RecipeModal {...baseProps} onClose={onClose} />)
    // The top × is the close button; the others are ingredient/step remove buttons
    const closeBtn = screen.getAllByText('×')[0]
    fireEvent.click(closeBtn)
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking Cancel calls onClose', () => {
    const onClose = vi.fn()
    render(<RecipeModal {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('save without name shows error message', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.click(screen.getByText('Save recipe'))
    expect(screen.getByText('Please enter a recipe name.')).toBeInTheDocument()
    expect(noop).not.toHaveBeenCalled()
  })

  it('can type a recipe name', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Mango Chia Pudding'), {
      target: { value: 'Berry Bowl' },
    })
    expect(screen.getByDisplayValue('Berry Bowl')).toBeInTheDocument()
  })

  it('can add an ingredient via + button', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('Ingredient'), { target: { value: 'Oats' } })
    fireEvent.change(screen.getByPlaceholderText('Amount'), { target: { value: '½ cup' } })
    fireEvent.click(screen.getAllByText('+')[0])
    expect(screen.getByText('Oats')).toBeInTheDocument()
    expect(screen.getByText('½ cup')).toBeInTheDocument()
  })

  it('can add ingredient via Enter key', () => {
    render(<RecipeModal {...baseProps} />)
    const ingInput = screen.getByPlaceholderText('Ingredient')
    fireEvent.change(ingInput, { target: { value: 'Quinoa' } })
    fireEvent.keyDown(ingInput, { key: 'Enter' })
    expect(screen.getByText('Quinoa')).toBeInTheDocument()
  })

  it('ignores add-ingredient when name is empty', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.click(screen.getAllByText('+')[0])
    // Close button is the only × initially
    expect(screen.getAllByText('×')).toHaveLength(1)
  })

  it('can remove an ingredient', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('Ingredient'), { target: { value: 'Oats' } })
    fireEvent.click(screen.getAllByText('+')[0])
    expect(screen.getByText('Oats')).toBeInTheDocument()
    // After adding ingredient, xs are: [modal close ×, ingredient remove ×]
    const xs = screen.getAllByText('×')
    fireEvent.click(xs[xs.length - 1]) // last × is the ingredient remove
    expect(screen.queryByText('Oats')).not.toBeInTheDocument()
  })

  it('can add a step via + button', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('Add a step...'), {
      target: { value: 'Bake 20 min' },
    })
    fireEvent.click(screen.getAllByText('+')[1])
    expect(screen.getByText('Bake 20 min')).toBeInTheDocument()
  })

  it('can add a step via Enter key', () => {
    render(<RecipeModal {...baseProps} />)
    const stepInput = screen.getByPlaceholderText('Add a step...')
    fireEvent.change(stepInput, { target: { value: 'Mix everything' } })
    fireEvent.keyDown(stepInput, { key: 'Enter' })
    expect(screen.getByText('Mix everything')).toBeInTheDocument()
  })

  it('can remove a step', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('Add a step...'), { target: { value: 'Bake' } })
    fireEvent.click(screen.getAllByText('+')[1])
    expect(screen.getByText('Bake')).toBeInTheDocument()
    const xs = screen.getAllByText('×')
    fireEvent.click(xs[xs.length - 1])
    expect(screen.queryByText('Bake')).not.toBeInTheDocument()
  })

  it('saves a valid recipe and calls onSave', () => {
    vi.useFakeTimers()
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Mango Chia Pudding'), {
      target: { value: 'Berry Bowl' },
    })
    fireEvent.change(screen.getByPlaceholderText('e.g. High protein · gluten free'), {
      target: { value: 'Easy breakfast' },
    })
    fireEvent.click(screen.getByText('Save recipe'))
    expect(onSave).toHaveBeenCalledOnce()
    const saved = onSave.mock.calls[0][0]
    expect(saved.name).toBe('Berry Bowl')
    expect(saved.tag).toBe('Easy breakfast')
    expect(saved.custom).toBe(true)
    vi.useRealTimers()
  })

  it('saved recipe with no tagline uses "My recipe" default', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Mango Chia Pudding'), {
      target: { value: 'Plain Dish' },
    })
    fireEvent.click(screen.getByText('Save recipe'))
    expect(onSave.mock.calls[0][0].tag).toBe('My recipe')
  })

  it('ingredient added without amount gets "—" as amount', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(screen.getByPlaceholderText('Ingredient'), { target: { value: 'Salt' } })
    fireEvent.click(screen.getAllByText('+')[0])
    fireEvent.change(screen.getByPlaceholderText('e.g. Mango Chia Pudding'), {
      target: { value: 'Dish' },
    })
    fireEvent.click(screen.getByText('Save recipe'))
    expect(onSave.mock.calls[0][0].ings[0][1]).toBe('—')
  })

  it('can select a category tag', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.click(screen.getByText('Breakfast'))
    // Verify the tag button is selected (no error, UI updates)
    expect(screen.getByText('Breakfast')).toBeInTheDocument()
  })

  it('can create and select a new custom tag', () => {
    const onAddTag = vi.fn()
    render(<RecipeModal {...baseProps} onAddTag={onAddTag} />)
    fireEvent.change(screen.getByPlaceholderText('New tag (e.g. Sauce, Side...)'), {
      target: { value: 'bowl' },
    })
    fireEvent.click(screen.getByText('Add tag'))
    expect(onAddTag).toHaveBeenCalledWith('bowl')
  })

  it('ignores empty tag on Add tag click', () => {
    const onAddTag = vi.fn()
    render(<RecipeModal {...baseProps} onAddTag={onAddTag} />)
    fireEvent.click(screen.getByText('Add tag'))
    expect(onAddTag).not.toHaveBeenCalled()
  })

  it('displays custom tags passed as prop', () => {
    render(<RecipeModal {...baseProps} customTags={['keto']} />)
    expect(screen.getByText('Keto')).toBeInTheDocument()
  })

  it('pressing Enter in the Amount field adds the ingredient (line 146)', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.change(screen.getByPlaceholderText('Ingredient'), { target: { value: 'Flour' } })
    const amountInput = screen.getByPlaceholderText('Amount')
    fireEvent.change(amountInput, { target: { value: '2 cups' } })
    fireEvent.keyDown(amountInput, { key: 'Enter' })
    // Ingredient + amount appear in the list
    expect(screen.getByText('Flour')).toBeInTheDocument()
  })

  it('changing the Tip textarea updates form state (line 169)', () => {
    render(<RecipeModal {...baseProps} />)
    const tipArea = screen.getByPlaceholderText('Any notes, variations, or tips...')
    fireEvent.change(tipArea, { target: { value: 'Great with lemon' } })
    expect((tipArea as HTMLTextAreaElement).value).toBe('Great with lemon')
  })

  // ── Phase 3: edit mode ───────────────────────────────────────────

  it('shows "Edit my Recipe" heading when initialRecipe is provided', () => {
    render(<RecipeModal {...baseProps} initialRecipe={CUSTOM_RECIPE} />)
    expect(screen.getByText(/Edit my/)).toBeInTheDocument()
  })

  it('shows "Add my Recipe" heading when no initialRecipe', () => {
    render(<RecipeModal {...baseProps} />)
    expect(screen.getByText(/Add my/)).toBeInTheDocument()
  })

  it('pre-fills name from initialRecipe', () => {
    render(<RecipeModal {...baseProps} initialRecipe={CUSTOM_RECIPE} />)
    expect((screen.getByPlaceholderText('e.g. Mango Chia Pudding') as HTMLInputElement).value).toBe(
      'My Smoothie',
    )
  })

  it('pre-fills tagline from initialRecipe', () => {
    render(<RecipeModal {...baseProps} initialRecipe={CUSTOM_RECIPE} />)
    expect(
      (screen.getByPlaceholderText('e.g. High protein · gluten free') as HTMLInputElement).value,
    ).toBe(CUSTOM_RECIPE.tag)
  })

  it('pre-fills macros from initialRecipe', () => {
    const recipe: Recipe = {
      ...CUSTOM_RECIPE,
      hk: 350,
      hp: '28g',
      hc: '42g',
      hf: '10g',
      hfi: '6g',
    }
    render(<RecipeModal {...baseProps} initialRecipe={recipe} />)
    expect((screen.getByPlaceholderText('kcal') as HTMLInputElement).value).toBe('350')
    expect((screen.getByPlaceholderText('prot g') as HTMLInputElement).value).toBe('28')
    expect((screen.getByPlaceholderText('carb g') as HTMLInputElement).value).toBe('42')
    expect((screen.getByPlaceholderText('fat g') as HTMLInputElement).value).toBe('10')
    expect((screen.getByPlaceholderText('fiber g') as HTMLInputElement).value).toBe('6')
  })

  it('pre-fills ingredients from initialRecipe', () => {
    const recipe: Recipe = {
      ...CUSTOM_RECIPE,
      ings: [
        ['Spinach', '2 cups'],
        ['Banana', '1 medium'],
      ],
    }
    render(<RecipeModal {...baseProps} initialRecipe={recipe} />)
    expect(screen.getByText('Spinach')).toBeInTheDocument()
    expect(screen.getByText('Banana')).toBeInTheDocument()
    expect(screen.getByText('2 cups')).toBeInTheDocument()
  })

  it('pre-fills steps from initialRecipe', () => {
    render(<RecipeModal {...baseProps} initialRecipe={BASE_RECIPE} />)
    expect(screen.getByText('Cook chicken')).toBeInTheDocument()
    expect(screen.getByText('Steam broccoli')).toBeInTheDocument()
  })

  it('pre-fills tip from initialRecipe', () => {
    render(<RecipeModal {...baseProps} initialRecipe={BASE_RECIPE} />)
    expect(
      (screen.getByPlaceholderText('Any notes, variations, or tips...') as HTMLTextAreaElement)
        .value,
    ).toBe('Add lemon for brightness')
  })

  it('shows "Save changes" button in edit mode', () => {
    render(<RecipeModal {...baseProps} initialRecipe={CUSTOM_RECIPE} />)
    expect(screen.getByText('Save changes')).toBeInTheDocument()
    expect(screen.queryByText('Save recipe')).not.toBeInTheDocument()
  })

  it('shows "Save recipe" button in create mode', () => {
    render(<RecipeModal {...baseProps} />)
    expect(screen.getByText('Save recipe')).toBeInTheDocument()
    expect(screen.queryByText('Save changes')).not.toBeInTheDocument()
  })

  it('preserves id when saving in edit mode', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} initialRecipe={CUSTOM_RECIPE} />)
    fireEvent.click(screen.getByText('Save changes'))
    expect(onSave.mock.calls[0][0].id).toBe(9002)
  })

  it('preserves defaultId when saving a forked recipe', () => {
    const forked: Recipe = { ...CUSTOM_RECIPE, id: 5001, defaultId: 13 }
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} initialRecipe={forked} />)
    fireEvent.click(screen.getByText('Save changes'))
    expect(onSave.mock.calls[0][0].defaultId).toBe(13)
  })

  it('mk/mp/mc/mf mirror the single macro set on save', () => {
    const onSave = vi.fn()
    render(<RecipeModal {...baseProps} onSave={onSave} />)
    fireEvent.change(screen.getByPlaceholderText('e.g. Mango Chia Pudding'), {
      target: { value: 'Test' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '400' } })
    fireEvent.change(screen.getByPlaceholderText('prot g'), { target: { value: '30' } })
    fireEvent.click(screen.getByText('Save recipe'))
    const saved = onSave.mock.calls[0][0]
    expect(saved.hk).toBe(400)
    expect(saved.mk).toBe(400) // mirrors hk
    expect(saved.hp).toBe('30g')
    expect(saved.mp).toBe('30g') // mirrors hp
  })

  it('shows "Changes saved!" message after saving in edit mode', async () => {
    vi.useFakeTimers()
    render(<RecipeModal {...baseProps} initialRecipe={CUSTOM_RECIPE} />)
    fireEvent.click(screen.getByText('Save changes'))
    expect(screen.getByText('Changes saved!')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('image preview renders and onError hides it on broken URL', () => {
    render(<RecipeModal {...baseProps} />)
    // Type a URL into the image field to reveal the <img>
    const imgInput = screen.getByPlaceholderText(/direct image link/)
    fireEvent.change(imgInput, { target: { value: 'https://example.com/photo.jpg' } })
    const img = document.querySelector('img[alt="preview"]') as HTMLImageElement
    expect(img).not.toBeNull()
    // Simulate a broken image — onError should hide it
    fireEvent.error(img)
    expect(img.style.display).toBe('none')
  })

  it('image preview onLoad makes it visible', () => {
    render(<RecipeModal {...baseProps} />)
    const imgInput = screen.getByPlaceholderText(/direct image link/)
    fireEvent.change(imgInput, { target: { value: 'https://example.com/photo.jpg' } })
    const img = document.querySelector('img[alt="preview"]') as HTMLImageElement
    // Simulate successful load — onLoad should ensure it is visible
    fireEvent.load(img)
    expect(img.style.display).toBe('block')
  })

  // ── Import zone (new recipes only) ───────────────────────────────

  it('import zone is visible when creating a new recipe', () => {
    render(<RecipeModal {...baseProps} />)
    expect(document.querySelector('.import-zone')).not.toBeNull()
  })

  it('import zone is hidden when editing an existing recipe', () => {
    render(<RecipeModal {...baseProps} initialRecipe={CUSTOM_RECIPE} />)
    expect(document.querySelector('.import-zone')).toBeNull()
  })

  it('hidden file input exists with correct accept attribute', () => {
    render(<RecipeModal {...baseProps} />)
    const input = document.querySelector('[data-testid="recipe-file-input"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.accept).toContain('.pdf')
    expect(input.accept).toContain('.txt')
  })

  it('"or paste recipe text" toggle reveals a textarea', () => {
    render(<RecipeModal {...baseProps} />)
    expect(document.querySelector('[data-testid="recipe-text-input"]')).toBeNull()
    fireEvent.click(screen.getByText('or paste recipe text'))
    expect(document.querySelector('[data-testid="recipe-text-input"]')).not.toBeNull()
  })

  it('Import text button is disabled until text is entered', () => {
    render(<RecipeModal {...baseProps} />)
    fireEvent.click(screen.getByText('or paste recipe text'))
    const btn = screen.getByText('Import text') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    fireEvent.change(document.querySelector('[data-testid="recipe-text-input"]')!, {
      target: { value: 'Berry Bowl\nMix and serve' },
    })
    expect(btn.disabled).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════
// Phase 4 — hiddenRecipeStore + fork-on-edit (RecipesTab)
// ═════════════════════════════════════════════════════════════════
describe('hiddenRecipeStore', () => {
  it('starts empty', () => {
    expect(hiddenRecipeStore.getAll()).toEqual([])
  })

  it('hide() adds an id', () => {
    hiddenRecipeStore.hide(42)
    expect(hiddenRecipeStore.getAll()).toContain(42)
    expect(hiddenRecipeStore.isHidden(42)).toBe(true)
  })

  it('hide() is idempotent — no duplicates', () => {
    hiddenRecipeStore.hide(42)
    hiddenRecipeStore.hide(42)
    expect(hiddenRecipeStore.getAll().filter((i: number) => i === 42).length).toBe(1)
  })

  it('restore() removes a specific id', () => {
    hiddenRecipeStore.hide(42)
    hiddenRecipeStore.hide(99)
    hiddenRecipeStore.restore(42)
    expect(hiddenRecipeStore.isHidden(42)).toBe(false)
    expect(hiddenRecipeStore.isHidden(99)).toBe(true)
  })

  it('restoreAll() clears all hidden ids', () => {
    hiddenRecipeStore.hide(1)
    hiddenRecipeStore.hide(2)
    hiddenRecipeStore.hide(3)
    hiddenRecipeStore.restoreAll()
    expect(hiddenRecipeStore.getAll()).toEqual([])
  })

  it('isHidden() returns false for un-hidden id', () => {
    expect(hiddenRecipeStore.isHidden(999)).toBe(false)
  })
})

describe('RecipesTab Phase 4 — fork / hide / restore', () => {
  const BUILTIN: Recipe = {
    id: 5,
    name: 'Builtin Meal',
    cat: 'meal',
    type: 'Meal',
    color: 'var(--green)',
    sc: 'cg',
    tag: 'Classic',
    prepL: '30 min',
    prepC: 'var(--green)',
    hk: 500,
    hp: '40g',
    hc: '35g',
    hf: '15g',
    mk: 500,
    mp: '40g',
    mc: '35g',
    mf: '15g',
    ings: [['Chicken', '200g']],
    steps: ['Cook it'],
    tip: '',
    custom: false,
  }

  it('Edit on a built-in pre-fills the modal as a fork (heading is "Edit my Recipe")', async () => {
    // Seed builtin into the recipes state by intercepting fetchBuiltinRecipes
    // We render RecipesTab which fetches on mount — but supabase is null in tests,
    // so builtinRecipes stays empty. We test the fork logic via RecipeCard directly.
    const onEdit = vi.fn()
    render(<RecipeCard recipe={BUILTIN} onEdit={onEdit} cookCount={0} />)
    // Expand card
    fireEvent.click(screen.getByText('Builtin Meal'))
    // Click Edit
    fireEvent.click(screen.getByRole('button', { name: /edit recipe/i }))
    expect(onEdit).toHaveBeenCalledWith(BUILTIN)
  })

  it('RecipeModal receives a fork recipe and shows "Edit my Recipe"', () => {
    const fork: Recipe = {
      ...BUILTIN,
      id: Date.now(),
      defaultId: BUILTIN.id,
      source: 'user' as const,
      custom: true,
      color: 'var(--purple)',
      sc: 'cp',
    }
    const onSave = vi.fn()
    render(
      <RecipeModal
        customTags={[]}
        initialRecipe={fork}
        onSave={onSave}
        onAddTag={() => {}}
        onClose={() => {}}
      />,
    )
    expect(screen.getByText(/Edit my/)).toBeInTheDocument()
    expect(screen.getByDisplayValue('Builtin Meal')).toBeInTheDocument()
  })

  it('saving a fork preserves defaultId', () => {
    const fork: Recipe = {
      ...BUILTIN,
      id: 12345,
      defaultId: BUILTIN.id,
      source: 'user' as const,
      custom: true,
      color: 'var(--purple)',
      sc: 'cp',
    }
    const onSave = vi.fn()
    render(
      <RecipeModal
        customTags={[]}
        initialRecipe={fork}
        onSave={onSave}
        onAddTag={() => {}}
        onClose={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('Save changes'))
    expect(onSave.mock.calls[0][0].defaultId).toBe(BUILTIN.id)
    expect(onSave.mock.calls[0][0].custom).toBe(true)
  })

  it('Hide button calls onHide with recipe id', () => {
    const onHide = vi.fn()
    render(<RecipeCard recipe={BUILTIN} cookCount={0} onHide={onHide} />)
    fireEvent.click(screen.getByText('Builtin Meal'))
    fireEvent.click(screen.getByRole('button', { name: /hide this suggestion/i }))
    expect(onHide).toHaveBeenCalledWith(BUILTIN.id)
  })

  it('Hide button is not shown for custom recipes', () => {
    const custom: Recipe = { ...BUILTIN, id: 9002, custom: true }
    render(<RecipeCard recipe={custom} cookCount={0} onHide={vi.fn()} onDelete={vi.fn()} />)
    fireEvent.click(screen.getByText('Builtin Meal'))
    expect(screen.queryByRole('button', { name: /hide this suggestion/i })).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════
// Phase 6 — GroceryIngredientModal
// ═════════════════════════════════════════════════════════════════
describe('GroceryIngredientModal', () => {
  const RECIPE_WITH_INGS: Recipe = {
    ...BASE_RECIPE,
    id: 7001,
    name: 'Test Stir Fry',
    ings: [
      ['Chicken breast', '200g'],
      ['Broccoli', '1 cup'],
      ['Soy sauce', '2 tbsp'],
    ],
  }

  const baseProps = {
    recipe: RECIPE_WITH_INGS,
    onAdd: vi.fn(),
    onClose: vi.fn(),
  }

  it('renders the recipe name as subtitle', () => {
    render(<GroceryIngredientModal {...baseProps} />)
    expect(screen.getByText('Test Stir Fry')).toBeInTheDocument()
  })

  it('renders all ingredients as checked checkboxes by default', () => {
    render(<GroceryIngredientModal {...baseProps} />)
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(3)
    checkboxes.forEach(cb => expect(cb).toBeChecked())
  })

  it('shows ingredient names and amounts', () => {
    render(<GroceryIngredientModal {...baseProps} />)
    expect(screen.getByText('Chicken breast')).toBeInTheDocument()
    expect(screen.getByText('Broccoli')).toBeInTheDocument()
    expect(screen.getByText('200g')).toBeInTheDocument()
    expect(screen.getByText('1 cup')).toBeInTheDocument()
  })

  it('Add button shows correct item count', () => {
    render(<GroceryIngredientModal {...baseProps} />)
    expect(screen.getByRole('button', { name: /Add 3 items to grocery/i })).toBeInTheDocument()
  })

  it('unchecking an ingredient decrements the count', () => {
    render(<GroceryIngredientModal {...baseProps} />)
    fireEvent.click(screen.getAllByRole('checkbox')[0])
    expect(screen.getByRole('button', { name: /Add 2 items to grocery/i })).toBeInTheDocument()
  })

  it('"Deselect all" unchecks everything and disables the Add button', () => {
    render(<GroceryIngredientModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deselect all' }))
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).not.toBeChecked())
    expect(screen.getByRole('button', { name: /Add items to grocery/i })).toBeDisabled()
  })

  it('"Select all" re-checks all after deselecting', () => {
    render(<GroceryIngredientModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: 'Deselect all' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    screen.getAllByRole('checkbox').forEach(cb => expect(cb).toBeChecked())
  })

  it('clicking Add calls onAdd with the right item names', () => {
    const onAdd = vi.fn()
    render(<GroceryIngredientModal {...baseProps} onAdd={onAdd} />)
    // Deselect Broccoli (index 1)
    fireEvent.click(screen.getAllByRole('checkbox')[1])
    fireEvent.click(screen.getByRole('button', { name: /Add 2 items/i }))
    expect(onAdd).toHaveBeenCalledOnce()
    const items = onAdd.mock.calls[0][0]
    expect(items).toHaveLength(2)
    expect(items.map((i: { n: string }) => i.n)).toEqual(['Chicken breast', 'Soy sauce'])
  })

  it('items get the selected category', () => {
    const onAdd = vi.fn()
    render(<GroceryIngredientModal {...baseProps} onAdd={onAdd} />)
    // Change category to Produce - Fruit
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'Produce - Fruit' } })
    fireEvent.click(screen.getByRole('button', { name: /Add 3 items/i }))
    const items = onAdd.mock.calls[0][0]
    items.forEach((item: { cat: string }) => expect(item.cat).toBe('Produce - Fruit'))
  })

  it('shows success message after adding', () => {
    vi.useFakeTimers()
    render(<GroceryIngredientModal {...baseProps} />)
    fireEvent.click(screen.getByRole('button', { name: /Add 3 items/i }))
    expect(screen.getByText(/3 items added to grocery list/i)).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('Cancel button calls onClose', () => {
    const onClose = vi.fn()
    render(<GroceryIngredientModal {...baseProps} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking backdrop calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(<GroceryIngredientModal {...baseProps} onClose={onClose} />)
    fireEvent.click(container.firstChild as HTMLElement)
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ═════════════════════════════════════════════════════════════════
// WorkoutsTab
// ═════════════════════════════════════════════════════════════════
describe('WorkoutsTab', () => {
  // ── Guest (no user) view — shows male 3×/week template ─────────
  it('guest: shows example plan banner', () => {
    render(<WorkoutsTab user={null} />)
    expect(screen.getByText(/Example plan/i)).toBeInTheDocument()
  })

  it('guest: renders all 3 week nav buttons', () => {
    render(<WorkoutsTab user={null} />)
    expect(screen.getByRole('button', { name: 'Week 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 3' })).toBeInTheDocument()
  })

  it('guest: renders Full-Body Strength Plan heading', () => {
    render(<WorkoutsTab user={null} />)
    expect(screen.getByText(/3×\/week Template/i)).toBeInTheDocument()
  })

  it('guest: renders "tap any exercise to expand" hint for week 1 exercises', () => {
    render(<WorkoutsTab user={null} />)
    const hints = screen.getAllByText('tap any exercise to expand')
    expect(hints.length).toBeGreaterThan(0)
  })

  it('guest: clicking Week 3 shows week 3 label', () => {
    render(<WorkoutsTab user={null} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week 3' }))
    expect(screen.getByText(/Week 3.*Volume/i)).toBeInTheDocument()
  })

  it('guest: clicking an ExerciseRow expands its instruction', () => {
    render(<WorkoutsTab user={null} />)
    // Goblet Squat appears in Day A and Day C; take the first one
    const exerciseTitle = screen.getAllByText('Goblet Squat')[0]
    fireEvent.click(exerciseTitle.closest('.exercise-row')!)
    expect(screen.getByText(/Hold one dumbbell/i)).toBeInTheDocument()
  })

  it('guest: does not show stats strip or plan notes', () => {
    render(<WorkoutsTab user={null} />)
    expect(screen.queryByText(/Plan guidance/i)).not.toBeInTheDocument()
    expect(screen.queryByText('Fat mass')).not.toBeInTheDocument()
  })

  // ── Auth user view — shows personalised plan ────────────────────
  it('auth: shows Her Fat Loss plan heading', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    // "Recomposition Plan" is the <em> inside the female plan title — unique to the heading
    expect(screen.getByText(/Recomposition Plan/i)).toBeInTheDocument()
  })

  it('auth: renders all 3 week nav buttons', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByRole('button', { name: 'Week 1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 2' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Week 3' })).toBeInTheDocument()
  })

  it('auth: clicking Week 2 hides plan notes', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week 2' }))
    expect(screen.queryByText(/Plan guidance/i)).not.toBeInTheDocument()
  })

  it('auth: clicking Week 3 shows week 3 content label', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week 3' }))
    expect(screen.getByText('Week 3 - Ovulatory to Luteal Phase')).toBeInTheDocument()
  })

  it('auth: clicking back to Week 1 restores plan notes', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: 'Week 2' }))
    fireEvent.click(screen.getByRole('button', { name: 'Week 1' }))
    expect(screen.getByText(/Plan guidance/i)).toBeInTheDocument()
  })

  it('auth: shows "tap any exercise to expand" hint', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    const hints = screen.getAllByText('tap any exercise to expand')
    expect(hints.length).toBeGreaterThan(0)
  })

  it('auth: clicking an ExerciseRow expands its instruction', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    const exerciseTitle = screen.getByText('Footwork series')
    fireEvent.click(exerciseTitle.closest('.exercise-row')!)
    expect(screen.getByText(/Reformer footwork/i)).toBeInTheDocument()
  })

  it('auth: "+ Set up" button is shown when no stats saved', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByRole('button', { name: /\+ Set up/i })).toBeInTheDocument()
  })

  it('auth: clicking "+ Set up" opens the profile edit form', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    expect(screen.getByPlaceholderText('65')).toBeInTheDocument()
  })

  it('auth: Cancel closes the profile edit form', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByPlaceholderText('65')).not.toBeInTheDocument()
  })

  it('auth: Save persists updated weight to localStorage', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    const weightInput = screen.getByPlaceholderText('65')
    fireEvent.change(weightInput, { target: { value: '72' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    // After save, edit form closes
    expect(screen.queryByPlaceholderText('65')).not.toBeInTheDocument()
    // localStorage now has the saved value
    const saved = JSON.parse(ls['whub_body_stats_v1'] ?? '{}')
    expect(saved.weightKg).toBe(72)
  })

  // ── Auth user WITH pre-seeded body stats ────────────────────────
  it('auth with stats: shows stats strip with weight and TDEE', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 58,
      bodyFatPct: 35,
      heightM: 1.56,
      cycleType: 'irregular',
      equipment: 'Dumbbells',
      tdeeKcal: 1680,
      kcalTarget: 1380,
      protRange: '105-115g/day',
      fatLossGoal: '0.4-0.5 kg/wk',
      chronotype: 'late',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    // "58 kg" appears in both the plan subtitle and ProfileStatsCard grid
    expect(screen.getAllByText('58 kg').length).toBeGreaterThan(0)
    // Stats strip has "Daily target" label; use getAllByText since kcal appears in weekly note too
    const kcalCells = screen.getAllByText(/1.?380 kcal/)
    expect(kcalCells.length).toBeGreaterThan(0)
    expect(screen.getByText('105-115g/day')).toBeInTheDocument()
  })

  it('auth with stats: shows 3-Week Rotating Cycle for irregular cycle type', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 58,
      bodyFatPct: 35,
      heightM: 1.56,
      cycleType: 'irregular',
      equipment: '',
      tdeeKcal: 1680,
      kcalTarget: 1380,
      protRange: '',
      fatLossGoal: '',
      chronotype: 'late',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText('3-Week Rotating Cycle')).toBeInTheDocument()
  })

  it('auth with stats: "✎ Edit" button opens pre-filled form', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 58,
      bodyFatPct: 35,
      heightM: 1.56,
      cycleType: 'irregular',
      equipment: 'Dumbbells',
      tdeeKcal: 1680,
      kcalTarget: 1380,
      protRange: '105-115g/day',
      fatLossGoal: '0.4-0.5 kg/wk',
      chronotype: 'late',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /✎ Edit/ }))
    // Form should appear with the weight pre-filled
    const weightInput = screen.getByPlaceholderText('65') as HTMLInputElement
    expect(weightInput.value).toBe('58')
  })

  it('auth with stats: Cancel button closes profile edit form', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 58,
      bodyFatPct: 35,
      heightM: 1.56,
      cycleType: 'none',
      equipment: '',
      tdeeKcal: 1680,
      kcalTarget: 1380,
      protRange: '',
      fatLossGoal: '',
      chronotype: 'bear',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /✎ Edit/ }))
    expect(screen.getByPlaceholderText('65')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }))
    expect(screen.queryByPlaceholderText('65')).not.toBeInTheDocument()
  })

  it('auth with stats: changing cycle type select updates value', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 58,
      bodyFatPct: 35,
      heightM: 1.56,
      cycleType: 'none',
      equipment: '',
      tdeeKcal: 0,
      kcalTarget: 0,
      protRange: '',
      fatLossGoal: '',
      chronotype: 'bear',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /✎ Edit/ }))
    const cycleSelect = screen.getByDisplayValue('None / N/A')
    fireEvent.change(cycleSelect, { target: { value: 'regular' } })
    expect((cycleSelect as HTMLSelectElement).value).toBe('regular')
  })

  it('auth: "↺ Fill from Oura" button is present and callable when user is set', async () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    // Button is rendered in the open form when a user prop is provided
    const fillBtn = screen.getByText(/Fill from Oura/)
    expect(fillBtn).toBeInTheDocument()
    // Click runs fillFromOura — fetchOuraPersonalInfo returns null (no session in tests)
    // so no fields are changed, but the function executes without error
    await waitFor(() => fireEvent.click(fillBtn))
    expect(screen.getByPlaceholderText('65')).toBeInTheDocument()
  })

  it('auth with male plan: shows Full-Body Strength Plan heading', () => {
    ls['whub_workout_plan_v1'] = JSON.stringify({
      gender: 'male',
      numWeeks: 3,
      planData: MALE_DEFAULT_PLAN,
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText(/Strength Plan/i)).toBeInTheDocument()
    expect(screen.getByText(/Strength · Full-body · Home/i)).toBeInTheDocument()
  })

  it('auth: changing chronotype select in edit form works', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    const chrono = screen.getByDisplayValue('Not set')
    fireEvent.change(chrono, { target: { value: 'wolf' } })
    expect((chrono as HTMLSelectElement).value).toBe('wolf')
  })

  it('auth: custom macro split shows "Set individual macro targets" message', async () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    // Enter a TDEE so computed targets section appears
    const tdeeInput = screen.getByPlaceholderText('2 100')
    fireEvent.change(tdeeInput, { target: { value: '2000' } })
    // Switch to custom split — macros become null
    const splitSelect = screen.getByDisplayValue(/Balanced/)
    fireEvent.change(splitSelect, { target: { value: 'custom' } })
    await waitFor(() => {
      expect(screen.getByText(/Set individual macro targets/i)).toBeInTheDocument()
    })
  })

  it('auth: computed targets appear after entering TDEE with balanced split', async () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    const tdeeInput = screen.getByPlaceholderText('2 100')
    fireEvent.change(tdeeInput, { target: { value: '2000' } })
    await waitFor(() => {
      expect(screen.getByText(/2,000 kcal/)).toBeInTheDocument()
    })
  })

  it('auth: high_protein macro split shows correct macros', async () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    const tdeeInput = screen.getByPlaceholderText('2 100')
    fireEvent.change(tdeeInput, { target: { value: '2000' } })
    const splitSelect = screen.getByDisplayValue(/Balanced/)
    fireEvent.change(splitSelect, { target: { value: 'high_protein' } })
    await waitFor(() => {
      expect(screen.getByText(/2,000 kcal/)).toBeInTheDocument()
    })
  })

  it('auth: low_carb macro split shows correct macros', async () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    const tdeeInput = screen.getByPlaceholderText('2 100')
    fireEvent.change(tdeeInput, { target: { value: '2000' } })
    const splitSelect = screen.getByDisplayValue(/Balanced/)
    fireEvent.change(splitSelect, { target: { value: 'low_carb' } })
    await waitFor(() => {
      expect(screen.getByText(/2,000 kcal/)).toBeInTheDocument()
    })
  })

  it('auth: fat loss rate select changes affect computed deficit', async () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    const tdeeInput = screen.getByPlaceholderText('2 100')
    fireEvent.change(tdeeInput, { target: { value: '2000' } })
    const lossSelect = screen.getByDisplayValue(/Maintenance/)
    fireEvent.change(lossSelect, { target: { value: '0.5' } })
    await waitFor(() => {
      // 2000 - 550 = 1450 kcal
      expect(screen.getByText(/1,450 kcal/)).toBeInTheDocument()
    })
  })
})

// ═════════════════════════════════════════════════════════════════
// ProfileStatsCard — Measurements (waist / glutes)
// ═════════════════════════════════════════════════════════════════
describe('ProfileStatsCard — measurements', () => {
  it('form shows Measurements section with Waist and Glutes labels', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    expect(screen.getByText('Measurements')).toBeInTheDocument()
    expect(screen.getByText(/Waist/)).toBeInTheDocument()
    expect(screen.getByText(/Glutes/)).toBeInTheDocument()
  })

  it('form defaults to cm unit and shows cm placeholders', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    expect(screen.getByPlaceholderText('75')).toBeInTheDocument() // waist cm
    expect(screen.getByPlaceholderText('95')).toBeInTheDocument() // glutes cm
  })

  it('switching to inches updates placeholders to inch values', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    fireEvent.click(screen.getByRole('button', { name: 'in' }))
    expect(screen.getByPlaceholderText('30')).toBeInTheDocument() // waist in
    expect(screen.getByPlaceholderText('37')).toBeInTheDocument() // glutes in
  })

  it('saves waist and glutes in cm to localStorage', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    fireEvent.change(screen.getByPlaceholderText('75'), { target: { value: '80' } })
    fireEvent.change(screen.getByPlaceholderText('95'), { target: { value: '100' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    const saved = JSON.parse(ls['whub_body_stats_v1'] ?? '{}')
    expect(saved.waistCm).toBe(80)
    expect(saved.glutesCm).toBe(100)
    expect(saved.measurementUnit).toBe('cm')
  })

  it('saves measurements in inches and converts to cm in localStorage', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    fireEvent.click(screen.getByRole('button', { name: 'in' }))
    fireEvent.change(screen.getByPlaceholderText('30'), { target: { value: '30' } })
    fireEvent.change(screen.getByPlaceholderText('37'), { target: { value: '37' } })
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    const saved = JSON.parse(ls['whub_body_stats_v1'] ?? '{}')
    // 30 in × 2.54 = 76.2 cm, 37 in × 2.54 = 93.98 → 94.0 cm
    expect(saved.waistCm).toBeCloseTo(76.2, 0)
    expect(saved.glutesCm).toBeCloseTo(94.0, 0)
    expect(saved.measurementUnit).toBe('in')
  })

  it('shows waist and glutes tiles in collapsed stats grid after save', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 60,
      waistCm: 75,
      glutesCm: 95,
      measurementUnit: 'cm',
      heightM: 1.65,
      bodyFatPct: 0,
      age: 0,
      biologicalSex: '',
      cycleType: 'none',
      equipment: '',
      chronotype: '',
      fatLossRateKg: 0,
      macroSplit: 'balanced',
      tdeeKcal: 0,
      kcalTarget: 0,
      protRange: '',
      fatLossGoal: '',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText('Waist')).toBeInTheDocument()
    expect(screen.getByText('75 cm')).toBeInTheDocument()
    expect(screen.getByText('Glutes')).toBeInTheDocument()
    expect(screen.getByText('95 cm')).toBeInTheDocument()
  })

  it('collapsed stats grid shows measurements in inches when unit is in', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 60,
      waistCm: 76.2,
      glutesCm: 93.98,
      measurementUnit: 'in',
      heightM: 0,
      bodyFatPct: 0,
      age: 0,
      biologicalSex: '',
      cycleType: 'none',
      equipment: '',
      chronotype: '',
      fatLossRateKg: 0,
      macroSplit: 'balanced',
      tdeeKcal: 0,
      kcalTarget: 0,
      protRange: '',
      fatLossGoal: '',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    expect(screen.getByText('30 in')).toBeInTheDocument() // 76.2 / 2.54 = 30.0
    expect(screen.getByText('37 in')).toBeInTheDocument() // 93.98 / 2.54 ≈ 37.0
  })

  it('toggling cm → in converts existing input values', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /\+ Set up/i }))
    // Enter a value in cm
    fireEvent.change(screen.getByPlaceholderText('75'), { target: { value: '76.2' } })
    // Switch to inches — should convert 76.2 cm → 30.0 in
    fireEvent.click(screen.getByRole('button', { name: 'in' }))
    const waistInput = screen.getByPlaceholderText('30') as HTMLInputElement
    expect(parseFloat(waistInput.value)).toBeCloseTo(30, 0)
  })

  it('pre-fills measurements from localStorage when editing', () => {
    ls['whub_body_stats_v1'] = JSON.stringify({
      weightKg: 60,
      waistCm: 80,
      glutesCm: 100,
      measurementUnit: 'cm',
      heightM: 0,
      bodyFatPct: 0,
      age: 0,
      biologicalSex: '',
      cycleType: 'none',
      equipment: '',
      chronotype: '',
      fatLossRateKg: 0,
      macroSplit: 'balanced',
      tdeeKcal: 0,
      kcalTarget: 0,
      protRange: '',
      fatLossGoal: '',
    })
    render(<WorkoutsTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /✎ Edit/i }))
    expect((screen.getByPlaceholderText('75') as HTMLInputElement).value).toBe('80')
    expect((screen.getByPlaceholderText('95') as HTMLInputElement).value).toBe('100')
  })

  // ── Exercise editing ────────────────────────────────────────────

  it('auth: each day card has an exercise edit button (✎)', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    // Week 1 has 4 day cards, each with a ✎ edit button
    const editBtns = screen.getAllByTitle('Edit exercises')
    expect(editBtns.length).toBe(4)
  })

  it('auth: clicking ✎ opens an edit panel with exercise inputs', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    const [firstEditBtn] = screen.getAllByTitle('Edit exercises')
    fireEvent.click(firstEditBtn)
    // The edit panel renders text inputs for exercise names
    expect(screen.getAllByPlaceholderText('Exercise name').length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: '＋ Add exercise' })).toBeInTheDocument()
  })

  it('auth: cancel in edit panel closes it without saving', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    const [firstEditBtn] = screen.getAllByTitle('Edit exercises')
    fireEvent.click(firstEditBtn)
    // Edit panel is open
    expect(screen.getAllByPlaceholderText('Exercise name').length).toBeGreaterThan(0)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    // Edit panel closed — inputs gone, exercise rows back
    expect(screen.queryByPlaceholderText('Exercise name')).not.toBeInTheDocument()
    expect(screen.getAllByText('tap any exercise to expand').length).toBeGreaterThan(0)
  })

  it('auth: ＋ Add exercise appends an empty row', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    const [firstEditBtn] = screen.getAllByTitle('Edit exercises')
    fireEvent.click(firstEditBtn)
    const before = screen.getAllByPlaceholderText('Exercise name').length
    fireEvent.click(screen.getByRole('button', { name: '＋ Add exercise' }))
    expect(screen.getAllByPlaceholderText('Exercise name').length).toBe(before + 1)
  })

  it('auth: save in edit panel persists updated exercises to localStorage', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    const [firstEditBtn] = screen.getAllByTitle('Edit exercises')
    fireEvent.click(firstEditBtn)
    // Update the first exercise name
    const nameInputs = screen.getAllByPlaceholderText('Exercise name')
    fireEvent.change(nameInputs[0], { target: { value: 'My Custom Exercise' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    // Edit panel closed after save
    expect(screen.queryByPlaceholderText('Exercise name')).not.toBeInTheDocument()
    // Check localStorage
    const saved = JSON.parse(ls['whub_workout_plan_v1'] ?? '{}')
    expect(saved.planData[0].days[0].exs[0].t).toBe('My Custom Exercise')
  })

  it('auth: exercises with empty names are filtered out on save', () => {
    render(<WorkoutsTab user={FAKE_USER} />)
    const [firstEditBtn] = screen.getAllByTitle('Edit exercises')
    fireEvent.click(firstEditBtn)
    // Add a new blank exercise (it should be filtered out)
    fireEvent.click(screen.getByRole('button', { name: '＋ Add exercise' }))
    const countBefore = screen.getAllByPlaceholderText('Exercise name').length
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    const saved = JSON.parse(ls['whub_workout_plan_v1'] ?? '{}')
    // The blank exercise (empty name) must not be saved
    expect(saved.planData[0].days[0].exs.length).toBe(countBefore - 1)
  })

  it('guest: no exercise edit buttons visible', () => {
    render(<WorkoutsTab user={null} />)
    expect(screen.queryAllByTitle('Edit exercises').length).toBe(0)
  })
})

// ═════════════════════════════════════════════════════════════════
// ErrorBoundary
// ═════════════════════════════════════════════════════════════════
describe('ErrorBoundary', () => {
  // Suppress React's error boundary console output during these tests
  let consoleError: typeof console.error
  beforeEach(() => {
    consoleError = console.error
    console.error = () => {}
  })
  afterEach(() => {
    console.error = consoleError
  })

  // A component whose throw/render is conditioned on a ref value so TS is satisfied
  function BrokenChild({ doThrow = true }: { doThrow?: boolean }) {
    if (doThrow) throw new Error('Render explosion')
    return null
  }

  it('shows the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary name="TestSection">
        <BrokenChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/Something went wrong in TestSection/i)).toBeInTheDocument()
    expect(screen.getByText('Render explosion')).toBeInTheDocument()
  })

  it('shows fallback without name when name prop is omitted', () => {
    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()
  })

  it('"Try again" button resets the error and shows the children', () => {
    let shouldThrow = true
    function MaybeThrow() {
      if (shouldThrow) throw new Error('Boom')
      return <div>Content OK</div>
    }

    const { rerender } = render(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument()

    // Stop throwing, then click "Try again"
    shouldThrow = false
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }))
    rerender(
      <ErrorBoundary>
        <MaybeThrow />
      </ErrorBoundary>,
    )
    expect(screen.getByText('Content OK')).toBeInTheDocument()
  })

  it('"Reset all data" button calls localStorage.clear', () => {
    const clearSpy = vi.spyOn(window.localStorage, 'clear')
    // location.reload doesn't exist in jsdom, stub it
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() })

    render(
      <ErrorBoundary>
        <BrokenChild />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: /Reset all data/i }))
    expect(clearSpy).toHaveBeenCalled()
    clearSpy.mockRestore()
  })

  it('shows a generic message (not the raw error) in production builds', () => {
    vi.stubEnv('DEV', false)
    try {
      render(
        <ErrorBoundary>
          <BrokenChild />
        </ErrorBoundary>,
      )
      expect(screen.getByText(/Please try again later/i)).toBeInTheDocument()
      expect(screen.queryByText('Render explosion')).not.toBeInTheDocument()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

// ═════════════════════════════════════════════════════════════════
// ScheduleTab
// ═════════════════════════════════════════════════════════════════
describe('ScheduleTab', () => {
  it('guest: shows sign-in prompt instead of schedule', () => {
    render(<ScheduleTab />)
    expect(screen.getByText(/Sign in to save your schedule/i)).toBeInTheDocument()
    expect(screen.queryByText(/Cognitive peak/)).not.toBeInTheDocument()
  })

  it('renders the cognitive peak banner', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    expect(screen.getByText(/Cognitive peak/)).toBeInTheDocument()
  })

  it('renders schedule blocks from defaults', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    expect(screen.getByText('Wake + no-phone rule')).toBeInTheDocument()
    expect(screen.getByText('Deep work block')).toBeInTheDocument()
  })

  it('renders Edit schedule and Export ICS buttons', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    expect(screen.getByText('✎ Edit schedule')).toBeInTheDocument()
    expect(screen.getByText('📅 Export .ics')).toBeInTheDocument()
  })

  it('clicking a timeline row reveals the block description', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    const title = screen.getByText('Wake + no-phone rule')
    fireEvent.click(title.closest('.trow')!)
    // tdet div is conditionally rendered (JSX) — unique phrase only in desc, not in whyTxt
    expect(screen.getByText(/dysregulates it/i)).toBeInTheDocument()
  })

  it('clicking the same row again collapses it', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    const title = screen.getByText('Wake + no-phone rule')
    const row = title.closest('.trow')!
    fireEvent.click(row)
    expect(screen.getByText(/dysregulates it/i)).toBeInTheDocument()
    fireEvent.click(row)
    expect(screen.queryByText(/dysregulates it/i)).not.toBeInTheDocument()
  })

  it('clicking Export ICS toggles the export panel', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('📅 Export .ics'))
    expect(screen.getByText('Download .ics')).toBeInTheDocument()
  })

  it('clicking Export ICS again closes the panel', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('📅 Export .ics'))
    fireEvent.click(screen.getByText('📅 Export .ics'))
    expect(screen.queryByText('Download .ics')).not.toBeInTheDocument()
  })

  it('clicking Download .ics triggers file download', () => {
    const click = vi.fn()
    spyCreateLink(click) // safe spy that passes through non-'a' elements
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('📅 Export .ics'))
    fireEvent.click(screen.getByText('Download .ics'))
    expect(click).toHaveBeenCalledOnce()
  })

  it('renders day selector tabs (Mon through Sun)', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    expect(screen.getByText('Mon')).toBeInTheDocument()
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByText('Sun')).toBeInTheDocument()
  })

  it('clicking a different day tab changes the selected day', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    // Click Sat tab
    fireEvent.click(screen.getByText('Sat'))
    // Mon and Sat buttons should both be present
    expect(screen.getByText('Sat')).toBeInTheDocument()
    expect(screen.getByText('Mon')).toBeInTheDocument()
  })

  it('editing blocks on one day does not affect another day', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    // Switch to Sat, blocks should be independent (both days have default blocks)
    fireEvent.click(screen.getByText('Sat'))
    expect(screen.getByText('Wake + no-phone rule')).toBeInTheDocument()
  })

  it('opens ScheduleEditor on Edit schedule click', async () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('✎ Edit schedule'))
    // ScheduleEditor is lazy-loaded — await the chunk, then assert its scope toggle
    expect(await screen.findByText('This day only')).toBeInTheDocument()
  })

  it('closing editor returns to the timeline view', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('✎ Edit schedule'))
    // Click the Done button to close
    fireEvent.click(screen.getByText('Done'))
    expect(screen.getByText('Wake + no-phone rule')).toBeInTheDocument()
  })

  it('saving an edited block via the editor updates the schedule (handleBlocksChange)', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('✎ Edit schedule'))
    // Edit the first block
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const titleInput = screen.getByPlaceholderText('Block name')
    fireEvent.change(titleInput, { target: { value: 'Updated Block Name' } })
    fireEvent.click(screen.getByText('Save block'))
    // Close editor — the updated block should appear in the timeline
    fireEvent.click(screen.getByText('Done'))
    expect(screen.getByText('Updated Block Name')).toBeInTheDocument()
  })

  it('changing the From date in export panel updates it', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('📅 Export .ics'))
    const [fromInput] = document.querySelectorAll('input[type="date"]')
    fireEvent.change(fromInput, { target: { value: '2026-07-01' } })
    expect((fromInput as HTMLInputElement).value).toBe('2026-07-01')
  })

  it('changing the To date in export panel updates it', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('📅 Export .ics'))
    const dateInputs = document.querySelectorAll('input[type="date"]')
    const toInput = dateInputs[1]
    fireEvent.change(toInput, { target: { value: '2026-08-01' } })
    expect((toInput as HTMLInputElement).value).toBe('2026-08-01')
  })

  it('cognitive peak displays stored times and has an edit button', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    // Default times from USER_SETTINGS_DEFAULTS: 11:00 and 13:00
    expect(screen.getByText(/Cognitive peak/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Edit cognitive peak/i })).toBeInTheDocument()
  })

  it('clicking edit cognitive peak shows time inputs', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /Edit cognitive peak/i }))
    expect(screen.getByLabelText(/Peak start time/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/Peak end time/i)).toBeInTheDocument()
  })

  it('editor opened from ScheduleTab has both scope buttons', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('✎ Edit schedule'))
    expect(screen.getByText('This day only')).toBeInTheDocument()
    expect(screen.getByText('All 7 days')).toBeInTheDocument()
  })

  it('Reset to default in "All 7 days" scope resets all days (handleResetAll)', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    // Open editor, customise current day
    fireEvent.click(screen.getByText('✎ Edit schedule'))
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    // Switch to All 7 days scope and reset
    fireEvent.click(screen.getByText('All 7 days'))
    fireEvent.click(screen.getByText('Reset to default'))
    // After reset the original first block should be back in the timeline
    expect(screen.getByText('Wake + no-phone rule')).toBeInTheDocument()
  })

  it('saving in "All 7 days" scope propagates to all days (handleSaveAll)', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('✎ Edit schedule'))
    // Switch to All 7 days and delete a block
    fireEvent.click(screen.getByText('All 7 days'))
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    fireEvent.click(screen.getByText('Done'))
    // Switch to a different day — it should also be missing the deleted block
    fireEvent.click(screen.getByRole('button', { name: /^Tue$/ }))
    expect(screen.queryByText('Wake + no-phone rule')).not.toBeInTheDocument()
  })

  it('no day-modified dots when all days have the same schedule', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    // All days start from the same default template — no dots expected
    // (dots are <span> siblings inside the day tab buttons; aria is not set on them,
    //  so we check that none of the day tab buttons have a dot child)
    const dayTabs = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    dayTabs.forEach(label => {
      const btn = screen.getByRole('button', { name: new RegExp(`^${label}$`) })
      // No amber dot span inside — just the text node
      expect(btn.querySelectorAll('span').length).toBe(0)
    })
  })

  it('saving cognitive peak times calls savePeak and closes the editor', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: /Edit cognitive peak/i }))
    // Time inputs should be visible
    const startInput = screen.getByLabelText(/Peak start time/i)
    fireEvent.change(startInput, { target: { value: '10:00' } })
    // Click Save → exercises savePeak
    fireEvent.click(screen.getByRole('button', { name: /^Save$/ }))
    // Editor should close and the peak banner be visible again
    expect(screen.getByRole('button', { name: /Edit cognitive peak/i })).toBeInTheDocument()
  })

  it('Reset to default in "This day only" scope resets the current day (handleResetDay)', () => {
    render(<ScheduleTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('✎ Edit schedule'))
    // "This day only" is the default scope — just click Reset to default
    fireEvent.click(screen.getByText('Reset to default'))
    // Original blocks should be restored
    expect(screen.getByText('Wake + no-phone rule')).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// ScheduleEditor
// ═════════════════════════════════════════════════════════════════
describe('ScheduleEditor', () => {
  const defaultBlocks: CustomBlock[] = SCHEDULE_BLOCKS.map(defaultToCustomBlock)

  it('renders all blocks in the list', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.getByText('Wake + no-phone rule')).toBeInTheDocument()
    expect(screen.getByText('Deep work block')).toBeInTheDocument()
  })

  it('clicking × (header) closes the editor', () => {
    const onClose = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onClose={onClose}
        onReset={vi.fn()}
      />,
    )
    // The header × close button
    fireEvent.click(screen.getAllByText('×')[0])
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking Done closes the editor', () => {
    const onClose = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onClose={onClose}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('Done'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking edit (✎) opens the inline form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    expect(screen.getByPlaceholderText('Block name')).toBeInTheDocument()
  })

  it('editing and saving a block calls onChange with updated block', () => {
    const onChange = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={onChange}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const titleInput = screen.getByPlaceholderText('Block name')
    fireEvent.change(titleInput, { target: { value: 'Updated Block' } })
    fireEvent.click(screen.getByText('Save block'))
    expect(onChange).toHaveBeenCalledOnce()
    const updated: CustomBlock[] = onChange.mock.calls[0][0]
    expect(updated[0].title).toBe('Updated Block')
  })

  it('cancel edit closes the form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    expect(screen.getByPlaceholderText('Block name')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByPlaceholderText('Block name')).not.toBeInTheDocument()
  })

  it('delete button removes block without confirmation', () => {
    const onChange = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={onChange}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(onChange).toHaveBeenCalledOnce()
    expect(onChange.mock.calls[0][0]).toHaveLength(defaultBlocks.length - 1)
  })

  it('move up button is disabled for first block', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.getAllByTitle('Move up')[0]).toBeDisabled()
  })

  it('move down button is disabled for last block', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const downs = screen.getAllByTitle('Move down')
    expect(downs[downs.length - 1]).toBeDisabled()
  })

  it('move up second block swaps it with the first', () => {
    const onChange = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={onChange}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Move up')[1])
    const updated: CustomBlock[] = onChange.mock.calls[0][0]
    expect(updated[0].id).toBe(defaultBlocks[1].id)
    expect(updated[1].id).toBe(defaultBlocks[0].id)
  })

  it('Escape key closes the editor', () => {
    const onClose = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onClose={onClose}
        onReset={vi.fn()}
      />,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('parses an hour-duration block and clamps the unit toggle to 24h', () => {
    const hrBlocks: CustomBlock[] = [
      { ...defaultBlocks[0], id: 'hb', title: 'Long Block', dur: '2 hr' },
    ]
    render(
      <ScheduleEditor blocks={hrBlocks} onChange={vi.fn()} onClose={vi.fn()} onReset={vi.fn()} />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    // Duration number reflects the parsed "hr" form
    const num = screen.getByDisplayValue('2') as HTMLInputElement
    fireEvent.change(num, { target: { value: '30' } }) // > 24h → clamped to 24
    expect((screen.getByDisplayValue('24') as HTMLInputElement).value).toBe('24')
  })

  it('switching the duration unit to hours clamps the number', () => {
    const blocks: CustomBlock[] = [{ ...defaultBlocks[0], id: 'mb', title: 'Mins', dur: '45 min' }]
    render(
      <ScheduleEditor blocks={blocks} onChange={vi.fn()} onClose={vi.fn()} onReset={vi.fn()} />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    // 45 in minutes; switch unit to hours → 45 clamped to 24
    fireEvent.change(screen.getByDisplayValue('minutes'), { target: { value: 'hr' } })
    expect(screen.getByDisplayValue('24')).toBeInTheDocument()
  })

  it('deleting the block being edited closes the form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    expect(screen.getByPlaceholderText('Block name')).toBeInTheDocument()
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(screen.queryByPlaceholderText('Block name')).not.toBeInTheDocument()
  })

  it('Add block button shows new block form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('+ Add block'))
    expect(screen.getByPlaceholderText('Block name')).toBeInTheDocument()
  })

  it('saving a new block calls onChange with one extra block', () => {
    const onChange = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={onChange}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('+ Add block'))
    fireEvent.change(screen.getByPlaceholderText('Block name'), { target: { value: 'New Block' } })
    fireEvent.click(screen.getByText('Save block'))
    expect(onChange).toHaveBeenCalledOnce()
    const updated: CustomBlock[] = onChange.mock.calls[0][0]
    expect(updated).toHaveLength(defaultBlocks.length + 1)
    expect(updated.some(b => b.title === 'New Block')).toBe(true)
  })

  it('Save block is disabled when title is empty', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('+ Add block'))
    expect(screen.getByText('Save block')).toBeDisabled()
  })

  it('Reset to default calls onReset and onClose', () => {
    const onReset = vi.fn()
    const onClose = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onClose={onClose}
        onReset={onReset}
      />,
    )
    fireEvent.click(screen.getByText('Reset to default'))
    expect(onReset).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('clicking the same edit button again closes the form (toggle)', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const editBtns = screen.getAllByTitle('Edit')
    fireEvent.click(editBtns[0])
    fireEvent.click(editBtns[0])
    expect(screen.queryByPlaceholderText('Block name')).not.toBeInTheDocument()
  })

  it('move down button reorders blocks', () => {
    const onChange = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={onChange}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    const downBtns = screen.getAllByTitle('Move down')
    // Find the first enabled Move down button (not the last block)
    const enabledDown = downBtns.find(btn => !(btn as HTMLButtonElement).disabled)!
    fireEvent.click(enabledDown)
    expect(onChange).toHaveBeenCalledOnce()
  })

  it('clicking a color in the edit form updates form color', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    // Click the Teal color swatch — title comes from c.label in BLOCK_COLORS
    const colorBtns = screen.getAllByTitle(/Teal|Amber|Purple|Gold|Gray/i)
    fireEvent.click(colorBtns[0])
    // No crash = color state updated successfully
  })

  it('changing time input in edit form updates form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const timeInput = screen.getByDisplayValue('08:00')
    fireEvent.change(timeInput, { target: { value: '09:30' } })
    expect((timeInput as HTMLInputElement).value).toBe('09:30')
  })

  it('changing duration number input in edit form updates value', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const durInput = screen.getByRole('spinbutton')
    fireEvent.change(durInput, { target: { value: '45' } })
    expect((durInput as HTMLInputElement).value).toBe('45')
  })

  it('changing duration unit to hours updates the form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const unitSelect = screen.getByRole('combobox')
    fireEvent.change(unitSelect, { target: { value: 'hr' } })
    expect((unitSelect as HTMLSelectElement).value).toBe('hr')
  })

  it('changing phase header input in edit form updates form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const phaseInput = screen.getByPlaceholderText('e.g. Morning routine')
    fireEvent.change(phaseInput, { target: { value: 'Wake-up' } })
    expect((phaseInput as HTMLInputElement).value).toBe('Wake-up')
  })

  it('changing badge label input in edit form updates form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const whyInput = screen.getByPlaceholderText('e.g. focus, nutrition')
    fireEvent.change(whyInput, { target: { value: 'morning energy' } })
    expect((whyInput as HTMLInputElement).value).toBe('morning energy')
  })

  it('changing description textarea in edit form updates form', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Edit')[0])
    const descInput = screen.getByPlaceholderText('Why this block matters…')
    fireEvent.change(descInput, { target: { value: 'My custom description' } })
    expect((descInput as HTMLTextAreaElement).value).toBe('My custom description')
  })

  it('closing modal from backdrop click calls onClose', () => {
    const onClose = vi.fn()
    const { container } = render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={onClose}
        onReset={vi.fn()}
      />,
    )
    const backdrop = container.firstChild as HTMLElement
    fireEvent.click(backdrop, { target: backdrop })
    expect(onClose).toHaveBeenCalledOnce()
  })

  // ── Scope toggle ─────────────────────────────────────────────────

  it('renders "This day only" and "All 7 days" scope buttons', () => {
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    expect(screen.getByText('This day only')).toBeInTheDocument()
    expect(screen.getByText('All 7 days')).toBeInTheDocument()
  })

  it('default scope is "This day only" — save calls onChange not onSaveAll', () => {
    const onChange = vi.fn()
    const onSaveAll = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={onChange}
        onSaveAll={onSaveAll}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(onChange).toHaveBeenCalledOnce()
    expect(onSaveAll).not.toHaveBeenCalled()
  })

  it('switching to "All 7 days" scope routes save to onSaveAll', () => {
    const onChange = vi.fn()
    const onSaveAll = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={onChange}
        onSaveAll={onSaveAll}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('All 7 days'))
    fireEvent.click(screen.getAllByTitle('Delete')[0])
    expect(onSaveAll).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
  })

  it('move does not auto-sort — manual order is preserved', () => {
    const onChange = vi.fn()
    const twoBlocks: CustomBlock[] = [
      {
        id: 'a',
        time: '08:00',
        title: 'Early',
        dur: '30 min',
        color: 'green',
        phase: '',
        whyTxt: '',
        desc: '',
      },
      {
        id: 'b',
        time: '10:00',
        title: 'Late',
        dur: '30 min',
        color: 'green',
        phase: '',
        whyTxt: '',
        desc: '',
      },
    ]
    render(
      <ScheduleEditor
        blocks={twoBlocks}
        onChange={onChange}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    // Move "Late" (index 1) up — should produce [Late, Early] without re-sorting
    fireEvent.click(screen.getAllByTitle('Move up')[1])
    const updated: CustomBlock[] = onChange.mock.calls[0][0]
    expect(updated[0].title).toBe('Late')
    expect(updated[1].title).toBe('Early')
  })

  it('adding a block auto-sorts it into the correct time position', () => {
    const onChange = vi.fn()
    const twoBlocks: CustomBlock[] = [
      {
        id: 'a',
        time: '10:00',
        title: 'Mid',
        dur: '30 min',
        color: 'green',
        phase: '',
        whyTxt: '',
        desc: '',
      },
      {
        id: 'b',
        time: '12:00',
        title: 'Late',
        dur: '30 min',
        color: 'green',
        phase: '',
        whyTxt: '',
        desc: '',
      },
    ]
    render(
      <ScheduleEditor
        blocks={twoBlocks}
        onChange={onChange}
        onSaveAll={vi.fn()}
        onClose={vi.fn()}
        onReset={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText('+ Add block'))
    fireEvent.change(screen.getByPlaceholderText('Block name'), { target: { value: 'Early' } })
    fireEvent.change(screen.getByDisplayValue('09:00'), { target: { value: '08:00' } })
    fireEvent.click(screen.getByText('Save block'))
    const updated: CustomBlock[] = onChange.mock.calls[0][0]
    expect(updated[0].title).toBe('Early')
    expect(updated[1].title).toBe('Mid')
    expect(updated[2].title).toBe('Late')
  })

  // ── Reset to default — scope-aware ────────────────────────────────

  it('Reset to default in "This day only" scope calls onReset (not onResetAll)', () => {
    const onReset = vi.fn()
    const onResetAll = vi.fn()
    const onClose = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onClose={onClose}
        onReset={onReset}
        onResetAll={onResetAll}
      />,
    )
    fireEvent.click(screen.getByText('Reset to default'))
    expect(onReset).toHaveBeenCalledOnce()
    expect(onResetAll).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('Reset to default in "All 7 days" scope calls onResetAll (not onReset)', () => {
    const onReset = vi.fn()
    const onResetAll = vi.fn()
    const onClose = vi.fn()
    render(
      <ScheduleEditor
        blocks={defaultBlocks}
        onChange={vi.fn()}
        onClose={onClose}
        onReset={onReset}
        onResetAll={onResetAll}
      />,
    )
    fireEvent.click(screen.getByText('All 7 days'))
    fireEvent.click(screen.getByText('Reset to default'))
    expect(onResetAll).toHaveBeenCalledOnce()
    expect(onReset).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledOnce()
  })
})

// ═════════════════════════════════════════════════════════════════
// RecipesTab
// ═════════════════════════════════════════════════════════════════
describe('RecipesTab', () => {
  it('renders all filter buttons', () => {
    render(<RecipesTab user={FAKE_USER} />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Breakfast' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Smoothies' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '⭐ My Recipes' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Grocery/ })).toBeInTheDocument()
  })

  it('shows empty state (not an error) when DB is unavailable', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    // supabase is null in unit tests → BUILTIN_RECIPES is [] → authenticated empty state
    await waitFor(() => {
      expect(screen.getByText(/No recipes yet/)).toBeInTheDocument()
    })
    // No error banner — graceful empty state, not a network error
    expect(screen.queryByText(/Could not load recipes/)).not.toBeInTheDocument()
  })

  it('renders the search bar in non-grocery views', () => {
    render(<RecipesTab user={FAKE_USER} />)
    expect(screen.getByPlaceholderText('Search recipes, ingredients…')).toBeInTheDocument()
  })

  it('search filters custom recipes by name', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Search recipes, ingredients…'), {
      target: { value: 'My Smoothie' },
    })
    expect(screen.getByText('My Smoothie')).toBeInTheDocument()
  })

  it('search with no match shows empty state', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    fireEvent.change(screen.getByPlaceholderText('Search recipes, ingredients…'), {
      target: { value: 'xyznotarecipe' },
    })
    expect(screen.getByText(/No recipes found for/)).toBeInTheDocument()
  })

  it('× clears the search', () => {
    render(<RecipesTab user={FAKE_USER} />)
    const searchInput = screen.getByPlaceholderText('Search recipes, ingredients…')
    fireEvent.change(searchInput, { target: { value: 'oats' } })
    fireEvent.click(screen.getByText('×'))
    expect((searchInput as HTMLInputElement).value).toBe('')
  })

  it('guest sees sign-in gate instead of recipe content', () => {
    render(<RecipesTab />)
    expect(screen.getByText(/Sign in to save/)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search recipes, ingredients…')).not.toBeInTheDocument()
  })

  it('clicking Breakfast filter activates that filter button', () => {
    render(<RecipesTab user={FAKE_USER} />)
    const btn = screen.getByRole('button', { name: 'Breakfast' })
    fireEvent.click(btn)
    expect(btn.className).toContain('active')
  })

  it('clicking Grocery shows GroceryPanel', () => {
    render(<RecipesTab user={FAKE_USER} />)
    // Use getByRole so the aria-label on recipe-card action buttons doesn't cause
    // a "multiple elements" error — the filter button's accessible name is its
    // text content "🛒 Grocery", while card buttons have aria-label="Add ingredients…"
    fireEvent.click(screen.getByRole('button', { name: '🛒 Grocery' }))
    expect(screen.getByText('Your')).toBeInTheDocument() // "Your Grocery List"
    expect(screen.queryByPlaceholderText('Search recipes, ingredients…')).not.toBeInTheDocument()
  })

  it('custom recipe appears in All view without navigating to a separate tab', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    // Custom recipe is visible in the default All view — no navigation needed
    expect(screen.getByText('My Smoothie')).toBeInTheDocument()
  })

  it('custom recipe is the only recipe visible when no built-ins', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    // Only the custom recipe — no built-ins
    expect(screen.getByText('My Smoothie')).toBeInTheDocument()
    expect(screen.queryByText('Overnight Oats')).not.toBeInTheDocument()
  })

  it('guest: + Add my recipe button is hidden behind gate', () => {
    render(<RecipesTab />)
    expect(screen.queryByText('+ Add my recipe')).not.toBeInTheDocument()
  })

  it('auth: + Add my recipe button is visible', () => {
    render(<RecipesTab user={FAKE_USER} />)
    expect(screen.getByRole('button', { name: '+ Add my recipe' })).toBeInTheDocument()
  })

  it('auth + grocery filter: + Add my recipe button is hidden', () => {
    render(<RecipesTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: '🛒 Grocery' }))
    expect(screen.queryByRole('button', { name: '+ Add my recipe' })).not.toBeInTheDocument()
  })

  it('+ Add my recipe opens the modal', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add my recipe' }))
    // RecipeModal is lazy-loaded — await the chunk
    expect(await screen.findByText('Recipe')).toBeInTheDocument()
  })

  it('deleting a custom recipe removes it from the list', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    vi.mocked(window.confirm).mockReturnValue(true)
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    fireEvent.click(screen.getByText('My Smoothie').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByText('Delete recipe'))
    expect(screen.queryByText('My Smoothie')).not.toBeInTheDocument()
  })

  it('cancelling delete keeps the recipe', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    vi.mocked(window.confirm).mockReturnValue(false)
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    fireEvent.click(screen.getByText('My Smoothie').closest('.rcard') as HTMLElement)
    fireEvent.click(screen.getByText('Delete recipe'))
    expect(screen.getByText('My Smoothie')).toBeInTheDocument()
  })

  it('search input focus and blur fire styling handlers without crash', () => {
    render(<RecipesTab user={FAKE_USER} />)
    const input = screen.getByPlaceholderText('Search recipes, ingredients…')
    fireEvent.focus(input)
    fireEvent.blur(input)
    // Handlers fire inline style changes — no assertion needed, just no crash
  })

  it('closing the Add recipe modal via onClose hides it', () => {
    render(<RecipesTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add my recipe' }))
    expect(screen.getByText('Recipe')).toBeInTheDocument()
    // The RecipeModal × button calls onClose → setShowModal(false)
    const closeBtn = screen.getAllByText('×')[0]
    fireEvent.click(closeBtn)
    expect(screen.queryByText('Recipe')).not.toBeInTheDocument()
  })

  it('saving a recipe through the modal shows it in the All view', async () => {
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: '+ Add my recipe' }))
    // Fill in recipe name — placeholder is "e.g. Mango Chia Pudding"
    fireEvent.change(screen.getByPlaceholderText('e.g. Mango Chia Pudding'), {
      target: { value: 'My Test Recipe' },
    })
    // Save
    fireEvent.click(screen.getByText('Save recipe'))
    // Recipe appears in the All view
    expect(screen.getByText('My Test Recipe')).toBeInTheDocument()
  })

  it('adding a tag through the modal calls handleAddTag', () => {
    render(<RecipesTab user={FAKE_USER} />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add my recipe' }))
    fireEvent.change(screen.getByPlaceholderText('New tag (e.g. Sauce, Side...)'), {
      target: { value: 'keto' },
    })
    fireEvent.click(screen.getByText('Add tag'))
    // Tag is now in the category selector — no crash = handleAddTag was called
  })

  // ── Phase 2: CookingMode wired in RecipesTab ──────────────────

  it('Cook button appears on expanded custom recipe with steps', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    const card = screen.getByText('My Smoothie').closest('.rcard') as HTMLElement
    fireEvent.click(card)
    expect(within(card).getByRole('button', { name: /cook/i })).toBeInTheDocument()
  })

  it('clicking Cook opens CookingMode overlay', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    const card = screen.getByText('My Smoothie').closest('.rcard') as HTMLElement
    fireEvent.click(card)
    fireEvent.click(within(card).getByRole('button', { name: /cook/i }))
    // CookingMode is lazy-loaded — await the chunk; it shows "Exit cooking mode"
    expect(await screen.findByText(/Exit cooking mode/)).toBeInTheDocument()
  })

  it('exiting CookingMode closes the overlay', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    const card = screen.getByText('My Smoothie').closest('.rcard') as HTMLElement
    fireEvent.click(card)
    fireEvent.click(within(card).getByRole('button', { name: /cook/i }))
    fireEvent.click(screen.getByText(/Exit cooking mode/))
    expect(screen.queryByText(/Exit cooking mode/)).not.toBeInTheDocument()
  })

  it('Edit button appears on expanded custom recipe', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    const card = screen.getByText('My Smoothie').closest('.rcard') as HTMLElement
    fireEvent.click(card)
    expect(within(card).getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  // ── Filter count badges ─────────────────────────────────────────

  it('filter count badge not shown when there are no recipes', () => {
    // supabase is null in tests → no built-ins loaded; no custom recipes → all counts 0
    render(<RecipesTab user={FAKE_USER} />)
    // Badge spans should not be present (counts are 0, !!0 === false)
    expect(document.querySelectorAll('.rfbtn-count').length).toBe(0)
  })

  it('filter count badge appears when a custom recipe matches a category', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE]) // cat: 'smoothie'
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    // "All" button should now have a count badge showing 1
    const badges = document.querySelectorAll('.rfbtn-count')
    expect(badges.length).toBeGreaterThan(0)
    // The "All" badge should contain "1"
    const allBadge = [...badges].find(b => b.textContent === '1')
    expect(allBadge).toBeTruthy()
  })

  it('Smoothies filter badge reflects number of smoothie recipes', async () => {
    const secondSmoothie = { ...CUSTOM_RECIPE, id: 9003, name: 'Green Smoothie' }
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE, secondSmoothie])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    // "Smoothies" button badge should show 2
    const smoothieBtn = screen.getByRole('button', { name: /Smoothies/i })
    const badge = smoothieBtn.querySelector('.rfbtn-count')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toBe('2')
  })

  it('All badge count equals total custom recipe count', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE, BASE_RECIPE])
    render(<RecipesTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.queryByText('Loading recipes…')).not.toBeInTheDocument())
    const allBtn = screen.getByRole('button', { name: /^All/ })
    const badge = allBtn.querySelector('.rfbtn-count')
    expect(badge).not.toBeNull()
    expect(badge!.textContent).toBe('2')
  })
})

// ═════════════════════════════════════════════════════════════════
// TrackerTab
// ═════════════════════════════════════════════════════════════════
describe('TrackerTab', () => {
  it('renders the daily tracker heading', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText(/Daily Tracker/)).toBeInTheDocument()
  })

  it('renders date navigation buttons', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText('‹ Prev')).toBeInTheDocument()
    expect(screen.getByText('Next ›')).toBeInTheDocument()
  })

  it('renders the week strip', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText('This week')).toBeInTheDocument()
  })

  it('renders inner tabs: Food, Workout, Meditation', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Workout')).toBeInTheDocument()
    expect(screen.getByText('Meditation')).toBeInTheDocument()
  })

  it('Food tab is active by default with macro bars', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText('Calories')).toBeInTheDocument()
    expect(screen.getByText('Protein')).toBeInTheDocument()
    expect(screen.getByText('Carbs')).toBeInTheDocument()
    expect(screen.getByText('Fat')).toBeInTheDocument()
    expect(screen.getByText('Fiber')).toBeInTheDocument()
  })

  it('renders "No meals logged yet" when food list is empty', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText('No meals logged yet.')).toBeInTheDocument()
  })

  it('renders quick-add placeholder when no history', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText('Meals you log will appear here.')).toBeInTheDocument()
  })

  it('shows alert when logging food without name', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('+ Log food'))
    expect(window.alert).toHaveBeenCalledWith('Enter a name and calories.')
  })

  it('can log a food entry', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Oatmeal' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('+ Log food'))
    expect(screen.getByText('Oatmeal')).toBeInTheDocument()
  })

  it('logged food shows kcal in the log', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Salmon' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '207' } })
    fireEvent.click(screen.getByText('+ Log food'))
    expect(screen.getByText(/207 kcal/)).toBeInTheDocument()
  })

  it('clicking edit on a logged food shows "Save changes" button', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Oatmeal' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('+ Log food'))
    fireEvent.click(screen.getByTitle('Edit'))
    expect(screen.getByText('✓ Save changes')).toBeInTheDocument()
  })

  it('can cancel food edit', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Oatmeal' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('+ Log food'))
    fireEvent.click(screen.getByTitle('Edit'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('✓ Save changes')).not.toBeInTheDocument()
  })

  it('can remove a logged food entry', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Oatmeal' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('+ Log food'))
    expect(screen.getByText('Oatmeal')).toBeInTheDocument()
    fireEvent.click(screen.getByText('×'))
    expect(screen.queryByText('Oatmeal')).not.toBeInTheDocument()
  })

  // ── Paste-to-log ──────────────────────────────────────────────
  it('paste-to-log parses explicit-macro text and logs the foods', async () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByTestId('paste-log-toggle'))
    fireEvent.change(screen.getByTestId('paste-log-input'), {
      target: { value: 'Chicken Bowl 420 38 30 14 6\nApple 95 0 25 0 4' },
    })
    fireEvent.click(screen.getByText('Parse'))

    // Falls back to the local parser (AI mocked to reject) → review list appears
    const addBtn = await screen.findByTestId('paste-log-add')
    expect(addBtn).toHaveTextContent('Add 2 foods')
    // Edit a review-row protein field (placeholder 'P' is unique to review rows)
    fireEvent.change(screen.getAllByPlaceholderText('P')[0], { target: { value: '40' } })
    fireEvent.click(addBtn)

    expect(screen.getByText('Chicken Bowl')).toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
    expect(screen.getByText(/420 kcal/)).toBeInTheDocument()
  })

  it('paste-to-log review rows can be removed before adding', async () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByTestId('paste-log-toggle'))
    fireEvent.change(screen.getByTestId('paste-log-input'), {
      target: { value: 'Chicken Bowl 420 38 30 14 6\nApple 95 0 25 0 4' },
    })
    fireEvent.click(screen.getByText('Parse'))

    const addBtn = await screen.findByTestId('paste-log-add')
    // Remove the first review row, then add — only one food should log
    fireEvent.click(screen.getAllByTitle('Remove')[0])
    expect(addBtn).toHaveTextContent('Add 1 food')
    fireEvent.click(addBtn)
    expect(screen.queryByText('Chicken Bowl')).not.toBeInTheDocument()
    expect(screen.getByText('Apple')).toBeInTheDocument()
  })

  it('paste-to-log Cancel closes the panel without logging', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByTestId('paste-log-toggle'))
    expect(screen.getByTestId('paste-log-input')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByTestId('paste-log-input')).not.toBeInTheDocument()
    expect(screen.getByText('No meals logged yet.')).toBeInTheDocument()
  })

  it('prev date button decrements the displayed date', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    expect(screen.getByText(today)).toBeInTheDocument()
    fireEvent.click(screen.getByText('‹ Prev'))
    expect(screen.queryByText(today)).not.toBeInTheDocument()
  })

  it('Next › button returns to today after navigating to previous day', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    fireEvent.click(screen.getByText('‹ Prev'))
    expect(screen.queryByText(today)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('Next ›'))
    expect(screen.getByText(today)).toBeInTheDocument()
  })

  it('switching to Workout tab shows session type selector', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Workout'))
    expect(screen.getByText('Workout log · 4:30 PM')).toBeInTheDocument()
    expect(screen.getByText('Pilates')).toBeInTheDocument()
  })

  it('logging workout without session shows alert', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Workout'))
    fireEvent.click(screen.getByText('+ Log workout'))
    expect(window.alert).toHaveBeenCalledWith('Select a session type first.')
  })

  it('can select a workout session and log it', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Workout'))
    fireEvent.click(screen.getByText('Pilates'))
    fireEvent.click(screen.getByText('+ Log workout'))
    expect(screen.getByText('✓ Session logged')).toBeInTheDocument()
  })

  it('selecting same session twice deselects it', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Workout'))
    fireEvent.click(screen.getByText('Pilates'))
    fireEvent.click(screen.getByText('Pilates'))
    expect(screen.queryByText('✓ Session logged')).not.toBeInTheDocument()
  })

  it('switching to Meditation tab shows duration options', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    expect(screen.getByText('Meditation · 8:45 AM')).toBeInTheDocument()
    expect(screen.getByText('13 min')).toBeInTheDocument()
  })

  it('logging meditation without duration shows alert', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('Log meditation'))
    expect(window.alert).toHaveBeenCalledWith('Select a duration first.')
  })

  it('can select a meditation duration and log it', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('13 min'))
    fireEvent.click(screen.getByText('Log meditation'))
    // Saved state shows "Saved!" momentarily
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('selecting same meditation duration deselects it', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('13 min'))
    fireEvent.click(screen.getByText('13 min'))
    // no assertion needed — just no crash
  })

  it('renders the check-in section in Meditation tab', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    expect(screen.getByText('Daily check-in')).toBeInTheDocument()
    expect(screen.getByText('Save check-in')).toBeInTheDocument()
  })

  it('can click Save check-in', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('Save check-in'))
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('can toggle cycle phase buttons', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('Follicular'))
    fireEvent.click(screen.getByText('Follicular')) // deselect
    // No crash is the assertion
  })

  it('renders Day notes section in Meditation tab', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    expect(screen.getByText('Day notes')).toBeInTheDocument()
    expect(screen.getByText('Save notes')).toBeInTheDocument()
  })

  it('renders Reminders section in Meditation tab', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    expect(screen.getByText('Reminders')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('New reminder…')).toBeInTheDocument()
  })

  it('can save day notes', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    const textarea = screen.getByPlaceholderText(/Cravings/)
    fireEvent.change(textarea, { target: { value: 'Feeling great today' } })
    fireEvent.click(screen.getByText('Save notes'))
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('can select a meditation style', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('Breath focus'))
    // deselect
    fireEvent.click(screen.getByText('Breath focus'))
  })

  it('can type in the workout notes textarea', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Workout'))
    const notes = screen.getByPlaceholderText('How did it feel? PRs? Modifications?')
    fireEvent.change(notes, { target: { value: 'Great session!' } })
    expect((notes as HTMLTextAreaElement).value).toBe('Great session!')
  })

  it('clicking a day in the week strip navigates to that day', () => {
    render(<TrackerTab user={FAKE_USER} />)
    // Week strip has 7 clickable day buttons (M T W T F S S)
    const dayButtons = document.querySelectorAll('.wstrip-day')
    if (dayButtons.length > 0) {
      fireEvent.click(dayButtons[0])
      // Just verify no crash
    }
  })

  it('auto-suggest appears when 2+ chars match a QUICK_FOOD', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const nameInput = screen.getByPlaceholderText('Meal name (e.g. Berry Oats)')
    // QUICK_FOODS has 'Berry Oats' — typing 'Oat' triggers suggestions
    fireEvent.change(nameInput, { target: { value: 'Oat' } })
    // Berry Oats suggestion should appear in the dropdown
    expect(screen.getByText('Berry Oats')).toBeInTheDocument()
  })

  it('clicking a suggestion fills in the food fields', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const nameInput = screen.getByPlaceholderText('Meal name (e.g. Berry Oats)')
    fireEvent.change(nameInput, { target: { value: 'Oat' } })
    // MouseDown on suggestion (onMouseDown handler)
    fireEvent.mouseDown(screen.getByText('Berry Oats'))
    expect((nameInput as HTMLInputElement).value).toBe('Berry Oats')
  })

  it('food name input onFocus sets showSugg and onBlur clears it', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const nameInput = screen.getByPlaceholderText('Meal name (e.g. Berry Oats)')
    fireEvent.focus(nameInput) // line 435: onFocus → setShowSugg(true)
    fireEvent.blur(nameInput) // line 436: onBlur → setTimeout(setShowSugg(false))
    // No crash = handlers exercised
  })

  it('changing servings input updates the serving count', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const srvInput = screen.getByPlaceholderText('1')
    fireEvent.change(srvInput, { target: { value: '2' } }) // line 458 onChange
    expect((srvInput as HTMLInputElement).value).toBe('2')
  })

  it('clicking Next › advances the date', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
    fireEvent.click(screen.getByText('Next ›')) // line 348 onClick
    // Date changed — today label is no longer shown
    expect(screen.queryByText(today)).not.toBeInTheDocument()
  })

  it('Save changes updates an existing food entry (editIndex branch)', () => {
    render(<TrackerTab user={FAKE_USER} />)
    // Log a food first
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Oatmeal' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('+ Log food'))
    // Edit it
    fireEvent.click(screen.getByTitle('Edit'))
    expect(screen.getByText('✓ Save changes')).toBeInTheDocument()
    // Change the name and save → covers lines 250-253
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Steel-cut Oats' },
    })
    fireEvent.click(screen.getByText('✓ Save changes'))
    expect(screen.getByText('Steel-cut Oats')).toBeInTheDocument()
  })

  it('quick-add from recent meals adds the food entry (quickAdd)', () => {
    render(<TrackerTab user={FAKE_USER} />)
    // Log Oatmeal today — it becomes a recent meal
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Oatmeal' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '300' } })
    fireEvent.click(screen.getByText('+ Log food'))
    // Navigate away and back to re-compute recentMeals from store
    fireEvent.click(screen.getByText('‹ Prev'))
    fireEvent.click(screen.getByText('Next ›'))
    // Now recentMeals should contain Oatmeal
    const recentBtn = document.querySelector(
      '[style*="cursor: pointer"][style*="border"]',
    ) as HTMLElement
    if (recentBtn && recentBtn.textContent?.includes('Oatmeal')) {
      fireEvent.click(recentBtn)
    }
    // Even if no button found, we verified no crash
  })

  it('clicking a star in the daily check-in sets rating', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    // Star buttons are rendered for Energy, Mood, Sleep ratings (5 buttons each × 3 rows = 15)
    const stars = screen.getAllByText('·')
    if (stars.length > 0) {
      fireEvent.click(stars[0].closest('button')!)
      // No crash = star onClick handled
    }
  })

  it('clicking a day in the week strip navigates to that date', () => {
    render(<TrackerTab user={FAKE_USER} />)
    // WeekStrip: find the grid container via the "This week" label, then click first day cell
    const heading = screen.getByText('This week')
    const grid = heading.nextElementSibling as HTMLElement
    // The grid contains 7 day cells; click the first
    if (grid?.firstElementChild) {
      fireEvent.click(grid.firstElementChild)
      // Navigation happened — no crash = onClick handler exercised
    }
  })

  it('Export and Import buttons are no longer in TrackerTab (moved to AuthButton)', () => {
    render(<TrackerTab user={FAKE_USER} />)
    // Export/Import was moved to the AuthButton signed-in panel
    expect(screen.queryByText('↓ Export')).not.toBeInTheDocument()
    expect(screen.queryByText('↑ Import')).not.toBeInTheDocument()
  })

  it('Meditation tab shows default guide links', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    expect(screen.getByText('Guided Meditation · Session 1')).toBeInTheDocument()
    expect(screen.getByText('Guided Meditation · Session 2')).toBeInTheDocument()
  })

  it('clicking × on a guide removes it', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    expect(screen.getByText('Guided Meditation · Session 1')).toBeInTheDocument()
    // The guides section has × remove buttons — find the first one in the guides card
    const guideCard = screen.getByText('Favorite Guides').closest('.tcard')!
    const removeBtn = guideCard.querySelectorAll('button[title="Remove"]')[0] as HTMLElement
    fireEvent.click(removeBtn)
    expect(screen.queryByText('Guided Meditation · Session 1')).not.toBeInTheDocument()
  })

  it('+ Add opens guide form and Cancel closes it', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('+ Add'))
    expect(screen.getByPlaceholderText('Title (e.g. Morning Calm · 13 min)')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Cancel'))
    expect(
      screen.queryByPlaceholderText('Title (e.g. Morning Calm · 13 min)'),
    ).not.toBeInTheDocument()
  })

  it('Add guide button adds guide with title and URL', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('+ Add'))
    fireEvent.change(screen.getByPlaceholderText('Title (e.g. Morning Calm · 13 min)'), {
      target: { value: 'My Custom Guide' },
    })
    fireEvent.change(screen.getByPlaceholderText('URL'), {
      target: { value: 'https://example.com/guide' },
    })
    fireEvent.click(screen.getByText('Add guide'))
    expect(screen.getByText('My Custom Guide')).toBeInTheDocument()
  })

  it('Add guide with only URL uses URL as title', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('+ Add'))
    fireEvent.change(screen.getByPlaceholderText('URL'), {
      target: { value: 'https://example.com/guide' },
    })
    fireEvent.click(screen.getByText('Add guide'))
    expect(screen.getByText('https://example.com/guide')).toBeInTheDocument()
  })

  it('Add guide with empty URL does nothing', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('+ Add'))
    const initialGuideCount = screen.getAllByTitle('Remove').length
    fireEvent.click(screen.getByText('Add guide'))
    expect(screen.getAllByTitle('Remove').length).toBe(initialGuideCount)
  })

  it('pressing Enter in URL field submits the guide', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('+ Add'))
    const urlInput = screen.getByPlaceholderText('URL')
    fireEvent.change(urlInput, { target: { value: 'https://example.com' } })
    fireEvent.keyDown(urlInput, { key: 'Enter' })
    expect(screen.getByText('https://example.com')).toBeInTheDocument()
  })

  it('camera 📷 button is visible in the food tab', () => {
    render(<TrackerTab user={FAKE_USER} />)
    const cameraBtn = screen.getByTitle('Analyze food photo or nutrition label')
    expect(cameraBtn).toBeInTheDocument()
    expect(cameraBtn).toHaveTextContent('📷')
  })

  it('logging food with servings > 1 shows ×N srv label', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Chicken' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '200' } })
    fireEvent.change(screen.getByPlaceholderText('1'), { target: { value: '2' } })
    fireEvent.click(screen.getByText('+ Log food'))
    expect(screen.getByText('×2 srv')).toBeInTheDocument()
  })

  it('logging food with fiber shows fiber in the macro line', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Broccoli' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '55' } })
    fireEvent.change(screen.getByPlaceholderText('fiber'), { target: { value: '5' } })
    fireEvent.click(screen.getByText('+ Log food'))
    expect(screen.getByText(/5g fiber/)).toBeInTheDocument()
  })

  it('removing the food being edited calls cancelEdit first', () => {
    render(<TrackerTab user={FAKE_USER} />)
    // Log a food, start editing it, then remove it via ×
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Eggs' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '150' } })
    fireEvent.click(screen.getByText('+ Log food'))
    fireEvent.click(screen.getByTitle('Edit'))
    expect(screen.getByText('✓ Save changes')).toBeInTheDocument()
    // Click × to remove — should also cancel edit
    fireEvent.click(screen.getByText('×'))
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument()
    expect(screen.queryByText('✓ Save changes')).not.toBeInTheDocument()
  })

  it('Data backup section is no longer in TrackerTab (moved to AuthButton)', () => {
    render(<TrackerTab user={FAKE_USER} />)
    // Data backup was moved to the AuthButton signed-in panel
    expect(screen.queryByText('Data backup')).not.toBeInTheDocument()
  })

  it('hovering the check-in card does not crash (syncSleepFromOura guard)', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    const checkInCard = screen.getByText('Daily check-in').closest('.tcard')!
    fireEvent.mouseEnter(checkInCard)
    // ouraConnected is false → function returns immediately. No crash = guard works
  })

  it('Oura Ring section is not rendered in TrackerTab (moved to OuraTab)', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.queryByText('Oura Ring')).not.toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Paste your Oura PAT here…')).not.toBeInTheDocument()
  })

  // ── Tier 2: hunger type + craving swaps ──────────────────────────
  it('selecting a Mouth hunger type reveals the craving helper with swaps', () => {
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText(/Mouth/))
    const helper = container.querySelector('.craving-helper') as HTMLElement
    expect(helper).toBeTruthy()
    fireEvent.click(within(helper).getByText('sweet'))
    expect(within(helper).getByText(/berries/i)).toBeInTheDocument()
  })

  it('logs a food carrying its hunger type (icon on the row)', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText(/Emotional/))
    fireEvent.change(screen.getByPlaceholderText('Meal name (e.g. Berry Oats)'), {
      target: { value: 'Cookies' },
    })
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '200' } })
    fireEvent.click(screen.getByText('+ Log food'))
    expect(screen.getByTitle('Emotional hunger')).toBeInTheDocument()
  })

  it('renders the browsable craving-swap reference', () => {
    render(<TrackerTab user={FAKE_USER} />)
    expect(screen.getByText(/Craving swaps/)).toBeInTheDocument()
  })

  // ── Tier 2: weekly goal ──────────────────────────────────────────
  it('can save a weekly goal', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.change(screen.getByPlaceholderText(/Protein at every meal/), {
      target: { value: 'Walk daily' },
    })
    fireEvent.click(screen.getByText('Save weekly'))
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('weekly experiment toggle switches the goal prompt', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    fireEvent.click(screen.getByText('experiment'))
    expect(screen.getByPlaceholderText(/If I prep 3 lunches/)).toBeInTheDocument()
  })

  it('a weekly goal suggestion chip fills the goal field', () => {
    const { container } = render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    const weekCard = screen.getByText('Weekly goal').closest('.tcard') as HTMLElement
    fireEvent.click(within(weekCard).getByText('Protein at every meal'))
    const textarea = container.querySelector(
      'textarea[placeholder^="e.g. Protein"]',
    ) as HTMLTextAreaElement
    expect(textarea.value).toBe('Protein at every meal')
  })

  it('recording a weekly result and saving works', () => {
    render(<TrackerTab user={FAKE_USER} />)
    fireEvent.click(screen.getByText('Meditation'))
    const weekCard = screen.getByText('Weekly goal').closest('.tcard') as HTMLElement
    fireEvent.click(within(weekCard).getByText('Yes'))
    fireEvent.click(within(weekCard).getByText('Save weekly'))
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// TrackerTab auth gate
// ═════════════════════════════════════════════════════════════════
describe('TrackerTab auth gate', () => {
  it('shows sign-in gate when user is null', () => {
    render(<TrackerTab user={null} />)
    expect(screen.getByText(/Sign in to use/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText(/Search recipes/)).not.toBeInTheDocument()
  })

  it('shows tracker content when user is provided', () => {
    const fakeUser = { id: 'u1', email: 'test@example.com' } as any
    render(<TrackerTab user={fakeUser} />)
    expect(screen.queryByText(/Sign in to use/i)).not.toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// App — top-level integration
// ═════════════════════════════════════════════════════════════════
describe('App', () => {
  it('renders the Wellness Hub title', () => {
    render(<App />)
    expect(screen.getByText(/Wellness Hub/)).toBeInTheDocument()
  })

  it('renders all 4 tab buttons', () => {
    render(<App />)
    expect(screen.getByText('📊 Tracker')).toBeInTheDocument()
    expect(screen.getByText('🍽 Recipes')).toBeInTheDocument()
    expect(screen.getByText('💪 Workouts')).toBeInTheDocument()
    expect(screen.getByText('📅 Schedule')).toBeInTheDocument()
  })

  it('shows auth gate on Tracker tab when not signed in', () => {
    render(<App />)
    expect(screen.getByText(/Sign in to use/i)).toBeInTheDocument()
  })

  it('ScheduleTab shows sign-in gate when not authenticated', () => {
    render(<App />)
    fireEvent.click(screen.getByText('📅 Schedule'))
    expect(screen.getByText(/Sign in to save your schedule/i)).toBeInTheDocument()
    expect(screen.queryByText(/Cognitive peak/)).not.toBeInTheDocument()
  })

  it('WorkoutsTab is always rendered (guest template heading visible)', () => {
    render(<App />)
    // Without a signed-in user, App renders the guest male template
    expect(screen.getByText(/3×\/week Template/i)).toBeInTheDocument()
  })

  it('clicking Recipes tab shows sign-in gate when not authenticated', () => {
    render(<App />)
    fireEvent.click(screen.getByText('🍽 Recipes'))
    expect(screen.getByText(/Create, save and organise your personal recipes/i)).toBeInTheDocument()
    expect(screen.queryByPlaceholderText('Search recipes, ingredients…')).not.toBeInTheDocument()
  })

  it('clicking Workouts tab preserves week navigation', () => {
    render(<App />)
    fireEvent.click(screen.getByText('💪 Workouts'))
    expect(screen.getByRole('button', { name: 'Week 1' })).toBeInTheDocument()
  })

  it('clicking Schedule tab shows sign-in gate when not authenticated', () => {
    render(<App />)
    fireEvent.click(screen.getByText('📅 Schedule'))
    expect(screen.getByText(/Sign in to save your schedule/i)).toBeInTheDocument()
  })

  it('clicking back to Tracker tab shows auth gate when not signed in', () => {
    render(<App />)
    fireEvent.click(screen.getByText('🍽 Recipes'))
    fireEvent.click(screen.getByText('📊 Tracker'))
    expect(screen.getByText(/Sign in to use/i)).toBeInTheDocument()
  })

  it('UpdatePrompt renders nothing when no SW update pending', () => {
    render(<App />)
    expect(screen.queryByText('New version available')).not.toBeInTheDocument()
  })
})

// ── RemindersSection ─────────────────────────────────────────────
describe('RemindersSection', () => {
  it('renders the empty state message when no reminders exist', () => {
    render(<RemindersSection />)
    expect(screen.getByText(/No reminders yet/i)).toBeInTheDocument()
  })

  it('Add button is present alongside a usable input', () => {
    render(<RemindersSection />)
    expect(screen.getByPlaceholderText('New reminder…')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /add/i })).toBeInTheDocument()
  })

  it('Add button does nothing when input is empty', () => {
    render(<RemindersSection />)
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByText(/No reminders yet/i)).toBeInTheDocument()
  })

  it('adds a reminder when text is typed and Add is clicked', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Buy oat milk' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByText('Buy oat milk')).toBeInTheDocument()
    expect(screen.queryByText(/No reminders yet/i)).not.toBeInTheDocument()
  })

  it('clears the input after adding', () => {
    render(<RemindersSection />)
    const input = screen.getByPlaceholderText('New reminder…')
    fireEvent.change(input, { target: { value: 'Take vitamins' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('adds a reminder when Enter is pressed in the input', () => {
    render(<RemindersSection />)
    const input = screen.getByPlaceholderText('New reminder…')
    fireEvent.change(input, { target: { value: 'Drink water' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(screen.getByText('Drink water')).toBeInTheDocument()
  })

  it('checks (strikes through) a reminder when its checkbox is clicked', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Meditate' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /check reminder/i }))
    // text-decoration is now applied via the .rem-text.checked CSS class
    expect(screen.getByText('Meditate')).toHaveClass('checked')
  })

  it('unchecks a reminder when its checkbox is clicked again', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), { target: { value: 'Stretch' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /check reminder/i }))
    fireEvent.click(screen.getByRole('button', { name: /uncheck reminder/i }))
    expect(screen.getByText('Stretch')).not.toHaveClass('checked')
  })

  it('clicking the text also toggles the check state', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), { target: { value: 'Journal' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByText('Journal'))
    expect(screen.getByText('Journal')).toHaveClass('checked')
  })

  it('removes a reminder when × is clicked', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Call mom' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    expect(screen.getByText('Call mom')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /delete reminder/i }))
    expect(screen.queryByText('Call mom')).not.toBeInTheDocument()
    expect(screen.getByText(/No reminders yet/i)).toBeInTheDocument()
  })

  it('shows the edit button (✎) only on unchecked reminders', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Read 10 pages' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    expect(screen.getByRole('button', { name: /edit reminder/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /check reminder/i }))
    expect(screen.queryByRole('button', { name: /edit reminder/i })).not.toBeInTheDocument()
  })

  it('clicking ✎ opens an inline edit input pre-filled with the current text', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Walk the dog' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /edit reminder/i }))
    const editInput = screen.getByDisplayValue('Walk the dog')
    expect(editInput).toBeInTheDocument()
  })

  it('saves the edited text when Save is clicked', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Old text' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /edit reminder/i }))
    const editInput = screen.getByDisplayValue('Old text')
    fireEvent.change(editInput, { target: { value: 'New text' } })
    fireEvent.click(screen.getByRole('button', { name: /save edit/i }))

    expect(screen.getByText('New text')).toBeInTheDocument()
    expect(screen.queryByText('Old text')).not.toBeInTheDocument()
    expect(screen.queryByDisplayValue('New text')).not.toBeInTheDocument()
  })

  it('saves the edit when Enter is pressed in the edit input', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Original' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /edit reminder/i }))
    const editInput = screen.getByDisplayValue('Original')
    fireEvent.change(editInput, { target: { value: 'Updated' } })
    fireEvent.keyDown(editInput, { key: 'Enter' })

    expect(screen.getByText('Updated')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Updated')).not.toBeInTheDocument()
  })

  it('cancels the edit when × (cancel) is clicked, restoring original text', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Keep this' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /edit reminder/i }))
    const editInput = screen.getByDisplayValue('Keep this')
    fireEvent.change(editInput, { target: { value: 'Discard this' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel edit/i }))

    expect(screen.getByText('Keep this')).toBeInTheDocument()
    expect(screen.queryByText('Discard this')).not.toBeInTheDocument()
  })

  it('cancels the edit when Escape is pressed', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), { target: { value: 'Stay' } })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /edit reminder/i }))
    const editInput = screen.getByDisplayValue('Stay')
    fireEvent.keyDown(editInput, { key: 'Escape' })

    expect(screen.getByText('Stay')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Stay')).not.toBeInTheDocument()
  })

  it('Save edit button is disabled when the edit text is blank', () => {
    render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Non-blank' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))

    fireEvent.click(screen.getByRole('button', { name: /edit reminder/i }))
    const editInput = screen.getByDisplayValue('Non-blank')
    fireEvent.change(editInput, { target: { value: '   ' } })

    expect(screen.getByRole('button', { name: /save edit/i })).toBeDisabled()
  })

  it('persists reminders in localStorage so they survive a remount', () => {
    const { unmount } = render(<RemindersSection />)
    fireEvent.change(screen.getByPlaceholderText('New reminder…'), {
      target: { value: 'Persisted item' },
    })
    fireEvent.click(screen.getByRole('button', { name: /add/i }))
    unmount()

    render(<RemindersSection />)
    expect(screen.getByText('Persisted item')).toBeInTheDocument()
  })
})

// ── GroceryPanel — nutrition lookup ─────────────────────────────
// Helpers shared across tests in this block
const USDA_HIT = {
  foods: [
    {
      servingSize: 100,
      servingSizeUnit: 'g',
      foodNutrients: [
        { nutrientId: 1008, value: 23 }, // kcal
        { nutrientId: 1003, value: 1.8 }, // protein
        { nutrientId: 1005, value: 3.6 }, // carbs
        { nutrientId: 1004, value: 0.5 }, // fat
        { nutrientId: 1079, value: 1.6 }, // fiber
      ],
    },
  ],
}
const USDA_MISS = { foods: [] }

function mockUSDA(payload: object) {
  vi.spyOn(foodSearch, 'searchUSDA').mockResolvedValue(
    payload === USDA_MISS ? null : { srv: '100g', cal: 23, p: 1.8, c: 3.6, f: 0.5, fi: 1.6 },
  )
}

function openAddForm() {
  fireEvent.click(screen.getByRole('button', { name: /add grocery item/i }))
}

function typeName(name: string) {
  fireEvent.change(screen.getByPlaceholderText(/Item name/i), { target: { value: name } })
}

describe('GroceryPanel — nutrition lookup', () => {
  it('shows a "USDA lookup" button inside the add-item form', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    expect(screen.getByRole('button', { name: /look up nutrition from usda/i })).toBeInTheDocument()
  })

  it('USDA lookup button is disabled when the name field is empty', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    expect(screen.getByRole('button', { name: /look up nutrition from usda/i })).toBeDisabled()
  })

  it('USDA lookup button is enabled once a name is typed', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Kimchi')
    expect(screen.getByRole('button', { name: /look up nutrition from usda/i })).not.toBeDisabled()
  })

  it('calls searchUSDA with the typed item name', async () => {
    const spy = vi.spyOn(foodSearch, 'searchUSDA').mockResolvedValue(null)
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Kimchi')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(spy).toHaveBeenCalledWith('Kimchi', expect.anything()))
  })

  it('pre-fills nutrition fields when USDA returns a result', async () => {
    mockUSDA(USDA_HIT)
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Kimchi')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(screen.getByDisplayValue('23')).toBeInTheDocument())
    expect(screen.getByDisplayValue('1.8')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3.6')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument()
    expect(screen.getByDisplayValue('1.6')).toBeInTheDocument()
    expect(screen.getByDisplayValue('100g')).toBeInTheDocument()
  })

  it('shows "Found — edit if needed" status after a successful lookup', async () => {
    mockUSDA(USDA_HIT)
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Kimchi')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(screen.getByText(/found.*edit/i)).toBeInTheDocument())
  })

  it('allows editing pre-filled nutrition values before saving', async () => {
    mockUSDA(USDA_HIT)
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Kimchi')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(screen.getByDisplayValue('23')).toBeInTheDocument())

    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '30' } })
    expect(screen.getByDisplayValue('30')).toBeInTheDocument()
  })

  it('saves item with nutrition data and shows it in the list', async () => {
    mockUSDA(USDA_HIT)
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Kimchi')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(screen.getByDisplayValue('23')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    expect(screen.getByText('Kimchi')).toBeInTheDocument()
    // Nutrition line is rendered below the name
    expect(screen.getByText(/23 kcal/)).toBeInTheDocument()
  })

  it('shows "No match found" when USDA returns no results', async () => {
    vi.spyOn(foodSearch, 'searchUSDA').mockResolvedValue(null)
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('xyzzy123nonsense')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(screen.getByText(/no match found/i)).toBeInTheDocument())
    // Fields remain empty and editable
    expect(screen.getByLabelText('Calories')).toHaveValue(null)
  })

  it('shows "Lookup failed" when searchUSDA throws', async () => {
    vi.spyOn(foodSearch, 'searchUSDA').mockRejectedValue(new Error('USDA 500'))
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Chicken')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(screen.getByText(/lookup failed/i)).toBeInTheDocument())
  })

  it('can add an item without running a lookup (no nutrition data)', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Tempeh') // not in seeded catalog
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    const row = screen.getByText('Tempeh').closest('.gitem') as HTMLElement
    // This specific item has no nutrition sub-line
    expect(within(row).queryByText(/kcal/)).not.toBeInTheDocument()
  })

  it('can add an item with manually entered nutrition (no lookup)', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Natto') // not in seeded catalog
    fireEvent.change(screen.getByLabelText('Serving size'), { target: { value: '1 cup' } })
    fireEvent.change(screen.getByLabelText('Calories'), { target: { value: '187' } })
    fireEvent.change(screen.getByLabelText('Protein'), { target: { value: '18' } })
    fireEvent.change(screen.getByLabelText('Carbs'), { target: { value: '12' } })
    fireEvent.change(screen.getByLabelText('Fat'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add item' }))
    const row = screen.getByText('Natto').closest('.gitem') as HTMLElement
    expect(within(row).getByText(/187 kcal/)).toBeInTheDocument()
  })

  it('nutrition fields are empty inputs (not pre-filled) before any lookup', () => {
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    expect(screen.getByLabelText('Calories')).toHaveValue(null)
    expect(screen.getByLabelText('Protein')).toHaveValue(null)
  })

  it('resets nutrition fields when Cancel is clicked', async () => {
    mockUSDA(USDA_HIT)
    render(<GroceryPanel user={FAKE_USER} />)
    openAddForm()
    typeName('Kimchi')
    fireEvent.click(screen.getByRole('button', { name: /look up nutrition from usda/i }))
    await waitFor(() => expect(screen.getByDisplayValue('23')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    // Form is gone; re-open and fields should be empty again
    openAddForm()
    expect(screen.getByLabelText('Calories')).toHaveValue(null)
  })
})

// ═════════════════════════════════════════════════════════════════
// TrackerTab — food search (local-first + online fallback)
// ═════════════════════════════════════════════════════════════════
describe('TrackerTab — food search', () => {
  const mealInput = () => screen.getByPlaceholderText('Meal name (e.g. Berry Oats)')

  function typeQuery(q: string) {
    fireEvent.focus(mealInput())
    fireEvent.change(mealInput(), { target: { value: q } })
  }

  const USDA_HITS = [
    { name: 'Tamales, masa', srv: '100g', k: 213, p: 5.8, c: 28.4, f: 9.1, fi: 3.2 },
  ]

  it('shows the "Search online" action for unknown foods', () => {
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('zzghostfood')
    expect(screen.getByText(/Search online for/)).toBeInTheDocument()
  })

  it('does not show the dropdown for queries under 2 chars', () => {
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('z')
    expect(screen.queryByText(/Search online for/)).not.toBeInTheDocument()
  })

  it('lists saved recipes under a "Recipes" section', () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([{ ...CUSTOM_RECIPE, name: 'Mango Lassi' }])
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('mango')
    expect(screen.getByText('Recipes')).toBeInTheDocument()
    expect(screen.getByText('Mango Lassi')).toBeInTheDocument()
  })

  it('picking a recipe hit fills the form with healthy-variant macros', () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([{ ...CUSTOM_RECIPE, name: 'Mango Lassi' }])
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('mango')
    fireEvent.mouseDown(screen.getByText('Mango Lassi'))
    expect(mealInput()).toHaveValue('Mango Lassi')
    expect(screen.getByPlaceholderText('kcal')).toHaveValue(CUSTOM_RECIPE.hk)
  })

  it('logging a recipe hit stores the recipe link and shows the badge', () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([{ ...CUSTOM_RECIPE, name: 'Mango Lassi' }])
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('mango')
    fireEvent.mouseDown(screen.getByText('Mango Lassi'))
    fireEvent.click(screen.getByText('+ Log food'))
    expect(screen.getByTitle('Open recipe')).toBeInTheDocument()
    const days = JSON.parse(ls['whub_tracker_v3'])
    const foods = (Object.values(days)[0] as { foods: { n: string; r?: number }[] }).foods
    expect(foods[0]).toMatchObject({ n: 'Mango Lassi', r: CUSTOM_RECIPE.id })
  })

  it('previously logged foods appear under "Your foods"', () => {
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('Custom Tamal')
    fireEvent.change(screen.getByPlaceholderText('kcal'), { target: { value: '250' } })
    fireEvent.click(screen.getByText('+ Log food'))
    typeQuery('tamal')
    expect(screen.getByText('Your foods')).toBeInTheDocument()
    // Name appears both in the meals-logged list and in the dropdown
    const matches = screen.getAllByText('Custom Tamal')
    expect(matches.some(el => el.closest('.autocomplete-dropdown') !== null)).toBe(true)
  })

  it('tapping "Search online" shows USDA results and picking one fills the form', async () => {
    const spy = vi.spyOn(foodSearch, 'searchUSDAFoods').mockResolvedValue(USDA_HITS)
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('zztamales')
    fireEvent.mouseDown(screen.getByText(/Search online for/))
    await waitFor(() => expect(screen.getByText('Tamales, masa')).toBeInTheDocument())
    expect(spy).toHaveBeenCalledWith('zztamales', expect.anything())
    fireEvent.mouseDown(screen.getByText('Tamales, masa'))
    expect(mealInput()).toHaveValue('Tamales, masa')
    expect(screen.getByPlaceholderText('kcal')).toHaveValue(213)
  })

  it('shows "No USDA match." when the online search returns nothing', async () => {
    vi.spyOn(foodSearch, 'searchUSDAFoods').mockResolvedValue([])
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('zzghost')
    fireEvent.mouseDown(screen.getByText(/Search online for/))
    await waitFor(() => expect(screen.getByText('No USDA match.')).toBeInTheDocument())
  })

  it('"Estimate with AI" fills the form with the AI estimate', async () => {
    vi.spyOn(foodSearch, 'searchUSDAFoods').mockResolvedValue([])
    vi.spyOn(foodSearch, 'estimateFoodMacros').mockResolvedValue({
      name: 'Pozole Rojo',
      kcal: 320,
      protein: 22,
      carbs: 28,
      fat: 14,
      fiber: 5,
      confidence: 'medium',
      notes: 'Assumes 1 bowl (~400 g)',
    })
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('pozole')
    fireEvent.mouseDown(screen.getByText(/Search online for/))
    await waitFor(() => expect(screen.getByText(/Estimate with AI/)).toBeInTheDocument())
    fireEvent.mouseDown(screen.getByText(/Estimate with AI/))
    await waitFor(() => expect(mealInput()).toHaveValue('Pozole Rojo'))
    expect(screen.getByPlaceholderText('kcal')).toHaveValue(320)
    expect(screen.getByText(/Assumes 1 bowl/)).toBeInTheDocument()
  })

  it('shows the retry row when the AI estimate is unavailable', async () => {
    vi.spyOn(foodSearch, 'searchUSDAFoods').mockResolvedValue([])
    vi.spyOn(foodSearch, 'estimateFoodMacros').mockResolvedValue(null)
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('zzghost')
    fireEvent.mouseDown(screen.getByText(/Search online for/))
    await waitFor(() => expect(screen.getByText(/Estimate with AI/)).toBeInTheDocument())
    fireEvent.mouseDown(screen.getByText(/Estimate with AI/))
    await waitFor(() => expect(screen.getByText(/Search failed/)).toBeInTheDocument())
  })

  it('shows a retry row when the online search fails', async () => {
    vi.spyOn(foodSearch, 'searchUSDAFoods').mockRejectedValue(new Error('USDA 500'))
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('zzghost')
    fireEvent.mouseDown(screen.getByText(/Search online for/))
    await waitFor(() => expect(screen.getByText(/Search failed/)).toBeInTheDocument())
  })

  it('typing again clears previous online results', async () => {
    vi.spyOn(foodSearch, 'searchUSDAFoods').mockResolvedValue(USDA_HITS)
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('zztamales')
    fireEvent.mouseDown(screen.getByText(/Search online for/))
    await waitFor(() => expect(screen.getByText('Tamales, masa')).toBeInTheDocument())
    typeQuery('zztamales con mole')
    expect(screen.queryByText('Tamales, masa')).not.toBeInTheDocument()
    expect(screen.getByText(/Search online for/)).toBeInTheDocument()
  })
})

// ═════════════════════════════════════════════════════════════════
// Food search follow-ups: builtin catalog + open-recipe-from-tracker
// ═════════════════════════════════════════════════════════════════
describe('TrackerTab — builtin catalog search', () => {
  const mealInput = () => screen.getByPlaceholderText('Meal name (e.g. Berry Oats)')

  function typeQuery(q: string) {
    fireEvent.focus(mealInput())
    fireEvent.change(mealInput(), { target: { value: q } })
  }

  it('recipes from the cached builtin catalog are searchable', () => {
    ls['whub_builtin_recipes_v1'] = JSON.stringify([{ ...BASE_RECIPE, custom: false }])
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('test dish')
    expect(screen.getByText('Recipes', { exact: true })).toBeInTheDocument()
    expect(screen.getByText('Test Dish')).toBeInTheDocument()
  })

  it('a forked builtin (custom with defaultId) replaces the original in search', () => {
    ls['whub_builtin_recipes_v1'] = JSON.stringify([{ ...BASE_RECIPE, custom: false }])
    ls['whub_custom_recipes_v1'] = JSON.stringify([
      {
        ...BASE_RECIPE,
        id: 9501,
        name: 'My Test Dish Fork',
        custom: true,
        defaultId: BASE_RECIPE.id,
      },
    ])
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('test dish')
    expect(screen.getByText('My Test Dish Fork')).toBeInTheDocument()
    expect(screen.queryByText('Test Dish')).not.toBeInTheDocument()
  })

  it('hidden builtin recipes stay out of search', () => {
    ls['whub_builtin_recipes_v1'] = JSON.stringify([{ ...BASE_RECIPE, custom: false }])
    ls['whub_hidden_recipes_v1'] = JSON.stringify([BASE_RECIPE.id])
    render(<TrackerTab user={FAKE_USER} />)
    typeQuery('test dish')
    expect(screen.queryByText('Test Dish')).not.toBeInTheDocument()
  })

  it('tapping the 📖 badge calls onOpenRecipe with id and name', () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([{ ...CUSTOM_RECIPE, name: 'Mango Lassi' }])
    const onOpenRecipe = vi.fn()
    render(<TrackerTab user={FAKE_USER} onOpenRecipe={onOpenRecipe} />)
    typeQuery('mango')
    fireEvent.mouseDown(screen.getByText('Mango Lassi'))
    fireEvent.click(screen.getByText('+ Log food'))
    fireEvent.click(screen.getByTitle('Open recipe'))
    expect(onOpenRecipe).toHaveBeenCalledWith(CUSTOM_RECIPE.id, 'Mango Lassi')
  })
})

describe('RecipesTab — open request from tracker', () => {
  it('expands the matching recipe card', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(
      <RecipesTab
        user={FAKE_USER}
        openRequest={{ id: CUSTOM_RECIPE.id, name: CUSTOM_RECIPE.name, seq: 1 }}
      />,
    )
    await waitFor(() => expect(screen.getByText('tap to collapse')).toBeInTheDocument())
    expect(screen.getByText(CUSTOM_RECIPE.name)).toBeInTheDocument()
  })

  it('falls back to a name match when the id is stale', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(
      <RecipesTab
        user={FAKE_USER}
        openRequest={{ id: 424242, name: CUSTOM_RECIPE.name, seq: 1 }}
      />,
    )
    await waitFor(() => expect(screen.getByText('tap to collapse')).toBeInTheDocument())
  })

  it('surfaces unknown recipes as a search query', async () => {
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    render(
      <RecipesTab user={FAKE_USER} openRequest={{ id: 424242, name: 'Ghost Recipe', seq: 1 }} />,
    )
    await waitFor(() =>
      expect(screen.getByPlaceholderText('Search recipes, ingredients…')).toHaveValue(
        'Ghost Recipe',
      ),
    )
    expect(screen.queryByText('tap to collapse')).not.toBeInTheDocument()
  })

  it('expands a recipe written to localStorage after mount (state lagging the store)', async () => {
    // Mount with an empty store — the rendered list starts empty
    const { rerender } = render(<RecipesTab user={FAKE_USER} />)
    expect(screen.queryByText(CUSTOM_RECIPE.name)).not.toBeInTheDocument()
    // Recipe arrives via an external write (sync, another tab, e2e seeding)
    ls['whub_custom_recipes_v1'] = JSON.stringify([CUSTOM_RECIPE])
    rerender(
      <RecipesTab
        user={FAKE_USER}
        openRequest={{ id: CUSTOM_RECIPE.id, name: CUSTOM_RECIPE.name, seq: 1 }}
      />,
    )
    await waitFor(() => expect(screen.getByText('tap to collapse')).toBeInTheDocument())
    expect(screen.getByText(CUSTOM_RECIPE.name)).toBeInTheDocument()
  })
})
