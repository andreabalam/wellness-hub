import { test, expect } from '@playwright/test'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const CUSTOM_RECIPE = {
  id: 9100, cat: 'smoothie', type: 'Smoothie', color: 'var(--purple)', sc: 'cp',
  name: 'Mango Lassi', tag: 'Quick', prepL: 'Custom', prepC: 'var(--purple)',
  hk: 320, hp: '12g', hc: '52g', hf: '8g', hfi: '3g',
  mk: 410, mp: '10g', mc: '60g', mf: '14g',
  ings: [['Mango', '1 cup'], ['Yogurt', '200g']], steps: ['Blend'], tip: '',
  custom: true,
}

const USDA_RESPONSE = {
  foods: [
    {
      description: 'Tamales, masa',
      foodNutrients: [
        { nutrientId: 1008, value: 213 },   // kcal
        { nutrientId: 1003, value: 5.8 },   // protein
        { nutrientId: 1005, value: 28.4 },  // carbs
        { nutrientId: 1004, value: 9.1 },   // fat
        { nutrientId: 1079, value: 3.2 },   // fiber
      ],
    },
  ],
}

const AI_RESPONSE = {
  estimate: {
    name: 'Pozole Rojo', kcal: 320, protein: 22, carbs: 28, fat: 14, fiber: 5,
    confidence: 'medium', notes: 'Assumes 1 bowl (~400 g)',
  },
}

// ── Suite ────────────────────────────────────────────────────────────────────

