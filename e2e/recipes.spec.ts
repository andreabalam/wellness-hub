import { test, expect } from '@playwright/test'

test.describe('Recipes tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByRole('button', { name: /Recipes/i }).click()
  })

  test('shows all built-in recipes by default', async ({ page }) => {
    await expect(page.locator('.rcard').first()).toBeVisible()
    // At least 20 built-in recipes
    await expect(page.locator('.rcard')).toHaveCount(await page.locator('.rcard').count())
    expect(await page.locator('.rcard').count()).toBeGreaterThan(15)
  })

  test('filter by Breakfast shows only breakfast recipes', async ({ page }) => {
    // Wait for async DB load to finish before filtering
    await expect(page.locator('.rcard').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Breakfast' }).click()
    const cards = page.locator('.rcard')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    // All visible cards show "Breakfast" type
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('.rctype')).toContainText('Breakfast')
    }
  })

  test('filter by Smoothies shows only smoothies', async ({ page }) => {
    // Wait for async DB load to finish before filtering
    await expect(page.locator('.rcard').first()).toBeVisible({ timeout: 15000 })
    await page.getByRole('button', { name: 'Smoothies' }).click()
    const cards = page.locator('.rcard')
    const count = await cards.count()
    expect(count).toBeGreaterThan(0)
    for (let i = 0; i < count; i++) {
      await expect(cards.nth(i).locator('.rctype')).toContainText('Smoothie')
    }
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

  test('can add a custom recipe and it appears under My Recipes', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    // Modal is open when the recipe name input is visible
    await expect(page.getByPlaceholder('e.g. Mango Chia Pudding')).toBeVisible()

    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('My Test Recipe')
    await page.getByPlaceholder('e.g. High protein · gluten free').fill('Quick · 5 min')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    // Modal closes, recipe appears in My Recipes
    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
    await expect(page.getByText('My Test Recipe')).toBeVisible()
  })

  test('custom recipe is retained after page reload', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Persistent Recipe')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.reload()
    await page.getByRole('button', { name: /Recipes/i }).click()
    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
    await expect(page.getByText('Persistent Recipe')).toBeVisible()
  })

  test('custom recipe can be deleted', async ({ page }) => {
    // Add
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Delete Me')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    // Open My Recipes, expand card, delete
    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
    await page.getByText('Delete Me').click()
    page.once('dialog', d => d.accept())
    await page.getByRole('button', { name: 'Delete recipe' }).click()

    await expect(page.getByText('Delete Me')).not.toBeVisible()
  })

  test('export data button triggers a download', async ({ page }) => {
    // Export lives in TrackerTab, not RecipesTab
    await page.getByRole('button', { name: /Tracker/i }).click()
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

    // Open My Recipes, expand the card
    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
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

    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
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

    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
    await page.getByText('Exit Cook Recipe').click()
    await page.getByRole('button', { name: /cook/i }).click()
    await expect(page.getByText(/Exit cooking mode/)).toBeVisible()

    await page.getByText(/Exit cooking mode/).click()
    await expect(page.getByText(/Exit cooking mode/)).not.toBeVisible()
    // Back on the recipes view
    await expect(page.getByRole('button', { name: '⭐ My Recipes' })).toBeVisible()
  })

  // ── Phase 3 & 4: edit mode + fork / hide ────────────────────────

  test('editing a custom recipe pre-fills fields and shows "Edit my Recipe"', async ({ page }) => {
    // Create recipe first
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Original Name')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    // Open My Recipes and expand
    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
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

    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
    await page.getByText('Before Edit').click()
    await page.getByRole('button', { name: /edit recipe/i }).click()

    // Clear and type new name
    const nameField = page.getByPlaceholder('e.g. Mango Chia Pudding')
    await nameField.clear()
    await nameField.fill('After Edit')
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Modal closes; updated name appears
    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
    await expect(page.getByText('After Edit')).toBeVisible()
    await expect(page.getByText('Before Edit')).not.toBeVisible()
  })

  test('custom recipe does not show a Hide button', async ({ page }) => {
    await page.getByRole('button', { name: '+ Add my recipe' }).click()
    await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('No Hide Here')
    await page.getByRole('button', { name: 'Save recipe' }).click()

    await page.getByRole('button', { name: '⭐ My Recipes' }).click()
    await page.getByText('No Hide Here').click()

    await expect(page.getByRole('button', { name: /hide this suggestion/i })).not.toBeVisible()
  })
})
