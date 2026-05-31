# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recipes.spec.ts >> Recipes tab >> filter by Breakfast shows only breakfast recipes
- Location: e2e/recipes.spec.ts:17:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.rcard').first()
Expected: visible
Timeout: 15000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 15000ms
  - waiting for locator('.rcard').first()

```

```yaml
- banner:
  - text: My
  - emphasis: Wellness Hub
  - navigation:
    - button "📊 Tracker"
    - button "🍽 Recipes"
    - button "💪 Workouts"
    - button "📅 Schedule"
- button "All"
- button "Breakfast"
- button "Smoothies"
- button "Lunch"
- button "Dinner"
- button "Dessert"
- button "Snacks"
- button "Drinks"
- button "Ferments"
- button "⭐ My Recipes"
- button "🛒 Grocery"
- img
- searchbox "Search recipes, ingredients…"
- button "+ Add my recipe"
- text: Could not load recipes — check your connection and refresh.
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test'
  2   | 
  3   | test.describe('Recipes tab', () => {
  4   |   test.beforeEach(async ({ page }) => {
  5   |     await page.goto('/')
  6   |     await page.evaluate(() => localStorage.clear())
  7   |     await page.getByRole('button', { name: /Recipes/i }).click()
  8   |   })
  9   | 
  10  |   test('shows all built-in recipes by default', async ({ page }) => {
  11  |     await expect(page.locator('.rcard').first()).toBeVisible()
  12  |     // At least 20 built-in recipes
  13  |     await expect(page.locator('.rcard')).toHaveCount(await page.locator('.rcard').count())
  14  |     expect(await page.locator('.rcard').count()).toBeGreaterThan(15)
  15  |   })
  16  | 
  17  |   test('filter by Breakfast shows only breakfast recipes', async ({ page }) => {
  18  |     // Wait for async DB load to finish before filtering
> 19  |     await expect(page.locator('.rcard').first()).toBeVisible({ timeout: 15000 })
      |                                                  ^ Error: expect(locator).toBeVisible() failed
  20  |     await page.getByRole('button', { name: 'Breakfast' }).click()
  21  |     const cards = page.locator('.rcard')
  22  |     const count = await cards.count()
  23  |     expect(count).toBeGreaterThan(0)
  24  |     // All visible cards show "Breakfast" type
  25  |     for (let i = 0; i < count; i++) {
  26  |       await expect(cards.nth(i).locator('.rctype')).toContainText('Breakfast')
  27  |     }
  28  |   })
  29  | 
  30  |   test('filter by Smoothies shows only smoothies', async ({ page }) => {
  31  |     // Wait for async DB load to finish before filtering
  32  |     await expect(page.locator('.rcard').first()).toBeVisible({ timeout: 15000 })
  33  |     await page.getByRole('button', { name: 'Smoothies' }).click()
  34  |     const cards = page.locator('.rcard')
  35  |     const count = await cards.count()
  36  |     expect(count).toBeGreaterThan(0)
  37  |     for (let i = 0; i < count; i++) {
  38  |       await expect(cards.nth(i).locator('.rctype')).toContainText('Smoothie')
  39  |     }
  40  |   })
  41  | 
  42  |   test('clicking a recipe card expands it', async ({ page }) => {
  43  |     const card = page.locator('.rcard').first()
  44  |     await expect(card.locator('.rcbody')).not.toBeVisible()
  45  |     await card.click()
  46  |     await expect(card.locator('.rcbody')).toBeVisible()
  47  |     await expect(card.locator('.rchint')).toContainText('tap to collapse')
  48  |   })
  49  | 
  50  |   test('clicking an open card collapses it', async ({ page }) => {
  51  |     const card = page.locator('.rcard').first()
  52  |     await card.click()
  53  |     await expect(card.locator('.rcbody')).toBeVisible()
  54  |     await card.click()
  55  |     await expect(card.locator('.rcbody')).not.toBeVisible()
  56  |   })
  57  | 
  58  |   test('Grocery filter shows the grocery panel', async ({ page }) => {
  59  |     await page.getByRole('button', { name: '🛒 Grocery' }).click()
  60  |     await expect(page.getByText('Your Grocery List')).toBeVisible()
  61  |     await expect(page.locator('.gcat').first()).toBeVisible()
  62  |   })
  63  | 
  64  |   test('grocery items can be checked and unchecked', async ({ page }) => {
  65  |     await page.getByRole('button', { name: '🛒 Grocery' }).click()
  66  |     const item = page.locator('.gitem').first()
  67  |     await expect(item).not.toHaveClass(/gchecked/)
  68  |     await item.click()
  69  |     await expect(item).toHaveClass(/gchecked/)
  70  |     await item.click()
  71  |     await expect(item).not.toHaveClass(/gchecked/)
  72  |   })
  73  | 
  74  |   test('grocery checked state persists across page reloads', async ({ page }) => {
  75  |     await page.getByRole('button', { name: '🛒 Grocery' }).click()
  76  |     const item = page.locator('.gitem').first()
  77  |     // The item name is in the first <span> (flex:1); second span is the optional badge
  78  |     const itemText = await item.locator('span').first().textContent()
  79  |     await item.click()
  80  |     await expect(item).toHaveClass(/gchecked/)
  81  | 
  82  |     await page.reload()
  83  |     await page.getByRole('button', { name: /Recipes/i }).click()
  84  |     await page.getByRole('button', { name: '🛒 Grocery' }).click()
  85  | 
  86  |     const reloadedItem = page.locator('.gitem').filter({ hasText: itemText! }).first()
  87  |     await expect(reloadedItem).toHaveClass(/gchecked/)
  88  |   })
  89  | 
  90  |   test('Clear all removes all checks', async ({ page }) => {
  91  |     await page.getByRole('button', { name: '🛒 Grocery' }).click()
  92  |     // Check a couple of items
  93  |     await page.locator('.gitem').nth(0).click()
  94  |     await page.locator('.gitem').nth(1).click()
  95  |     await page.getByRole('button', { name: 'Clear all' }).click()
  96  |     const checkedCount = await page.locator('.gitem.gchecked').count()
  97  |     expect(checkedCount).toBe(0)
  98  |   })
  99  | 
  100 |   // ── Phase 5: dynamic grocery catalog ────────────────────────────
  101 | 
  102 |   test('can add a custom item to the grocery list', async ({ page }) => {
  103 |     await page.getByRole('button', { name: '🛒 Grocery' }).click()
  104 |     await page.getByRole('button', { name: /add grocery item/i }).click()
  105 |     await page.getByPlaceholder(/Item name/i).fill('Kimchi')
  106 |     await page.getByRole('button', { name: 'Add item' }).click()
  107 |     await expect(page.getByText('Kimchi')).toBeVisible()
  108 |   })
  109 | 
  110 |   test('added grocery item can be checked off', async ({ page }) => {
  111 |     await page.getByRole('button', { name: '🛒 Grocery' }).click()
  112 |     await page.getByRole('button', { name: /add grocery item/i }).click()
  113 |     await page.getByPlaceholder(/Item name/i).fill('Miso Paste')
  114 |     await page.getByRole('button', { name: 'Add item' }).click()
  115 |     const item = page.locator('.gitem').filter({ hasText: 'Miso Paste' })
  116 |     await item.click()
  117 |     await expect(item).toHaveClass(/gchecked/)
  118 |   })
  119 | 
```