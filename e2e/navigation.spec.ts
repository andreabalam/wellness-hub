import { test, expect } from '@playwright/test'

// Helper: target only the top-level tab bar buttons (avoids matching
// in-page buttons like "✎ Edit schedule" that also contain "Schedule")
const tabBar = (page: Parameters<typeof expect>[0]) =>
  (page as import('@playwright/test').Page).locator('nav.tabs')

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('loads with Tracker tab active by default', async ({ page }) => {
    await expect(tabBar(page).getByRole('button', { name: /Tracker/i })).toHaveClass(/active/)
    // TrackerTab shows an auth gate for unauthenticated users
    await expect(page.getByText(/Sign in to use/i)).toBeVisible()
  })

  test('switches to Schedule tab', async ({ page }) => {
    await tabBar(page)
      .getByRole('button', { name: /Schedule/i })
      .click()
    await expect(tabBar(page).getByRole('button', { name: /Schedule/i })).toHaveClass(/active/)
    // Unauthenticated users see the sign-in gate
    await expect(page.getByText(/Sign in to save your schedule/i)).toBeVisible()
  })

  test('switches to Workouts tab', async ({ page }) => {
    await page.getByRole('button', { name: /Workouts/i }).click()
    // Guest users see the male full-body template (no auth required)
    await expect(page.getByText('3×/week Template')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Week 1' })).toBeVisible()
  })

  test('switches to Recipes tab', async ({ page }) => {
    await page.getByRole('button', { name: /Recipes/i }).click()
    // Unauthenticated users see the sign-in gate (no filter bar)
    await expect(page.getByText(/Create, save and organise your personal recipes/i)).toBeVisible()
    await expect(page.locator('input[placeholder*="Search recipes"]')).not.toBeVisible()
  })

  test('switches to Tracker tab', async ({ page }) => {
    // Navigate away first, then switch back
    await tabBar(page)
      .getByRole('button', { name: /Schedule/i })
      .click()
    await tabBar(page)
      .getByRole('button', { name: /Tracker/i })
      .click()
    // TrackerTab shows the auth gate for unauthenticated users
    await expect(page.getByText(/Sign in to use/i)).toBeVisible()
  })

  test('switches to Oura tab showing sign-in gate when unauthenticated', async ({ page }) => {
    await tabBar(page).getByRole('button', { name: /Oura/i }).click()
    await expect(tabBar(page).getByRole('button', { name: /Oura/i })).toHaveClass(/active/)
    await expect(page.getByText(/Sign in to view your Oura dashboard/i)).toBeVisible()
  })

  test('tabs retain their state when switching away and back', async ({ page }) => {
    // Go to Workouts, click Week 2
    await page.getByRole('button', { name: /Workouts/i }).click()
    await page.getByRole('button', { name: 'Week 2' }).click()
    // Guest users see the male template; Week 2 is "Progressive Overload"
    await expect(page.getByText(/Progressive Overload/)).toBeVisible()

    // Switch away and back
    await tabBar(page)
      .getByRole('button', { name: /Schedule/i })
      .click()
    await page.getByRole('button', { name: /Workouts/i }).click()
    // Week 2 content still showing (React state preserved)
    await expect(page.getByText(/Progressive Overload/)).toBeVisible()
  })
})
