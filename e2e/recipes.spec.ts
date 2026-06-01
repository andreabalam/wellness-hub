import { test, expect } from '@playwright/test'

// Grocery catalog pre-seed — avoids relying on GroceryPanel's async seeding effect.
// Using the same categories as GROCERY_DATA so .gcat elements appear immediately.
const SEED_GROCERY = JSON.stringify([
  { id: 'g-e2e-1', n: 'Oats',           cat: 'Grains & Legumes' },
  { id: 'g-e2e-2', n: 'Banana',         cat: 'Fruits' },
  { id: 'g-e2e-3', n: 'Chicken breast', cat: 'Protein' },
])

// Two pre-seeded test recipes used by filter/expand/collapse tests.
// Built-in recipes have been removed; tests that need cards must seed their own.
const SEED_RECIPES = JSON.stringify([
  {
    name: 'Test Breakfast Bowl', cat: 'breakfast', type: 'Breakfast',
    color: 'var(--amber)', sc: 'am', tag: 'Quick', prepL: '10 min', prepC: 'var(--amber)',
    hk: 350, hp: '20g', hc: '40g', hf: '8g', mk: 350, mp: '20g', mc: '40g', mf: '8g',
    ings: [['Oats', '50g']], steps: ['Cook oats', 'Top with fruit'], tip: '', custom: true, source: 'user',
  },
  {
    name: 'Test Green Smoothie', cat: 'smoothie', type: 'Smoothie',
    color: 'var(--green)', sc: 'cg', tag: 'Quick', prepL: '5 min', prepC: 'var(--green)',
    hk: 250, hp: '10g', hc: '45g', hf: '3g', mk: 250, mp: '10g', mc: '45g', mf: '3g',
    ings: [['Banana', '1 piece'], ['Spinach', '30g']], steps: ['Blend everything'], tip: '', custom: true, source: 'user',
  },
])