test.describe('Tracker food search', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem('__e2e_user__', JSON.stringify({
        id: 'e2e-test-id', email: 'test@e2e.com',
        app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '',
      }))
    })
    await page.goto('/')
    await page.evaluate(() => { localStorage.clear() })
    await page.reload()
  })

  const mealInput = (page: import('@playwright/test').Page) =>
    page.getByPlaceholder('Meal name (e.g. Berry Oats)')
  const dropdown = (page: import('@playwright/test').Page) =>
    page.locator('.autocomplete-dropdown')

  // ── Local search ───────────────────────────────────────────────────

  test('typing shows built-in foods under a Suggestions section', async ({ page }) => {
    await mealInput(page).fill('berry')
    await expect(dropdown(page).getByText('Suggestions')).toBeVisible()
    await expect(dropdown(page).getByText('Berry Oats')).toBeVisible()
  })

  test('previously logged foods rank under "Your foods" and fill the form', async ({ page }) => {
    await mealInput(page).fill('Custom Tamal')
    await page.getByPlaceholder('kcal').fill('250')
    await page.getByRole('button', { name: '+ Log food' }).click()

    await mealInput(page).fill('tamal')
    await expect(dropdown(page).getByText('Your foods')).toBeVisible()
    await dropdown(page).getByText('Custom Tamal').dispatchEvent('mousedown')
    await expect(page.getByPlaceholder('kcal')).toHaveValue('250')
  })

  test('saved recipes appear under "Recipes"; logging stores the link badge', async ({ page }) => {
    await page.evaluate(rec => {
      localStorage.setItem('whub_custom_recipes_v1', JSON.stringify([rec]))
    }, CUSTOM_RECIPE)

    await mealInput(page).fill('mango')
    await expect(dropdown(page).getByText('Recipes', { exact: true })).toBeVisible()
    await dropdown(page).getByText('Mango Lassi').dispatchEvent('mousedown')

    // Healthy-variant macros fill the form
    await expect(page.getByPlaceholder('kcal')).toHaveValue('320')
    await expect(page.getByPlaceholder('prot')).toHaveValue('12')

    await page.getByRole('button', { name: '+ Log food' }).click()
    await expect(page.locator('[title="Open recipe"]')).toBeVisible()

    // The recipe id is persisted on the entry
    const entry = await page.evaluate(() => {
      const days = JSON.parse(localStorage.getItem('whub_tracker_v3') ?? '{}')
      return (Object.values(days)[0] as { foods: { n: string; r?: number }[] }).foods[0]
    })
    expect(entry).toMatchObject({ n: 'Mango Lassi', r: 9100 })
  })

  // ── Online fallback — USDA ─────────────────────────────────────────

  test('unknown food → search online → USDA result fills the form', async ({ page }) => {
    await page.route(/fdc\/v1\/foods\/search/, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(USDA_RESPONSE),
    }))

    await mealInput(page).fill('zztamales')
    await dropdown(page).getByText(/Search online for/).dispatchEvent('mousedown')

    await expect(dropdown(page).getByText('USDA results')).toBeVisible()
    await dropdown(page).getByText('Tamales, masa').dispatchEvent('mousedown')

    await expect(mealInput(page)).toHaveValue('Tamales, masa')
    await expect(page.getByPlaceholder('kcal')).toHaveValue('213')

    // Logged entry lands in the day like any other food
    await page.getByRole('button', { name: '+ Log food' }).click()
    await expect(page.getByText('Tamales, masa', { exact: true })).toBeVisible()
  })

  test('relogging an online food becomes a local hit', async ({ page }) => {
    await page.route(/fdc\/v1\/foods\/search/, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(USDA_RESPONSE),
    }))

    await mealInput(page).fill('zztamales')
    await dropdown(page).getByText(/Search online for/).dispatchEvent('mousedown')
    await dropdown(page).getByText('Tamales, masa').dispatchEvent('mousedown')
    await page.getByRole('button', { name: '+ Log food' }).click()

    // Second time around: no online search needed — it's in the library now
    await mealInput(page).fill('tamales')
    await expect(dropdown(page).getByText('Your foods')).toBeVisible()
    await expect(dropdown(page).getByText('Tamales, masa')).toBeVisible()
  })

  // ── Online fallback — AI ───────────────────────────────────────────

  test('no USDA match → AI estimate fills the form with a note', async ({ page }) => {
    await page.route(/fdc\/v1\/foods\/search/, route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ foods: [] }),
    }))
    await page.route('**/functions/v1/estimate-food-macros', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(AI_RESPONSE),
    }))

    await mealInput(page).fill('pozole rojo')
    await dropdown(page).getByText(/Search online for/).dispatchEvent('mousedown')

    await expect(dropdown(page).getByText('No USDA match.')).toBeVisible()
    await dropdown(page).getByText(/Estimate with AI/).dispatchEvent('mousedown')

    await expect(mealInput(page)).toHaveValue('Pozole Rojo')
    await expect(page.getByPlaceholder('kcal')).toHaveValue('320')
    await expect(page.getByText(/Assumes 1 bowl/)).toBeVisible()
  })

  test('tapping the 📖 badge opens the recipe in the Recipes tab', async ({ page }) => {
    await page.evaluate(rec => {
      localStorage.setItem('whub_custom_recipes_v1', JSON.stringify([rec]))
    }, CUSTOM_RECIPE)

    await mealInput(page).fill('mango')
    await dropdown(page).getByText('Mango Lassi').dispatchEvent('mousedown')
    await page.getByRole('button', { name: '+ Log food' }).click()

    await page.locator('[title="Open recipe"]').click()

    // App switches to the Recipes tab and the linked card is expanded
    const openCard = page.locator('.rcard.open')
    await expect(openCard).toBeVisible()
    await expect(openCard).toContainText('Mango Lassi')
    await expect(openCard).toContainText('Blend')
  })

  test('online search failure shows a retry row', async ({ page }) => {
    await page.route(/fdc\/v1\/foods\/search/, route => route.fulfill({ status: 500 }))

    await mealInput(page).fill('zzghostfood')
    await dropdown(page).getByText(/Search online for/).dispatchEvent('mousedown')

    await expect(dropdown(page).getByText(/Search failed — tap to retry/)).toBeVisible()
  })
})
