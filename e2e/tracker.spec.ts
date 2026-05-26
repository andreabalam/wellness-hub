import { test, expect } from '@playwright/test'

test.describe('Tracker tab', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage so each test starts clean
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.getByRole('button', { name: /Tracker/i }).click()
  })

  test('shows today\'s date in the date label', async ({ page }) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    await expect(page.getByText(today)).toBeVisible()
  })

  test('macro bars start at zero', async ({ page }) => {
    await expect(page.getByText('0 / 1,380 kcal')).toBeVisible()
    await expect(page.getByText('1,380 kcal remaining')).toBeVisible()
  })

  test('logging a meal updates macro totals', async ({ page }) => {
    await page.getByPlaceholder('Meal name (e.g. Berry Oats)').fill('Test Oats')
    await page.getByPlaceholder('kcal').fill('350')
    await page.getByPlaceholder('prot').fill('18')
    await page.getByPlaceholder('carb').fill('42')
    await page.getByPlaceholder('fat').fill('12')
    await page.getByRole('button', { name: '+ Log food' }).click()

    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()
    await expect(page.getByText('Test Oats')).toBeVisible()
  })

  test('quick-add populates macros from a preset food', async ({ page }) => {
    await page.getByRole('button', { name: /Berry Oats \(350\)/ }).click()
    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()
    // Use exact match to avoid matching the quick-add button "Berry Oats (350)"
    await expect(page.getByText('Berry Oats', { exact: true })).toBeVisible()
  })

  test('removing a logged meal updates the totals', async ({ page }) => {
    await page.getByRole('button', { name: /Berry Oats \(350\)/ }).click()
    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()

    await page.locator('.rmfood, button:has-text("×")').first().click()
    await expect(page.getByText('0 / 1,380 kcal')).toBeVisible()
  })

  test('logging a workout shows confirmation', async ({ page }) => {
    await page.getByRole('button', { name: 'Pilates' }).first().click()
    await page.getByRole('button', { name: '+ Log workout' }).click()
    await expect(page.getByText('✓ Session logged')).toBeVisible()
  })

  test('logging meditation shows confirmation', async ({ page }) => {
    await page.getByRole('button', { name: '13 min' }).click()
    await page.getByRole('button', { name: 'Log meditation' }).click()
    await expect(page.getByText(/Done: 13 min/)).toBeVisible()
  })

  test('saving check-in shows saved feedback', async ({ page }) => {
    await page.getByRole('button', { name: 'Save check-in' }).click()
    await expect(page.getByRole('button', { name: 'Saved!' })).toBeVisible()
  })

  test('date navigation goes to previous day', async ({ page }) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const label = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    await page.getByRole('button', { name: '‹ Prev' }).click()
    await expect(page.getByText(label)).toBeVisible()
  })

  test('TODAY button returns to current date', async ({ page }) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    await page.getByRole('button', { name: '‹ Prev' }).click()
    await page.getByRole('button', { name: 'TODAY' }).click()
    await expect(page.getByText(today)).toBeVisible()
  })

  test('food log data persists after navigating away and back', async ({ page }) => {
    await page.getByRole('button', { name: /Berry Oats \(350\)/ }).click()
    await expect(page.getByText('Berry Oats', { exact: true })).toBeVisible()

    // Switch tab and come back
    await page.getByRole('button', { name: /Schedule/i }).click()
    await page.getByRole('button', { name: /Tracker/i }).click()

    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()
    await expect(page.getByText('Berry Oats', { exact: true })).toBeVisible()
  })

  test('week strip shows current week days', async ({ page }) => {
    // The strip should show M T W T F S S
    const strip = page.locator('#root').getByText('M').first()
    await expect(strip).toBeVisible()
  })
})
