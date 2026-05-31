# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: recipes.spec.ts >> Recipes tab >> clicking an open card collapses it
- Location: e2e/recipes.spec.ts:50:3

# Error details

```
TimeoutError: locator.click: Timeout 10000ms exceeded.
Call log:
  - waiting for locator('.rcard').first()

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - generic [ref=e5]:
      - text: My
      - emphasis [ref=e6]: Wellness Hub
    - navigation [ref=e7]:
      - button "📊 Tracker" [ref=e8] [cursor=pointer]
      - button "🍽 Recipes" [active] [ref=e9] [cursor=pointer]
      - button "💪 Workouts" [ref=e10] [cursor=pointer]
      - button "📅 Schedule" [ref=e11] [cursor=pointer]
  - generic [ref=e12]:
    - generic [ref=e13]:
      - button "All" [ref=e14] [cursor=pointer]
      - button "Breakfast" [ref=e15] [cursor=pointer]
      - button "Smoothies" [ref=e16] [cursor=pointer]
      - button "Lunch" [ref=e17] [cursor=pointer]
      - button "Dinner" [ref=e18] [cursor=pointer]
      - button "Dessert" [ref=e19] [cursor=pointer]
      - button "Snacks" [ref=e20] [cursor=pointer]
      - button "Drinks" [ref=e21] [cursor=pointer]
      - button "Ferments" [ref=e22] [cursor=pointer]
      - button "⭐ My Recipes" [ref=e23] [cursor=pointer]
      - button "🛒 Grocery" [ref=e24] [cursor=pointer]
    - generic [ref=e25]:
      - img
      - searchbox "Search recipes, ingredients…" [ref=e26]
    - button "+ Add my recipe" [ref=e28] [cursor=pointer]
    - generic [ref=e30]: Could not load recipes — check your connection and refresh.
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
  19  |     await expect(page.locator('.rcard').first()).toBeVisible({ timeout: 15000 })
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
> 52  |     await card.click()
      |                ^ TimeoutError: locator.click: Timeout 10000ms exceeded.
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
  100 |   test('can add a custom recipe and it appears under My Recipes', async ({ page }) => {
  101 |     await page.getByRole('button', { name: '+ Add my recipe' }).click()
  102 |     // Modal is open when the recipe name input is visible
  103 |     await expect(page.getByPlaceholder('e.g. Mango Chia Pudding')).toBeVisible()
  104 | 
  105 |     await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('My Test Recipe')
  106 |     await page.getByPlaceholder('e.g. High protein · gluten free').fill('Quick · 5 min')
  107 |     await page.getByRole('button', { name: 'Save recipe' }).click()
  108 | 
  109 |     // Modal closes, recipe appears in My Recipes
  110 |     await page.getByRole('button', { name: '⭐ My Recipes' }).click()
  111 |     await expect(page.getByText('My Test Recipe')).toBeVisible()
  112 |   })
  113 | 
  114 |   test('custom recipe is retained after page reload', async ({ page }) => {
  115 |     await page.getByRole('button', { name: '+ Add my recipe' }).click()
  116 |     await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Persistent Recipe')
  117 |     await page.getByRole('button', { name: 'Save recipe' }).click()
  118 | 
  119 |     await page.reload()
  120 |     await page.getByRole('button', { name: /Recipes/i }).click()
  121 |     await page.getByRole('button', { name: '⭐ My Recipes' }).click()
  122 |     await expect(page.getByText('Persistent Recipe')).toBeVisible()
  123 |   })
  124 | 
  125 |   test('custom recipe can be deleted', async ({ page }) => {
  126 |     // Add
  127 |     await page.getByRole('button', { name: '+ Add my recipe' }).click()
  128 |     await page.getByPlaceholder('e.g. Mango Chia Pudding').fill('Delete Me')
  129 |     await page.getByRole('button', { name: 'Save recipe' }).click()
  130 | 
  131 |     // Open My Recipes, expand card, delete
  132 |     await page.getByRole('button', { name: '⭐ My Recipes' }).click()
  133 |     await page.getByText('Delete Me').click()
  134 |     page.once('dialog', d => d.accept())
  135 |     await page.getByRole('button', { name: 'Delete recipe' }).click()
  136 | 
  137 |     await expect(page.getByText('Delete Me')).not.toBeVisible()
  138 |   })
  139 | 
  140 |   test('export data button triggers a download', async ({ page }) => {
  141 |     // Export lives in TrackerTab, not RecipesTab
  142 |     await page.getByRole('button', { name: /Tracker/i }).click()
  143 |     const [download] = await Promise.all([
  144 |       page.waitForEvent('download'),
  145 |       page.getByRole('button', { name: '↓ Export' }).click(),
  146 |     ])
  147 |     expect(download.suggestedFilename()).toMatch(/wellness_hub_backup_.+\.json/)
  148 |   })
  149 | })
  150 | 
```