test.describe('Recipes tab', () => {
  test.beforeEach(async ({ page }) => {
    // addInitScript runs before any page scripts on EVERY navigation (including
    // page.reload() within tests). It sets sessionStorage so the DEV mock-user
    // bypass in App.tsx always sees a valid user without needing a real Supabase
    // session. Only sessionStorage is touched here so localStorage persistence
    // tests (lines 93, 139, 175) are not disrupted by the init script re-running.
    await page.addInitScript(() => {
      sessionStorage.setItem('__e2e_user__', JSON.stringify({
        id: 'e2e-test-id', email: 'test@e2e.com',
        app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '',
      }))
    })

    // Seed localStorage once before the initial navigation.
    // We pre-seed the grocery catalog (SEEDED_KEY + items) to avoid relying on
    // GroceryPanel's async seeding useEffect, which can miss the 5-second
    // Playwright assertion timeout on slow CI runners.
    await page.goto('/')
    await page.evaluate(({ recipes, grocery }) => {
      localStorage.clear()
      localStorage.setItem('whub_custom_recipes_v1', recipes)
      localStorage.setItem('whub_grocery_initialized_v1', '1')   // skip seeding effect
      localStorage.setItem('whub_grocery_catalog_v1', grocery)
    }, { recipes: SEED_RECIPES, grocery: SEED_GROCERY })
    await page.reload()
    await page.getByRole('button', { name: /Recipes/i }).click()
  })

  test('shows seeded user recipes by default', async ({ page }) => {
    // No built-in recipes — only the two seeded test recipes appear
    await expect(page.locator('.rcard').first()).toBeVisible()
    expect(await page.locator('.rcard').count()).toBe(2)
    await expect(page.getByText('Test Breakfast Bowl')).toBeVisible()
    await expect(page.getByText('Test Green Smoothie')).toBeVisible()
  })

  test('filter by Breakfast shows only breakfast recipes', async ({ page }) => {
    await expect(page.locator('.rcard').first()).toBeVisible()
    await page.getByRole('button', { name: 'Breakfast' }).click()
    const cards = page.locator('.rcard')
    expect(await cards.count()).toBe(1)
    await expect(cards.first().locator('.rctype')).toContainText('Breakfast')
  })

  test('filter by Smoothies shows only smoothies', async ({ page }) => {
    await expect(page.locator('.rcard').first()).toBeVisible()
    await page.getByRole('button', { name: 'Smoothies' }).click()
    const cards = page.locator('.rcard')
    expect(await cards.count()).toBe(1)
    await expect(cards.first().locator('.rctype')).toContainText('Smoothie')
  })

  test('clicking a recipe card expands it', async ({ page }) => {
    const card = page.locator('.rcard').first()
    await expect(card.locator('.rcbody')).not.toBeVisible()
    await card.click()
    await expect(card.locator('.rcbody')).toBeVisible()
    await expect(card.locator('.rchint')).toContainText('tap to collapse')
  })

  test('clicking an open card collapses it', async ({ page }) => {
    const card = page.locator('.rcard').first()
    await card.click()
    await expect(card.locator('.rcbody')).toBeVisible()
    await card.click()
    await expect(card.locator('.rcbody')).not.toBeVisible()
  })

  test('Grocery filter shows the grocery panel', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await expect(page.getByText('Your Grocery List')).toBeVisible()
    await expect(page.locator('.gcat').first()).toBeVisible()
  })

  test('grocery items can be checked and unchecked', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    const item = page.locator('.gitem').first()
    await expect(item).not.toHaveClass(/gchecked/)
    await item.click()
    await expect(item).toHaveClass(/gchecked/)
    await item.click()
    await expect(item).not.toHaveClass(/gchecked/)
  })

  test('grocery checked state persists across page reloads', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    const item = page.locator('.gitem').first()
    // The item name is in the first <span> (flex:1); second span is the optional badge
    const itemText = await item.locator('span').first().textContent()
    await item.click()
    await expect(item).toHaveClass(/gchecked/)

    await page.reload()
    await page.getByRole('button', { name: /Recipes/i }).click()
    await page.getByRole('button', { name: '🛒 Grocery' }).click()

    const reloadedItem = page.locator('.gitem').filter({ hasText: itemText! }).first()
    await expect(reloadedItem).toHaveClass(/gchecked/)
  })

  test('Clear all removes all checks', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    // Check a couple of items
    await page.locator('.gitem').nth(0).click()
    await page.locator('.gitem').nth(1).click()
    await page.getByRole('button', { name: 'Clear all' }).click()
    const checkedCount = await page.locator('.gitem.gchecked').count()
    expect(checkedCount).toBe(0)
  })

  // ── Phase 5: dynamic grocery catalog ────────────────────────────

  test('can add a custom item to the grocery list', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await page.getByRole('button', { name: /add grocery item/i }).click()
    await page.getByPlaceholder(/Item name/i).fill('Kimchi')
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByText('Kimchi')).toBeVisible()
  })

  test('added grocery item can be checked off', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await page.getByRole('button', { name: /add grocery item/i }).click()
    await page.getByPlaceholder(/Item name/i).fill('Miso Paste')
    await page.getByRole('button', { name: 'Add item' }).click()
    const item = page.locator('.gitem').filter({ hasText: 'Miso Paste' })
    await item.click()
    await expect(item).toHaveClass(/gchecked/)
  })

  test('added grocery item persists after page reload', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await page.getByRole('button', { name: /add grocery item/i }).click()
    await page.getByPlaceholder(/Item name/i).fill('Persistent Item')
    await page.getByRole('button', { name: 'Add item' }).click()

    await page.reload()
    await page.getByRole('button', { name: /Recipes/i }).click()
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await expect(page.getByText('Persistent Item')).toBeVisible()
  })

  test('added grocery item can be removed', async ({ page }) => {
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await page.getByRole('button', { name: /add grocery item/i }).click()
    await page.getByPlaceholder(/Item name/i).fill('Delete Me Item')
    await page.getByRole('button', { name: 'Add item' }).click()
    await expect(page.getByText('Delete Me Item')).toBeVisible()

    await page.getByRole('button', { name: /Remove Delete Me Item/i }).click()
    await expect(page.getByText('Delete Me Item')).not.toBeVisible()
  })

  test('can add a custom recipe and it appears in the All view', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    // Modal is open when the recipe name input is visible
    await expect(page.getByPlaceholder('e.g. Mango Chia Pudding')).toBeVisible()

    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('My Test Recipe')
    await page.getByPlaceholder('e.g. High protein · gluten free').fill('Quick · 5 min')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    // Modal closes, recipe appears in the All view
    await expect(page.getByText('My Test Recipe')).toBeVisible()
  })

  test('custom recipe is retained after page reload', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Persistent Recipe')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.reload()
    await page.getByRole('button', { name: /Recipes/i }).click()
    await expect(page.getByText('Persistent Recipe')).toBeVisible()
  })

  test('custom recipe can be deleted', async ({ page }) => {
    // Add
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Delete Me')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    // Expand card in the All view and delete
    await page.getByText('Delete Me').click()
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Delete recipe' }).click()

    await expect(page.getByText('Delete Me')).not.toBeVisible()
  })

  test('export data button triggers a download', async ({ page }) => {
    // Export is now in the settings panel (⚙ button in the header)
    await page.getByRole('button', { name: 'Settings' }).click()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: '↓ Export' }).click(),
    ])
    expect(download.suggestedFilename()).toMatch(/wellness_hub_backup_.+\.json/)
  })

  // ── Phase 2: action bar + CookingMode ───────────────────────────

  test('expanded custom recipe shows Edit, Cook, and Grocery buttons', async ({ page }) => {
    // Create a recipe with steps and ingredients
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Action Bar Recipe')
    // Add an ingredient (use textbox role scoped to "Ingredient" label)
    await page.getByRole('textbox', { name: 'Ingredient' }).fill('Oats')
    await page.getByPlaceholder('Amount').fill('50g')
    // The ingredient and step "+" buttons have exact text "+"; use exact match
    // to avoid matching "⁺ Add my recipe" etc.
    const plusBtns = page.getByRole('button', { name: '+', exact: true })
    await plusBtns.first().click()
    // Add a step (placeholder is "Add a step...", step "+" is the second exact-"+" button)
    await page.getByPlaceholder('Add a step...').fill('Cook the oats')
    await plusBtns.last().click()
    await page.getByRole('button', { name: 'Save recipe' }).click()

    // Expand the card in the All view
    await page.getByText('Action Bar Recipe').click()

    await expect(page.getByRole('button', { name: /edit recipe/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /cook this recipe/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /add ingredients to grocery/i })).toBeVisible()
  })

  test('Cook button launches CookingMode overlay', async ({ page }) => {
    // Create a recipe with a step
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Cook Test Recipe')
    await page.getByPlaceholder('Add a step...').fill('Boil water')
    await page.getByRole('button', { name: '+', exact: true }).last().click()
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByText('Cook Test Recipe').click()
    await page.getByRole('button', { name: /cook/i }).click()

    await expect(page.getByText(/Exit cooking mode/)).toBeVisible()
    // Recipe name appears in CookingMode header (span element)
    await expect(page.locator('span').filter({ hasText: 'Cook Test Recipe' })).toBeVisible()
  })

  test('CookingMode can be exited via Exit button', async ({ page }) => {
    // Create a recipe with a step
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Exit Cook Recipe')
    await page.getByPlaceholder('Add a step...').fill('Stir gently')
    await page.getByRole('button', { name: '+', exact: true }).last().click()
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByText('Exit Cook Recipe').click()
    await page.getByRole('button', { name: /cook/i }).click()
    await expect(page.getByText(/Exit cooking mode/)).toBeVisible()

    await page.getByText(/Exit cooking mode/).click()
    await expect(page.getByText(/Exit cooking mode/)).not.toBeVisible()
    // Back on the recipes view — Grocery button should still be there
    await expect(page.getByRole('button', { name: /Grocery/ })).toBeVisible()
  })

  // ── Phase 3 & 4: edit mode + fork / hide ────────────────────────

  test('editing a custom recipe pre-fills fields and shows "Edit my Recipe"', async ({ page }) => {
    // Create recipe first
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Original Name')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    // Expand the card in the All view
    await page.getByText('Original Name').click()

    // Click Edit — modal should say "Edit my Recipe" with name pre-filled
    await page.getByRole('button', { name: /edit recipe/i }).click()
    await expect(page.getByText(/Edit my/)).toBeVisible()
    await expect(page.getByPlaceholder('e.g. Mango Chia Pudding')).toHaveValue('Original Name')
  })

  test('editing a custom recipe and saving updates the recipe name', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Before Edit')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByText('Before Edit').click()
    await page.getByRole('button', { name: /edit recipe/i }).click()

    // Clear and type new name
    const nameField = page.getByPlaceholder('e.g. Mango Chia Pudding')
    await nameField.clear()
    await nameField.fill('After Edit')
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Modal closes; updated name appears in All view
    await expect(page.getByText('After Edit')).toBeVisible()
    await expect(page.getByText('Before Edit')).not.toBeVisible()
  })

  // ── Phase 6: GroceryIngredientModal ─────────────────────────────

  test('Grocery button on a recipe with ingredients opens the ingredient picker modal', async ({ page }) => {
    // Create a custom recipe with an ingredient
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Grocery Test Recipe')
    await page.getByRole('textbox', { name: 'Ingredient' }).fill('Spinach')
    await page.getByPlaceholder('Amount').fill('2 cups')
    await page.getByRole('button', { name: '+', exact: true }).first().click()
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByText('Grocery Test Recipe').click()
    await page.getByRole('button', { name: /add ingredients to grocery/i }).click()

    // Modal opens: "Deselect all" and checkboxes are unique to the modal
    await expect(page.getByRole('button', { name: 'Deselect all' })).toBeVisible()
    await expect(page.getByRole('checkbox')).toHaveCount(1)
  })

  test('ingredient picker adds items to grocery list', async ({ page }) => {
    // Create recipe with two ingredients
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Two Ing Recipe')
    const plusBtns = page.getByRole('button', { name: '+', exact: true })
    await page.getByRole('textbox', { name: 'Ingredient' }).fill('Oats')
    await page.getByPlaceholder('Amount').fill('1 cup')
    await plusBtns.first().click()
    await page.getByRole('textbox', { name: 'Ingredient' }).fill('Banana')
    await page.getByPlaceholder('Amount').fill('1 medium')
    await plusBtns.first().click()
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByText('Two Ing Recipe').click()
    await page.getByRole('button', { name: /add ingredients to grocery/i }).click()

    // Add all ingredients
    await page.getByRole('button', { name: /Add 2 items to grocery/i }).click()
    await expect(page.getByText(/2 items added to grocery list/i)).toBeVisible()

    // Navigate to grocery and confirm items appear
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await expect(page.getByText('Oats', { exact: true })).toBeVisible()
    await expect(page.getByText('Banana', { exact: true })).toBeVisible()
  })

  test('can deselect individual ingredients before adding', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Partial Add Recipe')
    const plusBtns = page.getByRole('button', { name: '+', exact: true })
    await page.getByRole('textbox', { name: 'Ingredient' }).fill('Keep This')
    await page.getByPlaceholder('Amount').fill('100g')
    await plusBtns.first().click()
    await page.getByRole('textbox', { name: 'Ingredient' }).fill('Skip This')
    await page.getByPlaceholder('Amount').fill('50g')
    await plusBtns.first().click()
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByText('Partial Add Recipe').click()
    await page.getByRole('button', { name: /add ingredients to grocery/i }).click()

    // Uncheck "Skip This"
    const skipCheckbox = page.locator('label').filter({ hasText: 'Skip This' }).locator('input[type=checkbox]')
    await skipCheckbox.uncheck()
    await expect(page.getByRole('button', { name: /Add 1 item to grocery/i })).toBeVisible()

    await page.getByRole('button', { name: /Add 1 item to grocery/i }).click()

    // Go to grocery — only Keep This should appear
    await page.getByRole('button', { name: '🛒 Grocery' }).click()
    await expect(page.getByText('Keep This')).toBeVisible()
    await expect(page.getByText('Skip This')).not.toBeVisible()
  })

  test('custom recipe does not show a Hide button', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('No Hide Here')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByText('No Hide Here').click()

    await expect(page.getByRole('button', { name: /hide this suggestion/i })).not.toBeVisible()
  })
})
